import type { ReactNode } from "react";
import { AuthToastProvider } from "./toast-provider";

export const metadata = {
  title: "Autenticacion Admin",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <AuthToastProvider />
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_32px_90px_-42px_rgba(15,23,42,0.4)] lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden border-r border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(241,245,249,0.92))] p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">POS Zxor Admin</p>
            <h1 className="mt-4 max-w-md text-4xl font-bold tracking-tight text-slate-950">
              Acceso tecnico para operacion interna y administracion avanzada
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Este portal esta pensado para usuarios tecnicos y administradores. Gestiona incidencias, acceso seguro y recuperacion de credenciales desde una interfaz separada del frontend comercial.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/90 bg-white/90 p-5 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.28)]">
              <p className="text-sm font-semibold text-slate-900">Que puedes hacer aqui</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li>Iniciar sesion como usuario tecnico o administrador.</li>
                <li>Generar recuperacion de contrasena por telefono.</li>
                <li>Restablecer acceso con token seguro del backend.</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-sky-100 bg-sky-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Seguridad</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Este panel usa los mismos endpoints de autenticacion que el frontend principal para evitar contratos duplicados.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-5 sm:p-8 lg:p-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
