import { loadConfig } from "@diagnost/db";
import { createKafka, createProducer, ensureTopic } from "@diagnost/queue";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  let producer = null;

  try {
    const kafka = createKafka({ brokers: cfg.kafkaBrokers, clientId: "diagnost-api" });
    await ensureTopic(kafka, cfg.kafkaEventsTopic);
    producer = await createProducer(kafka);
    console.log("[api] kafka producer connected");
  } catch (err) {
    console.error("[api] kafka unavailable, starting in degraded mode:", err);
    process.exitCode = 1;
    process.exit(1);
  }

  const app = buildServer({
    databaseUrl: cfg.databaseUrl,
    producer,
    kafkaTopic: cfg.kafkaEventsTopic,
  });

  await app.listen({ port: cfg.apiPort, host: "0.0.0.0" });
  console.log(`[api] listening on :${cfg.apiPort}`);

  const shutdown = async () => {
    await app.close();
    await producer?.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[api] fatal:", err);
  process.exit(1);
});
