"use client";

import { useCallback, useState } from "react";

type Accept = "image" | "any";

/**
 * 通用拖拽上传 hook：给任意容器加上"把文件拖进来即上传"的能力。
 * 返回 dragging（是否正悬停拖拽，用于高亮）和绑到容器上的事件 props。
 * 拖入的文件经类型过滤后通过 onFiles 回调交给调用方处理。
 */
export function useFileDrop(
  onFiles: (files: File[]) => void,
  opts?: { accept?: Accept; disabled?: boolean },
) {
  const [dragging, setDragging] = useState(false);
  const accept = opts?.accept ?? "any";
  const disabled = opts?.disabled ?? false;

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      setDragging(true);
    },
    [disabled],
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // 进入子元素时不取消高亮，只有真正离开容器才取消，避免闪烁
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragging(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      setDragging(false);
      let files = Array.from(e.dataTransfer.files ?? []);
      if (accept === "image") {
        files = files.filter((f) => f.type.startsWith("image/"));
      }
      if (files.length) onFiles(files);
    },
    [accept, disabled, onFiles],
  );

  return { dragging, dropProps: { onDragOver, onDragLeave, onDrop } };
}
