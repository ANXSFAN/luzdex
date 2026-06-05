-- CreateTable
CREATE TABLE "scan_logs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "country" TEXT,
    "locale" TEXT,

    CONSTRAINT "scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_clicks" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_logs_product_id_scanned_at_idx" ON "scan_logs"("product_id", "scanned_at");

-- CreateIndex
CREATE INDEX "inquiry_clicks_product_id_clicked_at_idx" ON "inquiry_clicks"("product_id", "clicked_at");

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_clicks" ADD CONSTRAINT "inquiry_clicks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
