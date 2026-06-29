// 一次性：把「黑色射灯」系列页素材从 public/ 传到 R2，避免大文件进仓库/部署包。
// 运行：node scripts/upload-black-tracklight.mjs
import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET || "datasheet-assets";
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
if (!accountId || !PUBLIC_URL) {
  console.error("缺少 R2_ACCOUNT_ID / R2_PUBLIC_URL，检查 .env");
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const TYPES = { ".mp4": "video/mp4", ".webp": "image/webp" };
const SRC_DIR = path.resolve("public/black-tracklight");
const PREFIX = "series/black-tracklight";

const files = await readdir(SRC_DIR);
for (const name of files) {
  const ext = path.extname(name).toLowerCase();
  const contentType = TYPES[ext];
  if (!contentType) continue;
  const body = await readFile(path.join(SRC_DIR, name));
  const key = `${PREFIX}/${name}`;
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // 静态素材，长缓存
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  console.log(`✓ ${name}  →  ${PUBLIC_URL}/${key}`);
}
console.log(`\nBASE = ${PUBLIC_URL}/${PREFIX}`);
