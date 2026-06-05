import { notFound } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AccentSwatchPicker } from "@/components/accent-swatch-picker";
import { ACCENT_SWATCHES } from "@/components/accent-swatches";

export const dynamic = "force-dynamic";

const OKLCH_RE = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/;
const ALLOWED_ACCENTS = new Set(ACCENT_SWATCHES.map((s) => s.value));

function s(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function saveFactory(formData: FormData) {
  "use server";
  const id = s(formData, "id");
  if (!id) throw new Error("missing id");

  const name = s(formData, "name");
  if (!name) throw new Error("name required");

  const accentRaw = s(formData, "accentColor");
  let accentColor: string | null = null;
  if (accentRaw) {
    if (!OKLCH_RE.test(accentRaw) || !ALLOWED_ACCENTS.has(accentRaw)) {
      throw new Error("invalid accent color");
    }
    accentColor = accentRaw;
  }

  await prisma.factory.update({
    where: { id },
    data: {
      name,
      brandShort: s(formData, "brandShort") || null,
      logoUrl: s(formData, "logoUrl") || null,
      contactEmail: s(formData, "contactEmail") || null,
      contactWhatsapp: s(formData, "contactWhatsapp") || null,
      inquiryNote: s(formData, "inquiryNote") || null,
      accentColor,
    },
  });

  revalidatePath("/admin/factory");
  revalidatePath(`/admin/factory/${id}`);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminFactoryEditPage({ params }: PageProps) {
  const { id } = await params;
  const factory = await prisma.factory.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!factory) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/factory"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
        >
          <ArrowLeft className="h-3 w-3" />
          All factories
        </Link>
        <h1 className="headline-lg mt-3 text-[26px] text-[var(--color-ink)]">
          {factory.name}
        </h1>
        <p className="mt-1 font-mono text-xs text-[var(--color-ink-muted)]">
          {factory.slug} · {factory._count.products} products
        </p>
      </div>

      <form action={saveFactory} className="space-y-7">
        <input type="hidden" name="id" value={factory.id} />

        <Section title="Brand · 品牌">
          <Field
            label="Name · 全称"
            help="工厂正式名称，公开页脚 © 行使用"
          >
            <input
              name="name"
              required
              defaultValue={factory.name}
              className="form-input"
            />
          </Field>
          <Field
            label="Brand Short · 顶栏简称"
            help="如 SYSLED / LUMOS·LED，建议 ≤ 12 个字符"
          >
            <input
              name="brandShort"
              defaultValue={factory.brandShort ?? ""}
              className="form-input"
            />
          </Field>
          <Field
            label="Logo URL"
            help="粘贴 logo 图片直链；上传通道待 R2 配置后启用"
          >
            <input
              name="logoUrl"
              type="url"
              placeholder="https://…/logo.svg"
              defaultValue={factory.logoUrl ?? ""}
              className="form-input"
            />
          </Field>
        </Section>

        <Section title="Theme · 主色">
          <Field
            label="Accent · 品牌色"
            help="租户品牌色，运行时注入产品页 --color-accent（用于工厂标识等品牌元素）。"
          >
            <AccentSwatchPicker
              name="accentColor"
              initial={factory.accentColor}
            />
          </Field>
        </Section>

        <Section title="Contact · 联系方式">
          <Field
            label="Email"
            help="询盘按钮的 mailto 目标"
          >
            <input
              name="contactEmail"
              type="email"
              defaultValue={factory.contactEmail ?? ""}
              className="form-input"
            />
          </Field>
          <Field
            label="WhatsApp"
            help="E.164 格式，如 +8613800001234"
          >
            <input
              name="contactWhatsapp"
              defaultValue={factory.contactWhatsapp ?? ""}
              placeholder="+86 138 0000 1234"
              className="form-input font-mono"
            />
          </Field>
          <Field
            label="Inquiry Note · 询盘区文案"
            help="显示在询盘按钮上方一行，可写「24h 回复 / 支持 OEM」等"
          >
            <textarea
              name="inquiryNote"
              rows={3}
              defaultValue={factory.inquiryNote ?? ""}
              className="form-input resize-y"
            />
          </Field>
        </Section>

        <div className="flex items-center gap-3 border-t border-[var(--color-rule)] pt-5">
          <button type="submit" className="appbtn">
            Save changes
          </button>
          <Link
            href="/admin/factory"
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)]"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-2xl bg-[var(--color-surface-sunken)] p-6 sm:grid-cols-[160px_1fr] sm:p-7">
      <h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink)] sm:pt-2">
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-[var(--color-ink)]">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {help && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-ink-muted)]">
          {help}
        </p>
      )}
    </div>
  );
}
