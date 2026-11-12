"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="public-main">
      <section className="card public-card">
        <h1>暂时无法读取内容</h1>
        <p className="not-found-copy">服务连接出了点问题，请稍后重试。</p>
        <button className="button button-primary" onClick={reset}>
          重新加载
        </button>
      </section>
    </main>
  );
}
