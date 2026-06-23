// 给存量图片回填 display(_lg)/thumb(_thumb) WebP + pdf(_pdf.jpg) 变体。
// 只往 R2 **新增**变体对象,绝不改数据库、不删原图——对生产数据零风险。
// 幂等:已存在 _lg 变体的图跳过,可安全重复运行。
// 来源:产品封面 + 画廊图 + detailBlocks/applications/contentI18n 里嵌的图片 URL(深度遍历)。
// 运行:npm run db:backfill-images
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { makeImageVariants } from "../src/lib/image-variants.js";
import { variantKeys } from "../src/lib/images.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

const accountId = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET || "datasheet-assets";
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
const r2 = new S3Client({
  region: "auto",
  endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

// 深度遍历任意 JSON,收集所有字符串(detailBlocks/applications/contentI18n 里的图 URL 形状各异,
// 直接收全部字符串再按"是不是我方 R2 栅格图"过滤,最稳)。
function collectStrings(v: unknown, out: Set<string>) {
  if (typeof v === "string") out.add(v);
  else if (Array.isArray(v)) for (const x of v) collectStrings(x, out);
  else if (v && typeof v === "object")
    for (const x of Object.values(v as Record<string, unknown>)) collectStrings(x, out);
}

async function putR2(key: string, body: Buffer, contentType: string) {
  await r2.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}

async function main() {
  if (!PUBLIC_URL) throw new Error("R2_PUBLIC_URL 未配置");

  const products = await prisma.product.findMany({
    select: {
      coverImage: true,
      images: { select: { url: true } },
      detailBlocks: true,
      applications: true,
      contentI18n: true,
    },
  });

  const urls = new Set<string>();
  for (const p of products) {
    if (p.coverImage) urls.add(p.coverImage);
    for (const im of p.images) if (im.url) urls.add(im.url);
    collectStrings(p.detailBlocks, urls);
    collectStrings(p.applications, urls);
    collectStrings(p.contentI18n, urls);
  }

  // 过滤:只处理本桶下、文件名是 UUID+栅格扩展名的"我方上传图"
  const targets: { url: string; vk: { lg: string; thumb: string; pdf: string } }[] = [];
  for (const url of urls) {
    if (!url.startsWith(PUBLIC_URL + "/")) continue;
    const key = url.slice(PUBLIC_URL.length + 1);
    const vk = variantKeys(key);
    if (vk) targets.push({ url, vk });
  }
  console.log(`扫描到 ${urls.size} 个 URL,其中 ${targets.length} 张我方 R2 栅格图待处理`);

  let made = 0;
  let skipped = 0;
  let failed = 0;
  let idx = 0;
  const CONC = 6;

  async function worker() {
    while (idx < targets.length) {
      const t = targets[idx++];
      try {
        // 幂等:_lg 与 _pdf 都已存在才跳过(缺哪个补哪个，兼容旧回填只生成了 WebP 的图)
        const [lgHead, pdfHead] = await Promise.all([
          fetch(`${PUBLIC_URL}/${t.vk.lg}`, { method: "HEAD" }),
          fetch(`${PUBLIC_URL}/${t.vk.pdf}`, { method: "HEAD" }),
        ]);
        if (lgHead.ok && pdfHead.ok) {
          skipped++;
          continue;
        }
        const res = await fetch(t.url);
        if (!res.ok) {
          failed++;
          console.warn(`  下载失败 ${res.status}: ${t.url}`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const { lg, thumb, pdf } = await makeImageVariants(buf);
        const ups: Promise<void>[] = [];
        if (!lgHead.ok) {
          ups.push(putR2(t.vk.lg, lg, "image/webp"));
          ups.push(putR2(t.vk.thumb, thumb, "image/webp"));
        }
        if (!pdfHead.ok) ups.push(putR2(t.vk.pdf, pdf, "image/jpeg"));
        await Promise.all(ups);
        made++;
        if (made % 20 === 0) console.log(`  ...已生成 ${made}`);
      } catch (e) {
        failed++;
        console.warn(`  出错 ${t.url}: ${(e as Error)?.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONC }, () => worker()));
  console.log(`✓ 变体回填完成:新建 ${made} · 已存在跳过 ${skipped} · 失败 ${failed}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
