/**
 * Ingestion consumer: events.raw → ClickHouse (+ full transcripts → S3).
 * Runs as a separate process from the API.
 *
 * ClickHouse strongly prefers few large inserts over many small ones, so
 * transcripts are hydrated per event but rows are written once per Kafka
 * batch, and offsets commit only after a successful insert.
 */
import { loadConfig, createClickhouse, createS3, insertEvents, uploadTranscript, incrementUsage } from "@diagnost/db";
import { consume, createKafka, ensureTopic } from "@diagnost/queue";
import type { EventEnvelope } from "@diagnost/core";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const ch = createClickhouse({
    url: cfg.clickhouseUrl,
    username: cfg.clickhouseUser,
    password: cfg.clickhousePassword,
    database: cfg.clickhouseDb,
  });
  const s3 = createS3({
    endpoint: cfg.s3Endpoint,
    region: cfg.s3Region,
    accessKeyId: cfg.s3AccessKey,
    secretAccessKey: cfg.s3SecretKey,
  });

  /** Unpacks diagnost.transcript JSON attr → S3 object + inline messages copy. */
  async function hydrateTranscript(event: EventEnvelope): Promise<void> {
    const attrs = event.attributes as Record<string, unknown>;
    let transcript: unknown = attrs.messages;
    if (typeof attrs["diagnost.transcript"] === "string") {
      try {
        transcript = JSON.parse(attrs["diagnost.transcript"] as string);
      } catch {
        transcript = undefined;
      }
      delete attrs["diagnost.transcript"];
    }
    if (transcript === undefined) return;

    attrs.messages = transcript;
    const ref = await uploadTranscript(s3, {
      bucket: cfg.s3BucketTranscripts,
      workspaceId: event.workspaceId,
      conversationId: event.conversationId,
      spanId: event.spanId,
      body: {
        eventId: event.id,
        conversationId: event.conversationId,
        spanId: event.spanId,
        name: event.name,
        kind: event.kind,
        timestampMs: event.timestampMs,
        piiAudit: event.piiAudit,
        messages: transcript,
      },
    });
    event.transcriptRef = ref;
  }

  const kafka = createKafka({ brokers: cfg.kafkaBrokers, clientId: "diagnost-consumer" });
  await ensureTopic(kafka, cfg.kafkaEventsTopic);

  let processed = 0;

  const stop = await consume(kafka, {
    groupId: "ingest-clickhouse",
    topics: [cfg.kafkaEventsTopic],
    handler: async (msgs) => {
      const events: EventEnvelope[] = [];
      for (const { message } of msgs) {
        if (!message.value) continue;
        const event = JSON.parse(message.value.toString()) as EventEnvelope;
        await hydrateTranscript(event);
        events.push(event);
      }
      await insertEvents(ch, cfg.clickhouseDb, events);
      // usage metering for billing (best-effort; never blocks the pipeline)
      try {
        await incrementUsage(cfg.databaseUrl, events[0]!.workspaceId, events.length);
      } catch (err) {
        console.error("[consumer] usage increment failed:", err);
      }
      processed += events.length;
      if (processed % 1000 < events.length) {
        console.log(`[consumer] processed ${processed} events`);
      }
    },
  });

  console.log("[consumer] running");

  const shutdown = async () => {
    await stop.disconnect();
    await ch.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[consumer] fatal:", err);
  process.exit(1);
});
