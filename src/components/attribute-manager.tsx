"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Languages,
  Loader2,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { confirmDialog } from "@/components/confirm-dialog";
import { MultiLang } from "@/components/multi-lang";
import {
  type AttrDef,
  ATTR_KEY_RE,
  ATTR_TYPES,
  attrLabel,
} from "@/lib/attribute-defaults";
import {
  createAttribute,
  updateAttribute,
  deleteAttribute,
  reorderAttributes,
  translateAttribute,
  seedDefaultAttributes,
} from "@/app/admin/attributes/actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)]";
const inputBase = inputCls.replace("w-full ", "");
const labelCls =
  "font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-muted)]";

/** 枚举选项 chips 编辑（仿规格编辑器的认证 chips）。 */
function OptionChips({
  options,
  setOptions,
  placeholder,
}: {
  options: string[];
  setOptions: (v: string[]) => void;
  placeholder: string;
}) {
  const t = useTranslations("admin");
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const v = raw.trim();
    if (!v) return;
    if (!options.includes(v)) setOptions([...options, v]);
    setDraft("");
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((o, i) => (
        <span
          key={`${o}-${i}`}
          className="flex items-center gap-1.5 rounded-full border border-[var(--color-rule)] bg-[var(--color-surface-sunken)] py-1 pl-3 pr-1.5 font-mono text-xs text-[var(--color-ink)]"
        >
          {o}
          <button
            type="button"
            onClick={() => setOptions(options.filter((_, j) => j !== i))}
            aria-label={`${t("common.delete")} ${o}`}
            className="text-[var(--color-ink-faint)] transition hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => add(draft)}
        placeholder={placeholder}
        className={`${inputBase} w-44`}
      />
    </div>
  );
}

function AttrRow({
  attr,
  index,
  total,
  onMove,
}: {
  attr: AttrDef;
  index: number;
  total: number;
  onMove: (i: number, dir: -1 | 1) => void;
}) {
  const router = useRouter();
  const t = useTranslations("admin");
  const locale = useLocale(); // 后台界面语言；列表显示名跟随它取译名
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(attr.name);
  const [nameI18n, setNameI18n] = useState<Record<string, string>>(attr.nameI18n);
  const [unit, setUnit] = useState(attr.unit ?? "");
  const [type, setType] = useState<string>(attr.type);
  const [options, setOptions] = useState<string[]>(attr.options);
  const [pending, start] = useTransition();
  const [translating, startTr] = useTransition();

  const typeLabel = t(
    type === "number" ? "attr.typeNumber" : type === "select" ? "attr.typeSelect" : "attr.typeText",
  );

  function save() {
    start(async () => {
      try {
        await updateAttribute(attr.id, { name, nameI18n, unit, type, options });
        toast.success(t("attr.saved"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.saveFail"));
      }
    });
  }

  function translate() {
    startTr(async () => {
      try {
        const res = await translateAttribute(attr.id);
        setNameI18n(res);
        toast.success(t("attr.translated"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.saveFail"));
      }
    });
  }

  async function remove() {
    if (
      !(await confirmDialog({
        message: t("attr.deleteConfirm", { name: attrLabel(attr, locale) }),
        confirmText: t("common.delete"),
        danger: true,
      }))
    )
      return;
    start(async () => {
      try {
        await deleteAttribute(attr.id);
        toast.success(t("common.deleted"));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.saveFail"));
      }
    });
  }

  const translatedCount = Object.keys(attr.nameI18n).length;

  return (
    <div className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)]">
      {/* 头行 */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--color-ink-faint)] transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="truncate text-sm font-medium text-[var(--color-ink)]">
            {attrLabel(attr, locale)}
          </span>
          <span className="rounded bg-[var(--color-surface-sunken)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-ink-muted)]">
            {attr.key}
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)] sm:inline">
            {typeLabel}
            {attr.unit ? ` · ${attr.unit}` : ""}
            {attr.type === "select" ? ` · ${attr.options.length}` : ""}
          </span>
          <span
            className={`ml-auto hidden shrink-0 font-mono text-[10px] sm:inline ${
              translatedCount >= 8
                ? "text-[var(--color-ink-faint)]"
                : "text-amber-600"
            }`}
          >
            {translatedCount}/8
          </span>
        </button>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0 || pending}
            aria-label={t("attr.moveUp")}
            className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1 || pending}
            aria-label={t("attr.moveDown")}
            className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-[var(--color-ink)] disabled:opacity-30"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={t("common.delete")}
            className="p-1.5 text-[var(--color-ink-faint)] transition hover:text-red-500 disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 展开编辑 */}
      {open && (
        <div className="space-y-4 border-t border-[var(--color-rule)] px-4 py-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className={labelCls}>{t("attr.nameLabel")}</label>
              <button
                type="button"
                onClick={translate}
                disabled={translating}
                className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-ink-muted)] transition hover:text-[var(--color-ink)] disabled:opacity-50"
              >
                {translating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Languages className="h-3.5 w-3.5" />
                )}
                {t("attr.translate")}
              </button>
            </div>
            <MultiLang
              source={name}
              setSource={setName}
              i18n={nameI18n}
              setI18n={setNameI18n}
              placeholder={t("attr.namePh")}
            />
            <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">
              {t("attr.nameHint")}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className={labelCls}>{t("attr.typeLabel")}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`${inputBase} mt-1.5 block`}
              >
                {ATTR_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {t(
                      tp === "number"
                        ? "attr.typeNumber"
                        : tp === "select"
                          ? "attr.typeSelect"
                          : "attr.typeText",
                    )}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("attr.unitLabel")}</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t("attr.unitPh")}
                className={`${inputBase} mt-1.5 block w-28`}
              />
            </div>
          </div>

          {type === "select" && (
            <div>
              <label className={labelCls}>{t("attr.optionsLabel")}</label>
              <div className="mt-2">
                <OptionChips
                  options={options}
                  setOptions={setOptions}
                  placeholder={t("attr.optionsPh")}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
                {t("attr.optionsHint")}
              </p>
            </div>
          )}

          <div className="flex justify-end border-t border-[var(--color-rule)] pt-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AttributeManager({ attrs }: { attrs: AttrDef[] }) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [list, setList] = useState(attrs);
  // router.refresh() 后与服务端数据保持同步（渲染期间派生，避免 effect 级联渲染）
  const [prevAttrs, setPrevAttrs] = useState(attrs);
  if (prevAttrs !== attrs) {
    setPrevAttrs(attrs);
    setList(attrs);
  }
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("text");
  const [unit, setUnit] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
    start(async () => {
      try {
        await reorderAttributes(next.map((a) => a.id));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.saveFail"));
        router.refresh();
      }
    });
  }

  function create() {
    if (!ATTR_KEY_RE.test(key.trim())) {
      toast.error(t("attr.keyHint"));
      return;
    }
    start(async () => {
      try {
        await createAttribute({ key, name, unit, type, options });
        toast.success(t("attr.created"));
        setKey("");
        setName("");
        setUnit("");
        setType("text");
        setOptions([]);
        setAdding(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.saveFail"));
      }
    });
  }

  function seed() {
    start(async () => {
      try {
        const n = await seedDefaultAttributes();
        toast.success(t("attr.seeded", { n }));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.saveFail"));
      }
    });
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={seed}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-rule)] px-3.5 py-2 text-sm text-[var(--color-ink-soft)] transition hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("attr.seedDefaults")}
        </button>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3.5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("attr.addTitle")}
        </button>
      </div>

      {/* 新增表单 */}
      {adding && (
        <div className="mt-4 space-y-4 rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className={labelCls}>{t("attr.keyLabel")}</label>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t("attr.keyPh")}
                className={`${inputBase} mt-1.5 block w-44 font-mono`}
              />
              <p className="mt-1 max-w-56 text-[11px] text-[var(--color-ink-faint)]">
                {t("attr.keyHint")}
              </p>
            </div>
            <div className="min-w-56 flex-1">
              <label className={labelCls}>{t("attr.nameLabel")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("attr.namePh")}
                className={`${inputCls} mt-1.5`}
              />
              <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">
                {t("attr.nameHint")}
              </p>
            </div>
            <div>
              <label className={labelCls}>{t("attr.typeLabel")}</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`${inputBase} mt-1.5 block`}
              >
                {ATTR_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {t(
                      tp === "number"
                        ? "attr.typeNumber"
                        : tp === "select"
                          ? "attr.typeSelect"
                          : "attr.typeText",
                    )}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("attr.unitLabel")}</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={t("attr.unitPh")}
                className={`${inputBase} mt-1.5 block w-28`}
              />
            </div>
          </div>

          {type === "select" && (
            <div>
              <label className={labelCls}>{t("attr.optionsLabel")}</label>
              <div className="mt-2">
                <OptionChips
                  options={options}
                  setOptions={setOptions}
                  placeholder={t("attr.optionsPh")}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-ink-faint)]">
                {t("attr.optionsHint")}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--color-rule)] pt-3">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-[var(--color-rule)] px-4 py-2 text-sm text-[var(--color-ink-soft)] transition hover:text-[var(--color-ink)]"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={create}
              disabled={pending || !key.trim() || !name.trim()}
              className="rounded-lg bg-[var(--color-ink)] px-5 py-2 text-sm font-medium text-[var(--color-surface)] transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? t("common.saving") : t("attr.create")}
            </button>
          </div>
        </div>
      )}

      {/* 列表 */}
      {list.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--color-rule)] py-14 text-center text-sm text-[var(--color-ink-muted)]">
          {t("attr.empty")}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {list.map((a, i) => (
            <AttrRow key={a.id} attr={a} index={i} total={list.length} onMove={move} />
          ))}
        </div>
      )}
    </div>
  );
}
