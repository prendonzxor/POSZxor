"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { serverNow, synchronizeServerTime } from "@/lib/server-time";
const ServerTimeContext = createContext<Date | null>(null);
export function useServerTime() {
  const now = useContext(ServerTimeContext);
  if (!now) throw new Error("ServerTimeProvider es requerido.");
  return now;
}
export function ServerTimeProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const sync = useCallback(async () => {
    try { await synchronizeServerTime(); setNow(serverNow()); setError(""); }
    catch { setError("No se pudo sincronizar la fecha y hora del servidor."); }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => { void sync(); }, 0);
    const refresh = window.setInterval(() => { void sync(); }, 60000);
    const tick = window.setInterval(() => { try { setNow(serverNow()); } catch { /* Initial sync is still pending. */ } }, 30000);
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    const onFocus = () => { void sync(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); window.clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); };
  }, [sync]);
  if (!now) return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6"><div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm"><p role={error ? "alert" : "status"} className="text-sm text-gray-700">{error || "Sincronizando fecha y hora del servidor..."}</p>{error && <button type="button" onClick={() => { void sync(); }} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Reintentar</button>}</div></main>;
  return <ServerTimeContext.Provider value={now}>{children}</ServerTimeContext.Provider>;
}
