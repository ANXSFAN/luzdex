-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "factory_id" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "series" TEXT;

-- CreateTable
CREATE TABLE "product_links" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'accessory',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "created_rows" INTEGER NOT NULL DEFAULT 0,
    "updated_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "report" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_links_to_id_idx" ON "product_links"("to_id");

-- CreateIndex
CREATE INDEX "product_links_factory_id_idx" ON "product_links"("factory_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_links_from_id_to_id_relation_key" ON "product_links"("from_id", "to_id", "relation");

-- CreateIndex
CREATE INDEX "import_jobs_factory_id_created_at_idx" ON "import_jobs"("factory_id", "created_at");

-- CreateIndex
CREATE INDEX "products_factory_id_series_idx" ON "products"("factory_id", "series");

-- CreateIndex
CREATE INDEX "products_factory_id_category_idx" ON "products"("factory_id", "category");

-- AddForeignKey
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
