import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;

export const r2 = new S3Client({
  region: "auto",
  endpoint: accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : undefined,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET || "datasheet-assets";
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `${PUBLIC_URL}/${key}`;
}

/** Delete an object given its public URL. No-op for URLs outside our bucket. */
export async function deleteFromR2(url: string): Promise<void> {
  if (!PUBLIC_URL || !url.startsWith(PUBLIC_URL)) return;
  const key = url.slice(PUBLIC_URL.length + 1);
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
