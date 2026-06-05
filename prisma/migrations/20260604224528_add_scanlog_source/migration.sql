-- AlterTable
ALTER TABLE "scan_logs" ADD COLUMN     "source" TEXT;

-- CreateIndex
CREATE INDEX "scan_logs_product_id_source_idx" ON "scan_logs"("product_id", "source");
