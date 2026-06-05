-- AlterTable
ALTER TABLE "factories" ADD COLUMN     "default_locale" TEXT NOT NULL DEFAULT 'zh-CN',
ADD COLUMN     "supported_locales" TEXT[] DEFAULT ARRAY['zh-CN', 'en']::TEXT[];
