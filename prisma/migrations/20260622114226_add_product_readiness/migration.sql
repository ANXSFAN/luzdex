-- 就绪度派生列：避免后台产品列表逐行加载全量内容并算哈希。
-- 加列带默认值,非破坏；存量行先取默认,随后由 npm run db:backfill-readiness 刷正确值。
ALTER TABLE "products" ADD COLUMN "lacks_showcase" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "stale" BOOLEAN NOT NULL DEFAULT false;
