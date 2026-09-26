import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { loadConfig } from "../config.js";
import { createS3 } from "../s3.js";

/** Buckets the platform writes to: transcripts, fine-tune exports, eval artifacts. */
const BUCKETS = ["transcripts", "finetune-datasets", "eval-artifacts"] as const;

async function main(): Promise<void> {
  const cfg = loadConfig();
  const s3 = createS3({
    endpoint: cfg.s3Endpoint,
    region: cfg.s3Region,
    accessKeyId: cfg.s3AccessKey,
    secretAccessKey: cfg.s3SecretKey,
  });

  console.log(`[s3-init] endpoint ${cfg.s3Endpoint}`);
  for (const bucket of BUCKETS) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`[s3-init] ${bucket} exists`);
      continue;
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status !== 404 && status !== 403 && status !== 400) throw err;
    }
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[s3-init] ${bucket} created`);
  }
  console.log(`[s3-init] done — ${BUCKETS.length} buckets ready`);
}

main().catch((err) => {
  console.error("[s3-init] failed:", err);
  process.exit(1);
});
