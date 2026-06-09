-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name_i18n" JSONB;

-- AlterTable
ALTER TABLE "series" ADD COLUMN     "intro_i18n" JSONB,
ADD COLUMN     "name_i18n" JSONB;
