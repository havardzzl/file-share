"use client";
import { useEffect, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { MAX_BYTES } from "@/lib/shared";

// Read large text directly from Storage so a 5MB document never passes through
// Vercel's response body or gets duplicated into server-rendered HTML/RSC.
export function TextPreview({ id }: { id: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/shares/${id}/download`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("分享已过期或暂时无法读取，请稍后重试。");
        const blob = await response.blob();
        if (blob.size > MAX_BYTES) throw new Error("内容超出大小限制。");
        const content = new TextDecoder("utf-8", { fatal: true }).decode(
          await blob.arrayBuffer(),
        );
        if (!controller.signal.aborted) {
          setText(content);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message);
      }
    }
    void load();
    return () => controller.abort();
  }, [id, attempt]);
  return (
    <>
      {error ? (
        <div role="alert" className="text-load-state">
          <p className="error-message">{error}</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setError("");
              setAttempt((a) => a + 1);
            }}
          >
            重新加载
          </button>
        </div>
      ) : text === null ? (
        <div className="text-load-state" role="status">
          <LoaderCircle size={18} className="spin" />
          正在读取文本…
        </div>
      ) : (
        <pre className="shared-text">{text}</pre>
      )}
      <div className="public-actions">
        {text !== null && (
          <CopyButton
            value={text}
            label="复制文本"
            className="button button-primary"
          />
        )}
        <a
          href={`/api/shares/${id}/download`}
          className="button button-secondary"
        >
          <Download size={18} />
          下载文本
        </a>
      </div>
    </>
  );
}
