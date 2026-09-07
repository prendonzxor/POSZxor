"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const navLinkClassName = (isActive: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      isActive ? "bg-sky-100 text-sky-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <header className="sticky top-4 z-40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-white/90 px-4 py-3 shadow-[0_20px_60px_-34px_rgba(15,23,42,0.28)] backdrop-blur sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sm font-bold text-sky-800">
            ZA
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">FrontAdm</p>
            <p className="text-sm font-medium text-slate-900">Panel tecnico</p>
          </div>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          <Link href="/panel" className={navLinkClassName(pathname === "/panel")}>
            Inicio
          </Link>
          <Link href="/panel/coupons" className={navLinkClassName(pathname === "/panel/coupons")}>
            Gestionar cupones
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/panel/coupons"
            className="inline-flex rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Cupones
          </Link>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("authToken");
              document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
              router.push("/signin");
            }}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
