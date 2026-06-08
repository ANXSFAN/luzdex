-- 9-language i18n：默认语言改西语 es，支持全部 9 语言。
-- AlterTable: 改列默认值
ALTER TABLE "factories" ALTER COLUMN "default_locale" SET DEFAULT 'es';
ALTER TABLE "factories" ALTER COLUMN "supported_locales" SET DEFAULT ARRAY['es', 'en', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'zh']::TEXT[];

-- 迁移既有数据：旧 locale 码 zh-CN → zh；默认语言统一为 es；支持语言扩到全 9 种。
UPDATE "factories" SET "default_locale" = 'es';
UPDATE "factories" SET "supported_locales" = ARRAY['es', 'en', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'zh']::TEXT[];

-- 历史扫码日志里的 locale 串归一（zh-CN → zh），保证统计口径一致。
UPDATE "scan_logs" SET "locale" = 'zh' WHERE "locale" = 'zh-CN';
