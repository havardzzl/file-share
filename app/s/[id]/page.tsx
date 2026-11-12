import { notFound } from "next/navigation";
import { Download, File, FileText, Link2, ShieldCheck } from "lucide-react";
import { Brand, Footer } from "@/components/icons";
import { TextPreview } from "@/components/text-preview";
import { getShare } from "@/lib/shares";
import { HttpError } from "@/lib/http";
import { formatBytes } from "@/lib/shared";
export const dynamic = "force-dynamic";
export const metadata = { title: "查看分享" };
export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let share;
  try {
    share = await getShare((await params).id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const isText = share.kind === "text";
  return (
    <div className="site-shell share-shell">
      <header className="header">
        <Brand />
        <span className="private-label">
          <Link2 size={14} /> 一份与你分享的内容
        </span>
      </header>
      <main
        className={`public-main ${share.kind === "text" ? "public-text" : ""}`}
      >
        <div className="eyebrow">A LITTLE SOMETHING FOR YOU</div>
        <section className="card public-card">
          <div className="public-icon">
            {isText ? (
              <FileText size={30} strokeWidth={1.5} />
            ) : (
              <File size={34} strokeWidth={1.5} />
            )}
          </div>
          <h1>{share.filename}</h1>
          <div className="public-meta">
            <span>{isText ? "文本分享" : "文件分享"}</span>
            <span>·</span>
            <span>{formatBytes(share.size_bytes)}</span>
            <span>·</span>
            <span>
              {share.expires_at
                ? `${new Date(share.expires_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} 到期（北京时间）`
                : "永久有效"}
            </span>
          </div>
          {isText ? (
            <TextPreview id={share.id} />
          ) : (
            <div className="public-actions">
              <a
                href={`/api/shares/${share.id}/download`}
                className="button button-primary"
              >
                <Download size={18} />
                下载文件
              </a>
            </div>
          )}
          <p className="compose-note">
            <ShieldCheck size={14} />
            由分享者提供 · 请确认来源后下载
          </p>
        </section>
        <p className="quiet-note">把文件和文字，放进一个链接。</p>
      </main>
      <Footer />
    </div>
  );
}
