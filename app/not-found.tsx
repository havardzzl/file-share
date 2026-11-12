import Link from "next/link";
import { Unlink } from "lucide-react";
import { Brand, Footer } from "@/components/icons";
export default function NotFound() {
  return (
    <div className="site-shell share-shell">
      <header className="header">
        <Brand />
      </header>
      <main className="public-main">
        <section className="card public-card">
          <div className="public-icon">
            <Unlink size={32} strokeWidth={1.4} />
          </div>
          <h1>这份分享已不在这里</h1>
          <p className="not-found-copy">
            链接可能已过期、被删除，或地址不完整。
            <br />
            请联系分享者获取新的链接。
          </p>
          <Link href="/" className="button button-primary">
            回到首页
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
