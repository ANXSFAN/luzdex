-- AlterTable
ALTER TABLE "products" ADD COLUMN     "variant_group_id" TEXT;

-- CreateIndex
CREATE INDEX "products_factory_id_variant_group_id_idx" ON "products"("factory_id", "variant_group_id");

-- 回填：把现有「同系列且已填规格标签」的真变体（灯管 60/120/150cm、太阳能 60/100/150W 等）
-- 按 (factory_id, series) 各分一组。组 key 用该组最小产品 id，稳定且无需扩展函数。
UPDATE "products" p
SET "variant_group_id" = g.gid
FROM (
  SELECT "factory_id", "series", MIN("id") AS gid
  FROM "products"
  WHERE "variant_label" IS NOT NULL AND "series" IS NOT NULL
  GROUP BY "factory_id", "series"
  HAVING COUNT(*) > 1
) g
WHERE p."factory_id" = g."factory_id"
  AND p."series" = g."series"
  AND p."variant_label" IS NOT NULL;
