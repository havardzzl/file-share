import Link from "next/link";
import { Files, ArrowUpRight } from "lucide-react";
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${small ? "brand-small" : ""}`}
      aria-label="拾享首页"
    >
      <span className="brand-mark">
        <Files size={21} strokeWidth={1.7} />
      </span>
      <span>
        拾享<span className="brand-en"> / SHARE</span>
      </span>
    </Link>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <span>简单存放，轻松分享。</span>
      <a
        href="https://github.com/havardzzl/file-share"
        target="_blank"
        rel="noreferrer"
      >
        开源小工具 <ArrowUpRight size={13} />
      </a>
    </footer>
  );
}
