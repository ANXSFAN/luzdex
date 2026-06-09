-- CreateTable
CREATE TABLE "compat_rules" (
    "id" TEXT NOT NULL,
    "factory_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "from_category_id" TEXT NOT NULL,
    "to_category_id" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'accessory',
    "bidirectional" BOOLEAN NOT NULL DEFAULT false,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "auto_link" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compat_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compat_rules_factory_id_idx" ON "compat_rules"("factory_id");

-- CreateIndex
CREATE INDEX "compat_rules_from_category_id_idx" ON "compat_rules"("from_category_id");

-- CreateIndex
CREATE INDEX "compat_rules_to_category_id_idx" ON "compat_rules"("to_category_id");

-- AddForeignKey
ALTER TABLE "compat_rules" ADD CONSTRAINT "compat_rules_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compat_rules" ADD CONSTRAINT "compat_rules_from_category_id_fkey" FOREIGN KEY ("from_category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compat_rules" ADD CONSTRAINT "compat_rules_to_category_id_fkey" FOREIGN KEY ("to_category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
