"use client";

import { Button } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AdminNavbar } from "@/app/components/admin-navbar";

export default function PanelPage() {
  const router = useRouter();

  useEffect(() => {
    const token = window.localStorage.getItem("authToken") || "";
    if (!token) {
      router.replace("/signin");
    }
  }, [router]);

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <AdminNavbar />

        <section className="rounded-[32px] border border-slate-200 bg-white/95 p-8 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700">FrontAdm</p>
              <h1 className="mt-4 text-3xl font-bold text-slate-950">Panel tecnico</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Administra configuraciones operativas internas desde un punto central. El modulo de promociones ya vive en una pagina dedicada para mantener el panel mas ordenado y escalable.
              </p>
            </div>
            <Link href="/panel/coupons">
              <Button className="h-12 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white">
                Gestionar cupones
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Promociones</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">Cupones y descuentos</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Crea y actualiza cupones para ordenes y suscripciones, prueba validaciones y prepara promociones por plan.
            </p>
            <Link
              href="/panel/coupons"
              className="mt-5 inline-flex text-sm font-semibold text-sky-700 underline underline-offset-4"
            >
              Abrir modulo
            </Link>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Soporte</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">Accesos internos</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Usa este portal como base para herramientas de soporte, recuperacion de credenciales y operacion administrativa.
            </p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Siguiente paso</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">Expandir modulos</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              La estructura ya esta lista para agregar vistas separadas de descuentos, usuarios internos, auditoria o soporte tecnico.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
