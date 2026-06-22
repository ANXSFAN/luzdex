/**
 * 后台内容区加载骨架。后台各页都是 force-dynamic(每次导航都现查),
 * 没有它的话切换时内容区会空白阻塞到查询跑完——这层骨架让切换即时有反馈。
 * 侧边栏在 layout 里不受影响,只有这块 children 区域显示骨架。
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* 标题 + 副标题占位 */}
      <div className="h-7 w-48 rounded-md bg-[var(--color-surface-sunken)]" />
      <div className="mt-3 h-4 w-72 max-w-full rounded bg-[var(--color-surface-sunken)]" />

      {/* 内容行占位 */}
      <div className="mt-8 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface-sunken)]/60"
          />
        ))}
      </div>
    </div>
  );
}
