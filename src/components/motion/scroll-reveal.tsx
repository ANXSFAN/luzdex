"use client";

import { useEffect, useRef } from "react";
import type { ElementType, ReactNode } from "react";

type Variant = "up" | "rise" | "fade";

interface Props {
  as?: ElementType;
  variant?: Variant;
  delay?: number;
  className?: string;
  children: ReactNode;
  threshold?: number;
  once?: boolean;
}

/**
 * Scroll-driven reveal. Toggles data-reveal / data-revealed attributes that
 * the CSS in globals.css animates. Honours prefers-reduced-motion via that
 * same stylesheet (the [data-reveal] override). Server-rendered children stay
 * in the DOM; only opacity/transform animate.
 */
export function ScrollReveal({
  as: Tag = "div",
  variant = "up",
  delay = 0,
  className,
  children,
  threshold = 0.15,
  once = true,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.setAttribute("data-revealed", "true");
            if (once) io.unobserve(e.target);
          } else if (!once) {
            e.target.removeAttribute("data-revealed");
          }
        });
      },
      { threshold, rootMargin: "0px 0px -10% 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, once]);

  return (
    <Tag
      ref={ref as never}
      data-reveal={variant}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
