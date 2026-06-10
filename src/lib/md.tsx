import type { ReactNode } from "react";

/**
 * 轻量 Markdown 子集渲染（零依赖、纯 React 元素输出，无 HTML 注入面）。
 * 供后台「更高编辑自由度」：产品描述 / 图文详情文本块 / 系列简介。
 *
 * 支持：**粗体**、*斜体*、`代码`、[链接](https://…)；
 * 块级：空行分段、- / * 无序列表、1. 有序列表、## / ### 小标题。
 * 纯文本完全向后兼容（无标记时按原段落渲染）；译文走字符串管线，语法天然保留。
 */

const INLINE_RE =
  /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2] !== undefined) {
      out.push(
        <strong key={key} className="font-semibold text-[var(--color-ink)]">
          {m[2]}
        </strong>
      );
    } else if (m[4] !== undefined) {
      out.push(
        <em key={key} className="italic">
          {m[4]}
        </em>
      );
    } else if (m[6] !== undefined) {
      out.push(
        <code
          key={key}
          className="rounded bg-[var(--color-surface-sunken)] px-1 py-0.5 font-mono text-[0.88em]"
        >
          {m[6]}
        </code>
      );
    } else if (m[8] !== undefined) {
      out.push(
        <a
          key={key}
          href={m[9]}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline underline-offset-2 transition hover:opacity-70"
        >
          {m[8]}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  // 块级按行扫描：列表行聚簇，其余行按空行分段。
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flushPara = () => {
    const text = para.join("\n").trim();
    if (text) blocks.push({ kind: "p", text });
    para = [];
  };
  for (const line of lines) {
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const h = /^\s*#{2,3}\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "ul") prev.items.push(ul[1]);
      else blocks.push({ kind: "ul", items: [ul[1]] });
    } else if (ol) {
      flushPara();
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "ol") prev.items.push(ol[1]);
      else blocks.push({ kind: "ol", items: [ol[1]] });
    } else if (h) {
      flushPara();
      blocks.push({ kind: "h", text: h[1] });
    } else if (!line.trim()) {
      flushPara();
    } else {
      para.push(line);
    }
  }
  flushPara();
  return blocks;
}

/** 渲染 markdown 子集为 React 节点。外层自带 space-y 段距，文字色继承容器。 */
export function renderMarkdown(src: string | null | undefined): ReactNode {
  if (!src?.trim()) return null;
  const blocks = parseBlocks(src);
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          return (
            <p
              key={i}
              className="pt-1 text-[1.02em] font-semibold text-[var(--color-ink)]"
            >
              {renderInline(b.text, `h${i}`)}
            </p>
          );
        }
        if (b.kind === "ul" || b.kind === "ol") {
          const items = b.items.map((it, j) => (
            <li key={j}>{renderInline(it, `${i}-${j}`)}</li>
          ));
          return b.kind === "ul" ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {items}
            </ul>
          ) : (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {items}
            </ol>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {renderInline(b.text, `p${i}`)}
          </p>
        );
      })}
    </div>
  );
}

/** 去掉 markdown 标记取纯文本（PDF / 海报 / meta 等纯文本场景用）。 */
export function stripMarkdown(src: string | null | undefined): string {
  if (!src) return "";
  return src
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*#{2,3}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ");
}
