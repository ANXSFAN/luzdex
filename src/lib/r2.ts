import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";

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

/** URL 是否在本桶公开域名下——服务端按 URL 回读文件前的 SSRF 防线。 */
export function isR2Url(url: string): boolean {
  return !!PUBLIC_URL && url.startsWith(PUBLIC_URL + "/");
}

/** Delete an object given its public URL. No-op for URLs outside our bucket. */
export async function deleteFromR2(url: string): Promise<void> {
  if (!PUBLIC_URL || !url.startsWith(PUBLIC_URL)) return;
  const key = url.slice(PUBLIC_URL.length + 1);
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * 把桶内对象复制到新 key（产品复制用：图片各自独立，删除互不连坐）。
 * 返回新公开 URL；桶外 URL（如外站图）原样返回——deleteFromR2 对其本就 no-op，共享安全。
 */
export async function copyInR2(url: string, keyPrefix: string): Promise<string> {
  if (!PUBLIC_URL || !url.startsWith(PUBLIC_URL)) return url;
  const key = url.slice(PUBLIC_URL.length + 1);
  const dot = key.lastIndexOf(".");
  const ext = dot > key.lastIndexOf("/") ? key.slice(dot) : "";
  const newKey = `${keyPrefix}/${crypto.randomUUID()}${ext}`;
  await r2.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`,
      Key: newKey,
    }),
  );
  return `${PUBLIC_URL}/${newKey}`;
}
