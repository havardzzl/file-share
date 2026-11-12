"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  ExternalLink,
  File,
  FileText,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Brand, Footer } from "@/components/icons";
import { CopyButton } from "@/components/copy-button";
import {
  formatBytes,
  isExpired,
  MAX_BYTES,
  type ShareSummary,
} from "@/lib/shared";

type UploadState = {
  stage: "idle" | "uploading" | "done";
  progress: number;
  id?: string;
};
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("share-session-expired"));
    throw new Error(data.error || "请求失败，请稍后重试。");
  }
  return data;
}
function uploadBlob(
  url: string,
  blob: Blob,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 120000;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 95));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error("文件上传失败，请检查存储配置后重试。"));
    xhr.onerror = () => reject(new Error("网络连接失败，请检查网络后重试。"));
    xhr.ontimeout = () => reject(new Error("上传超时，请重试。"));
    xhr.send(blob);
  });
}
function date(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

export function Workspace({
  configured,
  authenticated,
}: {
  configured: boolean;
  authenticated: boolean;
}) {
  const [loggedIn, setLoggedIn] = useState(authenticated);
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [kind, setKind] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [expiresIn, setExpiresIn] = useState(7);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [upload, setUpload] = useState<UploadState>({
    stage: "idle",
    progress: 0,
  });
  const [shares, setShares] = useState<ShareSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ShareSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadLock = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const textBytes = new Blob([text]).size;
  const busy = upload.stage === "uploading";

  const loadShares = useCallback(async (offset = 0) => {
    setLoading(true);
    setListError("");
    try {
      const data = await api<{ shares: ShareSummary[]; total: number }>(
        `/api/shares?offset=${offset}`,
      );
      setShares((prev) => (offset ? [...prev, ...data.shares] : data.shares));
      setTotal(data.total);
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!loggedIn) return;
    const timer = setTimeout(() => void loadShares(), 0);
    return () => clearTimeout(timer);
  }, [loggedIn, loadShares]);
  useEffect(() => {
    const expired = () => {
      setLoggedIn(false);
      setShares([]);
      setTotal(0);
    };
    window.addEventListener("share-session-expired", expired);
    return () => window.removeEventListener("share-session-expired", expired);
  }, []);
  useEffect(() => {
    if (loginOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [loginOpen]);
  useEffect(() => {
    if (deleteTarget) deleteDialogRef.current?.showModal();
    else deleteDialogRef.current?.close();
  }, [deleteTarget]);

  function chooseFile(selected: File | undefined) {
    setError("");
    if (!selected) return;
    if (!selected.size) {
      setError("暂不支持空文件，请选择有内容的文件。");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("文件超过 5MB，请选择更小的文件。");
      return;
    }
    setFile(selected);
  }
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      await api("/api/auth", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setLoggedIn(true);
      setLoginOpen(false);
      setPassword("");
    } catch (e) {
      setLoginError((e as Error).message);
    } finally {
      setLoginBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/api/auth", { method: "DELETE" });
      setLoggedIn(false);
      setShares([]);
      setTotal(0);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function submit() {
    if (!configured || uploadLock.current) return;
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }
    setError("");
    const blob =
      kind === "file"
        ? file
        : new Blob([text], { type: "text/plain;charset=utf-8" });
    if (!blob?.size || (kind === "text" && !text.trim())) {
      setError(kind === "file" ? "请先选择一个文件。" : "请先输入一段文本。");
      return;
    }
    if (blob.size > MAX_BYTES) {
      setError("内容不能超过 5MB。");
      return;
    }
    uploadLock.current = true;
    setUpload({ stage: "uploading", progress: 0 });
    let pendingId: string | undefined;
    try {
      const filename =
        kind === "file" ? file!.name : `${title.trim() || "未命名文本"}.txt`;
      const prepared = await api<{ id: string; uploadUrl: string }>(
        "/api/shares/prepare",
        {
          method: "POST",
          body: JSON.stringify({ filename, kind, size: blob.size, expiresIn }),
        },
      );
      pendingId = prepared.id;
      await uploadBlob(prepared.uploadUrl, blob, (progress) =>
        setUpload({ stage: "uploading", progress }),
      );
      await api(`/api/shares/${prepared.id}/complete`, { method: "POST" });
      setShareUrl(`${window.location.origin}/s/${prepared.id}`);
      setUpload({ stage: "done", progress: 100, id: prepared.id });
      void loadShares();
    } catch (e) {
      setError((e as Error).message);
      setUpload({ stage: "idle", progress: 0 });
      if (pendingId)
        void api(`/api/shares/${pendingId}`, { method: "DELETE" }).catch(
          () => {},
        );
    } finally {
      uploadLock.current = false;
    }
  }
  async function deleteShare() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/shares/${deleteTarget.id}`, { method: "DELETE" });
      if (upload.id === deleteTarget.id) reset();
      setDeleteTarget(null);
      void loadShares();
    } catch (e) {
      setListError((e as Error).message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }
  function reset() {
    setUpload({ stage: "idle", progress: 0 });
    setShareUrl("");
    setFile(null);
    setText("");
    setTitle("");
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }
  return (
    <div className="site-shell">
      <header className="header">
        <Brand />
        <div className="header-right">
          <span className="private-label">
            <span className="status-dot" /> 个人分享空间
          </span>
          {loggedIn ? (
            <button
              className="button button-ghost button-small"
              onClick={logout}
              disabled={busy}
            >
              <LogOut size={15} />
              退出
            </button>
          ) : (
            <button
              className="button button-secondary button-small"
              disabled={!configured}
              onClick={() => setLoginOpen(true)}
            >
              <LockKeyhole size={14} />
              管理登录
            </button>
          )}
        </div>
      </header>
      <main className="workspace-main">
        <section className="hero">
          <div className="eyebrow">
            <span className="tiny-line" /> A LITTLE SPACE TO SHARE
          </div>
          <h1>
            把文件和文字，
            <br className="mobile-break" />
            放进一个
            <span className="highlight">
              链接。
              <svg viewBox="0 0 180 12" aria-hidden="true">
                <path d="M2 8Q85 0 178 7" />
              </svg>
            </span>
          </h1>
          <p>上传一个文件，或留下一段文字。让分享简单一点。</p>
        </section>
        {!configured && (
          <div className="setup-notice" role="status">
            <CircleHelp size={20} />
            <div>
              <strong>只差最后一步，连接你的存储空间</strong>
              <p>
                按照项目 README 配置 Supabase
                和环境变量，然后重新启动或部署，即可开始分享。
              </p>
            </div>
          </div>
        )}
        <div className="workspace-grid">
          <section className="card compose-card" aria-label="创建分享">
            <div className="card-heading">
              <div>
                <span className="section-index">01 / CREATE</span>
                <h2>新建分享</h2>
              </div>
              <span className="badge">最大 5MB</span>
            </div>
            {upload.stage === "done" ? (
              <div className="success-pane" aria-live="polite">
                <div className="success-mark">
                  <Check size={28} />
                </div>
                <h3>链接准备好了</h3>
                <p>把它发送出去，分享就这么简单。</p>
                <div className="share-url">
                  <Link2 size={17} />
                  <input
                    readOnly
                    aria-label="分享链接"
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="success-actions">
                  <CopyButton
                    value={shareUrl}
                    label="复制链接"
                    className="button button-primary"
                  />
                  <a
                    className="button button-secondary"
                    href={`/s/${upload.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    打开链接
                    <ExternalLink size={15} />
                  </a>
                </div>
                <button className="text-button" onClick={reset}>
                  <Plus size={15} />
                  再分享一份
                </button>
              </div>
            ) : (
              <>
                <div className="tabs" role="tablist" aria-label="分享类型">
                  <button
                    id="file-tab"
                    role="tab"
                    aria-selected={kind === "file"}
                    aria-controls="compose-panel"
                    className={kind === "file" ? "tab active" : "tab"}
                    onClick={() => {
                      setKind("file");
                      setError("");
                    }}
                    disabled={busy}
                  >
                    <Upload size={17} />
                    上传文件
                  </button>
                  <button
                    id="text-tab"
                    role="tab"
                    aria-selected={kind === "text"}
                    aria-controls="compose-panel"
                    className={kind === "text" ? "tab active" : "tab"}
                    onClick={() => {
                      setKind("text");
                      setError("");
                    }}
                    disabled={busy}
                  >
                    <FileText size={17} />
                    粘贴文本
                  </button>
                </div>
                <div
                  id="compose-panel"
                  role="tabpanel"
                  aria-labelledby={`${kind}-tab`}
                >
                  {kind === "file" ? (
                    <>
                      <input
                        ref={fileInput}
                        type="file"
                        className="visually-hidden"
                        id="file-input"
                        tabIndex={-1}
                        disabled={busy}
                        onChange={(e) => {
                          chooseFile(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      <div
                        className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!busy) setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragging(false);
                          if (!busy) {
                            if (e.dataTransfer.files.length > 1)
                              setError("一次只能分享一个文件。");
                            else chooseFile(e.dataTransfer.files[0]);
                          }
                        }}
                      >
                        {file ? (
                          <>
                            <div className="file-art">
                              <File size={30} strokeWidth={1.4} />
                            </div>
                            <strong className="chosen-name">{file.name}</strong>
                            <span>{formatBytes(file.size)} · 已准备好</span>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => fileInput.current?.click()}
                            >
                              重新选择
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="upload-art">
                              <ArrowDownToLine size={27} strokeWidth={1.6} />
                              <span className="art-spark spark-one" />
                              <span className="art-spark spark-two" />
                            </div>
                            <strong>拖拽文件到这里</strong>
                            <span>
                              或者
                              <button
                                className="inline-button"
                                onClick={() => fileInput.current?.click()}
                                disabled={busy}
                              >
                                选择文件
                              </button>
                              上传
                            </span>
                            <small>支持任意格式 · 单个文件不超过 5MB</small>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-editor">
                      <label className="visually-hidden" htmlFor="text-title">
                        文本标题（选填）
                      </label>
                      <input
                        id="text-title"
                        className="title-input"
                        placeholder="给这段文字起个名字（选填）"
                        value={title}
                        maxLength={160}
                        disabled={busy}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                      <label className="visually-hidden" htmlFor="text-content">
                        分享的文本内容
                      </label>
                      <textarea
                        id="text-content"
                        placeholder="在这里写下，或粘贴你想分享的内容…"
                        value={text}
                        disabled={busy}
                        onChange={(e) => setText(e.target.value)}
                      />
                      <div
                        className={`editor-footer ${textBytes > MAX_BYTES ? "over-limit" : ""}`}
                      >
                        <span>纯文本 · 保留换行与空格</span>
                        <span>{formatBytes(textBytes)} / 5MB</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="options-row">
                  <label htmlFor="expiry">
                    <Clock3 size={16} />
                    链接有效期
                  </label>
                  <select
                    id="expiry"
                    value={expiresIn}
                    disabled={busy}
                    onChange={(e) => setExpiresIn(Number(e.target.value))}
                  >
                    <option value={1}>1 天</option>
                    <option value={7}>7 天</option>
                    <option value={30}>30 天</option>
                    <option value={0}>永久有效</option>
                  </select>
                </div>
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button button-primary create-button"
                  disabled={!configured || busy}
                  onClick={submit}
                >
                  {busy ? (
                    <>
                      <LoaderCircle size={18} className="spin" />
                      {upload.progress >= 95
                        ? "正在生成链接…"
                        : `正在上传 ${upload.progress}%`}
                    </>
                  ) : (
                    <>
                      <Link2 size={18} />
                      生成分享链接
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
                {busy && (
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="上传进度"
                    aria-valuenow={upload.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${upload.progress}%` }} />
                  </div>
                )}
                <p className="compose-note">
                  <ShieldCheck size={13} />
                  {loggedIn
                    ? "只有获得链接的人可以访问内容"
                    : "登录后即可创建分享，访客无需登录"}
                </p>
              </>
            )}
          </section>
          <aside className="side-column">
            <section className="how-card">
              <span className="section-index">SMALL THINGS, SHARED.</span>
              <div className="link-illustration" aria-hidden="true">
                <div className="paper paper-back">
                  <FileText size={30} strokeWidth={1.25} />
                </div>
                <div className="paper paper-front">
                  <Link2 size={34} strokeWidth={1.5} />
                </div>
                <span className="illustration-dot" />
              </div>
              <h2>分享，无需多一步。</h2>
              <p>
                从你的设备，到对方的浏览器。
                <br />
                一个链接，刚刚好。
              </p>
              <div className="how-divider" />
              <div className="how-step">
                <span>1</span>
                <div>
                  <strong>放入内容</strong>
                  <p>文件、笔记、代码，随手分享</p>
                </div>
              </div>
              <div className="how-step">
                <span>2</span>
                <div>
                  <strong>复制链接</strong>
                  <p>无需注册，即可查看或下载</p>
                </div>
              </div>
              <div className="aside-note">
                <LockKeyhole size={14} />
                <span>你的空间，由你管理</span>
              </div>
            </section>
            <p className="quiet-note">轻量、私有，只装下需要分享的那一点。</p>
          </aside>
        </div>
        <section className="history-section">
          <div className="history-heading">
            <div>
              <span className="section-index">02 / LIBRARY</span>
              <h2>
                我的分享 <span className="count">{loggedIn ? total : "—"}</span>
              </h2>
            </div>
            <span className="history-hint">
              {loggedIn ? "管理你分享的每一份内容" : "登录后查看和管理"}
            </span>
          </div>
          {listError && (
            <div className="list-error" role="alert">
              {listError}
              <button className="text-button" onClick={() => loadShares()}>
                重试
              </button>
            </div>
          )}
          {!loggedIn ? (
            <div className="empty-library">
              <div className="empty-icon">
                <LockKeyhole size={23} strokeWidth={1.4} />
              </div>
              <div>
                <strong>这里是你的私人分享清单</strong>
                <p>登录管理空间，查看已分享的文件和文字。</p>
              </div>
              <button
                className="button button-secondary button-small"
                disabled={!configured}
                onClick={() => setLoginOpen(true)}
              >
                进入管理
                <ArrowRight size={14} />
              </button>
            </div>
          ) : loading && !shares.length ? (
            <div className="empty-library">
              <LoaderCircle size={20} className="spin" />
              正在加载分享…
            </div>
          ) : !shares.length ? (
            <div className="empty-library">
              <div className="empty-icon">
                <Link2 size={24} />
              </div>
              <div>
                <strong>第一份分享，从这里开始</strong>
                <p>生成链接后，你的分享记录会出现在这里。</p>
              </div>
            </div>
          ) : (
            <>
              <div className="share-list">
                {shares.map((share) => (
                  <div className="share-row" key={share.id}>
                    <div
                      className={`row-icon ${share.kind === "text" ? "text-icon" : ""}`}
                    >
                      {share.kind === "text" ? (
                        <FileText size={21} />
                      ) : (
                        <File size={21} />
                      )}
                    </div>
                    <div className="row-info">
                      <a
                        href={`/s/${share.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {share.filename}
                      </a>
                      <span>
                        {formatBytes(share.size_bytes)}
                        <span className="meta-dot">·</span>
                        {date(share.created_at)} 创建
                        <span className="meta-dot">·</span>
                        <span
                          className={
                            isExpired(share.expires_at) ? "expired" : ""
                          }
                        >
                          {isExpired(share.expires_at)
                            ? "已过期"
                            : share.expires_at
                              ? `${date(share.expires_at)} 到期`
                              : "永久有效"}
                        </span>
                      </span>
                    </div>
                    <div className="row-actions">
                      {!isExpired(share.expires_at) && (
                        <CopyButton
                          value={`/s/${share.id}`}
                          origin
                          label="复制链接"
                          className="button button-ghost button-small"
                        />
                      )}
                      <button
                        className="icon-button delete-button"
                        aria-label={`删除 ${share.filename}`}
                        onClick={() => setDeleteTarget(share)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {shares.length < total && (
                <button
                  className="button button-secondary load-more"
                  disabled={loading}
                  onClick={() => loadShares(shares.length)}
                >
                  {loading ? "加载中…" : "加载更多"}
                </button>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
      <dialog
        ref={dialogRef}
        className="modal"
        onCancel={() => setLoginOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLoginOpen(false);
        }}
        aria-labelledby="login-title"
      >
        <div className="modal-content">
          <button
            className="icon-button modal-close"
            onClick={() => setLoginOpen(false)}
            aria-label="关闭"
          >
            <X size={20} />
          </button>
          <div className="modal-icon">
            <LockKeyhole size={25} />
          </div>
          <h2 id="login-title">欢迎回到你的空间</h2>
          <p>输入管理员密码，开始分享。</p>
          <form onSubmit={login}>
            <label htmlFor="password">管理员密码</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              maxLength={1024}
              placeholder="输入 Supabase 账号密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {loginError && (
              <p className="error-message" role="alert">
                {loginError}
              </p>
            )}
            <button
              className="button button-primary"
              type="submit"
              disabled={loginBusy}
            >
              {loginBusy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <ArrowRight size={17} />
              )}
              进入管理空间
            </button>
          </form>
          <small>仅管理员可上传，分享链接可直接访问。</small>
        </div>
      </dialog>
      <dialog
        ref={deleteDialogRef}
        className="modal"
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        aria-labelledby="delete-title"
      >
        <div className="modal-content">
          <h2 id="delete-title">删除这份分享？</h2>
          <p className="break-word">{deleteTarget?.filename}</p>
          <p>文件和分享链接会被删除，已经签发的下载地址最多还可访问 60 秒。</p>
          <div className="success-actions">
            <button
              className="button button-secondary"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </button>
            <button
              className="button button-danger"
              disabled={deleting}
              onClick={deleteShare}
            >
              {deleting ? "删除中…" : "确认删除"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
