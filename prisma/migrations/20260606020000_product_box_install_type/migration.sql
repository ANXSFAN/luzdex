-- AlterTable
ALTER TABLE "products" ADD COLUMN     "luminaire_type" TEXT,
ADD COLUMN     "box_contents" JSONB,
ADD COLUMN     "install" JSONB;
