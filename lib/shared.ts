export const MAX_BYTES = 5 * 1024 * 1024;
export const BUCKET = "shares";
export type ShareKind = "file" | "text";
export type Share = {
  id: string;
  storage_path: string;
  filename: string;
  kind: ShareKind;
  size_bytes: number;
  status: "pending" | "ready" | "deleted";
  created_at: string;
  expires_at: string | null;
};
export type ShareSummary = Omit<Share, "storage_path">;
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function isExpired(expiresAt: string | null, now = Date.now()) {
  return expiresAt !== null && Date.parse(expiresAt) <= now;
}
export function safeFilename(value: string) {
  return (
    value
      .replace(/[\x00-\x1f\x7f/\\]/g, "_")
      .trim()
      .slice(0, 180) || "download"
  );
}
