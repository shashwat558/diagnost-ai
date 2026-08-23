import { createHash, randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function createS3(opts: {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    endpoint: opts.endpoint,
    region: opts.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
    },
  });
}

/**
 * Transcript blob layout: transcripts/<workspace>/<conversation>/<span>.json
 * Returns the object key (stored as `transcript_ref` on the event).
 */
export async function uploadTranscript(
  s3: S3Client,
  opts: { bucket: string; workspaceId: string; conversationId: string; spanId: string; body: unknown }
): Promise<string> {
  const key = `${opts.workspaceId}/${opts.conversationId}/${opts.spanId}.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: opts.bucket,
      Key: key,
      Body: JSON.stringify(opts.body),
      ContentType: "application/json",
    })
  );
  return key;
}

// ── API key helpers ────────────────────────────────────────────

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

/** Generates `dw_<8-char prefix>_<secret>`; prefix stored for display. */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const prefix = randomUUID().replace(/-/g, "").slice(0, 8);
  const secret = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const raw = `dw_${prefix}_${secret}`;
  return { raw, hash: hashApiKey(raw), prefix };
}
