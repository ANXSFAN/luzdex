-- CreateTable
CREATE TABLE "pdf_downloads" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source" TEXT,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdf_downloads_product_id_downloaded_at_idx" ON "pdf_downloads"("product_id", "downloaded_at");

-- AddForeignKey
ALTER TABLE "pdf_downloads" ADD CONSTRAINT "pdf_downloads_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
