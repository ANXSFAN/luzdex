-- AlterTable: 内容层多语言（按语言的内容包 + 源语言标记）
ALTER TABLE "products" ADD COLUMN     "source_locale" TEXT DEFAULT 'zh',
ADD COLUMN     "content_i18n" JSONB;
