"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
export function CopyButton({
  value,
  label = "复制",
  className = "button button-secondary",
  origin = false,
}: {
  value: string;
  label?: string;
  className?: string;
  origin?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        origin ? window.location.origin + value : value,
      );
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
    }
  }
  return (
    <button className={className} onClick={copy} type="button">
      {state === "copied" ? <Check size={16} /> : <Copy size={16} />}
      <span>
        {state === "copied"
          ? "已复制"
          : state === "error"
            ? "复制失败，请手动复制"
            : label}
      </span>
    </button>
  );
}
