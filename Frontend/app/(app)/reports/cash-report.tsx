"use client";

import { serverCalendarDate } from "@/lib/server-time";

import { useEffect, useState } from "react";
import { Button, Card } from "@heroui/react";
import { getCashReport, type CashReport } from "@/api-implementations/cash-register";
import { getBranches, type Branch } from "@/api-implementations/branches";
import { useTenantRuntime } from "../tenant-runtime-context";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
function dateInput(date: Date) { return date.toISOString().slice(0, 10); }
const movementLabels = { opening: "Apertura", sale: "Venta en efectivo", closing: "Cierre / efectivo contado" };
export function CashReportPanel() {
  const { tenant } = useTenantRuntime();
  const [from, setFrom] = useState(() => { const date = serverCalendarDate(); date.setUTCDate(date.getUTCDate() - 29); return dateInput(date); });
  const [to, setTo] = useState(() => dateInput(serverCalendarDate()));
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filters, setFilters] = useState({ from, to, branchId, page: 1, revision: 0 });
  const [report, setReport] = useState<CashReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    getBranches().then((result) => { if (mounted) setBranches(result.branches); }).catch(() => { /* All-branch report remains available. */ });
    return () => { mounted = false; };
  }, [tenant?.id]);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const result = await getCashReport(filters);
        if (mounted) setReport(result);
      } catch (cause) {
        if (mounted) { setReport(null); setError(cause instanceof Error ? cause.message : "No se pudo cargar la caja."); }
      } finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, [filters, tenant?.id]);
  const timestamp = (date: string) => new Date(date).toLocaleString("es-MX", { timeZone: report?.timezone });
  const amount = (value: number | null) => value === null ? "—" : currency.format(value);
  return <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <h2 className="text-base font-semibold text-gray-900">Balance de caja por dia</h2>
    <p className="mt-1 text-sm text-gray-600">Balance por dia, sucursal y sesion. Las sesiones que continuan al dia siguiente conservan su saldo inicial.</p>
    <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
      event.preventDefault();
      if (from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 89) { setError("Selecciona un periodo valido de hasta 90 dias."); return; }
      setFilters({ from, to, branchId, page: 1, revision: filters.revision + 1 });
    }}>
      <label className="flex flex-col gap-1 text-sm">Desde<input type="date" required value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" /></label>
      <label className="flex flex-col gap-1 text-sm">Hasta<input type="date" required value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2" /></label>
      <label className="flex flex-col gap-1 text-sm">Sucursal<select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2"><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <Button type="submit" isDisabled={loading}>Consultar</Button>
    </form>
    {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
    {loading ? <p role="status" className="mt-5 text-sm text-gray-500">Cargando balance y movimientos...</p> : report && <>
      <p className="mt-4 text-xs text-gray-500">Zona horaria: {report.timezone}. Solo efectivo de ordenes vinculadas a caja; pagos mixtos excluidos. Ventas canceladas aparecen con importe neto cero. Los balances se recalculan con el estado actual de las ordenes; los cierres conservan su balance guardado.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full whitespace-nowrap text-sm">
          <caption className="sr-only">Balance diario por sesion de caja</caption>
          <thead className="border-b border-gray-200 text-xs uppercase text-gray-500"><tr>{["Dia", "Sucursal / sesion", "Saldo inicial", "Ventas efectivo", "Esperado", "Contado al cierre", "Diferencia", "Estado al final del dia"].map((label, index) => <th key={label} scope="col" className={`px-3 py-2 ${index < 2 || index === 7 ? "text-left" : "text-right"}`}>{label}</th>)}</tr></thead>
          <tbody>{report.daily.map((row) => <tr key={`${row.date}:${row.sessionId}`} className="border-b border-gray-100">
            <td className="px-3 py-3">{row.date}</td><td className="px-3 py-3">{row.branchName}<span className="block text-xs text-gray-500">Apertura: {timestamp(row.openedAt)}</span><span className="block text-xs text-gray-500">{row.sessionId.slice(0, 8)}</span></td>
            <td className="px-3 py-3 text-right">{amount(row.openingCash)}</td><td className="px-3 py-3 text-right">{amount(row.cashSales)}<span className="block text-xs text-gray-500">{row.cashOrders} ventas</span></td><td className="px-3 py-3 text-right font-medium">{amount(row.expectedCash)}</td><td className="px-3 py-3 text-right">{amount(row.countedCash)}</td><td className={`px-3 py-3 text-right ${row.difference && row.difference < 0 ? "text-red-600" : "text-gray-800"}`}>{amount(row.difference)}</td><td className="px-3 py-3">{row.status === "closed" ? "Cerrada" : "Abierta"}</td>
          </tr>)}</tbody>
        </table>
        {report.daily.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No hay sesiones de caja en este periodo.</p>}
      </div>
      <h3 className="mt-6 text-sm font-semibold text-gray-800">Movimientos de caja</h3>
      <p className="mt-1 text-xs text-gray-500">Las aperturas indican el fondo inicial y los cierres el conteo final; no representan ventas ni retiros.</p>
      <div className="mt-3 overflow-x-auto"><table className="min-w-full whitespace-nowrap text-sm">
        <caption className="sr-only">Movimientos de caja del periodo</caption>
        <thead className="border-b border-gray-200 text-xs uppercase text-gray-500"><tr>{["Fecha y hora", "Sucursal / sesion", "Movimiento", "Referencia / responsable", "Importe"].map((label, index) => <th scope="col" key={label} className={`px-3 py-2 ${index === 4 ? "text-right" : "text-left"}`}>{label}</th>)}</tr></thead>
        <tbody>{report.movements.map((row) => <tr key={row.id} className="border-b border-gray-100"><td className="px-3 py-3">{timestamp(row.at)}</td><td className="px-3 py-3">{row.branchName}<span className="block text-xs text-gray-500">{row.sessionId.slice(0, 8)}</span></td><td className="px-3 py-3">{row.type === "sale" && row.status === "cancelled" ? "Venta cancelada" : movementLabels[row.type]}</td><td className="px-3 py-3">{row.reference}</td><td className="px-3 py-3 text-right">{amount(row.amount)}</td></tr>)}</tbody>
      </table>{report.movements.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No hay movimientos en este periodo.</p>}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{report.totalMovements} movimientos · Pagina {report.page} de {Math.max(1, Math.ceil(report.totalMovements / report.pageSize))}</span><div className="flex gap-2"><Button isDisabled={report.page <= 1} onPress={() => setFilters({ ...filters, page: report.page - 1 })}>Anterior</Button><Button isDisabled={report.page * report.pageSize >= report.totalMovements} onPress={() => setFilters({ ...filters, page: report.page + 1 })}>Siguiente</Button></div></div>
    </>}
  </Card>;
}
