"use client";
import { useServerTime } from "../server-time-provider";
import { serverTimeZone } from "@/lib/server-time";
import { Card } from "@heroui/react";

export function AppSidebarBrand() {
  const now = useServerTime();
  const buildDate = now.toLocaleDateString("es-MX", { timeZone: serverTimeZone(), day: "2-digit", month: "short", year: "numeric" });

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-blue-400/40 bg-linear-to-br from-blue-600 via-blue-700 to-indigo-700 p-4 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-7 -top-7 h-20 w-20 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-indigo-300/20" />
      <div className="relative">
        <p className="text-lg font-semibold tracking-tight">POS Zxor</p>
        <p className="mt-1 text-xs text-blue-100">Plataforma de gestion para tu punto de venta</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/10 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-100">Fecha</p>
            <p className="mt-1 text-xs font-medium text-white">{buildDate}</p>
          </div>
          <div className="rounded-lg bg-white/10 px-2 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-100">Version</p>
            <p className="mt-1 text-xs font-medium text-white">v0.1.0</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
