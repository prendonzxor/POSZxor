"use client";
import { serverTimeZone } from "@/lib/server-time";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@heroui/react";

import { getCashRegister, openCashRegister, closeCashRegister, type RegisterState } from "@/api-implementations/cash-register";

export function useCashRegister(tenantId: string | undefined, branchId: string) {
  const [state, setState] = useState<RegisterState & { key: string }>({ active: null, lastClosed: null, key: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const key = tenantId && branchId ? `${tenantId}:${branchId}` : "";
  const currentKey = useRef(key);
  currentKey.current = key;
  const refresh = useCallback(async () => {
    if (!key) return;
    try {
      const result = await getCashRegister(branchId);
      if (currentKey.current !== key) return;
      setState({ ...result, key }); setError("");
    } catch (cause) {
      if (currentKey.current === key) setError(cause instanceof Error ? cause.message : "No se pudo consultar la caja.");
    }
  }, [key, branchId]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 15000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [refresh]);
  const active = state.key === key ? state.active : null;
  return {
    active, lastClosed: state.key === key ? state.lastClosed : null, error, loading,
    ready: Boolean(key && state.key === key && !error), refresh,
    requireOpen: () => {
      if (!active || error) throw new Error(error || "Abre la caja antes de crear una venta.");
    },
    open: async (openingBalance: number) => {
      setLoading(true);
      try { await openCashRegister(branchId, openingBalance); }
      finally { await refresh(); setLoading(false); }
    },
    close: async (countedCash: number) => {
      if (!active) throw new Error("No hay caja abierta.");
      setLoading(true);
      try { await closeCashRegister(branchId, active.id, countedCash); }
      finally { await refresh(); setLoading(false); }
    },
  };
}

export function CashRegisterPanel({ register, busy }: { register: ReturnType<typeof useCashRegister>; busy: boolean }) {
  const [mode, setMode] = useState<"open" | "close" | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const { active, lastClosed } = register;
  const expected = active ? active.expectedCash : 0;
  const money = (value: number) => `$${value.toFixed(2)}`;
  return (
    <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Caja {active ? "abierta" : "cerrada"}</h2>
          <p className="text-sm text-gray-600">{active ? `Apertura: ${new Date(active.openedAt).toLocaleString("es-MX", { timeZone: serverTimeZone() })}` : "Abre la caja para comenzar a vender."}</p>
        </div>
        <Button isDisabled={busy || register.loading || !register.ready} onPress={() => { setMode(active ? "close" : "open"); setAmount(""); setError(""); }}>
          {active ? "Cerrar caja" : "Abrir caja"}
        </Button>
      </div>
      
      {active && <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <p>Fondo inicial: <strong>{money(active.openingBalance)}</strong></p>
        <p>Ventas: <strong>{active.saleCount}</strong></p>
        <p>Efectivo esperado: <strong>{money(expected)}</strong></p>
      </div>}
      
      {mode && <form className="mt-4 space-y-3 border-t border-gray-200 pt-4" onSubmit={async (event) => {
        event.preventDefault();
        if (busy || register.loading || !register.ready) return;
        const value = Number(amount);
        if (!amount.trim() || !Number.isFinite(value) || value < 0 || Math.abs(Math.round(value * 100) - value * 100) > 0.000001) {
          setError("Ingresa un monto valido, mayor o igual a cero, con hasta dos decimales."); return;
        }
        try {
          if (mode === "open") await register.open(value); else await register.close(value);
          setMode(null); setError("");
        } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la caja."); }
      }}>
        <label htmlFor="register-amount" className="block text-sm font-medium">{mode === "open" ? "Fondo inicial en efectivo" : "Efectivo contado al cierre"}</label>
        <input autoFocus id="register-amount" type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 sm:max-w-xs" />
        {mode === "close" && <p className="text-sm">Efectivo esperado: {money(expected)}{amount !== "" && Number.isFinite(Number(amount)) ? ` · Diferencia: ${money(Number(amount) - expected)}` : ""}</p>}
        <div className="flex gap-2">
          <Button type="submit" isDisabled={busy || register.loading}>{mode === "open" ? "Confirmar apertura" : "Confirmar cierre"}</Button>
          <Button type="button" isDisabled={register.loading} onPress={() => { setMode(null); setError(""); }}>Cancelar</Button>
        </div>
      </form>}
      {register.error && <Button onPress={() => { void register.refresh(); }}>Reintentar</Button>}
      {(error || register.error) && <p role="alert" className="mt-3 text-sm text-red-600">{error || register.error}</p>}
    </Card>
  );
}
