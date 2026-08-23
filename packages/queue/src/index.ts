import { Kafka, Partitioners, type Consumer, type KafkaMessage, type Producer } from "kafkajs";

export type { Consumer, KafkaMessage, Producer };

export interface QueueOpts {
  brokers: string[];
  clientId?: string;
}

export function createKafka(opts: QueueOpts): Kafka {
  return new Kafka({
    clientId: opts.clientId ?? "diagnost",
    brokers: opts.brokers,
    retry: { initialRetryTime: 200, retries: 8 },
  });
}

export async function ensureTopic(
  kafka: Kafka,
  topic: string,
  partitions = 3
): Promise<void> {
  const admin = kafka.admin();
  await admin.connect();
  try {
    const existing = await admin.listTopics();
    if (!existing.includes(topic)) {
      await admin.createTopics({
        topics: [{ topic, numPartitions: partitions, replicationFactor: 1 }],
      });
    }
  } finally {
    await admin.disconnect();
  }
}

export async function createProducer(kafka: Kafka): Promise<Producer> {
  const producer = kafka.producer({
    allowAutoTopicCreation: false,
    createPartitioner: Partitioners.DefaultPartitioner,
  });
  await producer.connect();
  return producer;
}

export interface PublishInput {
  key?: string;
  value: unknown;
}

export async function publish(
  producer: Producer,
  topic: string,
  messages: PublishInput[]
): Promise<void> {
  if (messages.length === 0) return;
  await producer.send({
    topic,
    messages: messages.map((m) => ({
      key: m.key,
      value: Buffer.from(JSON.stringify(m.value)),
    })),
  });
}

export type BatchHandler = (
  messages: Array<{ topic: string; partition: number; message: KafkaMessage }>
) => Promise<void>;

export async function consume(
  kafka: Kafka,
  opts: { groupId: string; topics: string[]; handler: BatchHandler }
): Promise<Consumer> {
  const consumer = kafka.consumer({ groupId: opts.groupId, sessionTimeout: 30_000 });
  await consumer.connect();
  await consumer.subscribe({ topics: opts.topics, fromBeginning: true });

  await consumer.run({
    eachBatchAutoResolve: false,
    autoCommitInterval: 500,
    eachBatch: async ({
      batch,
      resolveOffset,
      heartbeat,
      isRunning,
      uncommittedOffsets,
    }) => {
      const msgs = batch.messages
        .filter(() => isRunning())
        .map((message) => ({ topic: batch.topic, partition: batch.partition, message }));
      if (msgs.length === 0) return;

      try {
        await opts.handler(msgs);
        // commit only after the whole batch succeeded
        const last = msgs[msgs.length - 1]!.message.offset;
        if (last != null) resolveOffset(last);
        await heartbeat();
      } catch (err) {
        // Surface the failure; kafkajs restarts the group at last committed
        // offset so the batch is retried. Payloads were validated at the API
        // edge, so persistent poison sets should page a human.
        console.error(
          `[queue] batch failed on ${batch.topic}/${batch.partition} at ${batch.firstOffset()}..${batch.lastOffset()}; will retry`,
          err
        );
        void uncommittedOffsets;
        throw err;
      }
    },
  });

  return consumer;
}
