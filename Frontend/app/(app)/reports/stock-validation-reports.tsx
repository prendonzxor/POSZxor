"use client";
import { serverTimeZone } from "@/lib/server-time";

import { useEffect, useState } from "react";
import { Button, Card } from "@heroui/react";
import { listStockValidationReports, type StockValidationReport } from "@/api-implementations/inventory";
import { ZeroStockReport } from "./zero-stock-report";
import { useTenantRuntime } from "../tenant-runtime-context";

export function StockValidationReports() {
  const { tenant } = useTenantRuntime();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [reports, setReports] = useState<StockValidationReport[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const response = await listStockValidationReports(page);
        if (!active) return;
        setReports(response.reports); setTotal(response.total);
        setSelectedId(response.reports[0]?.id || "");
      } catch (cause) {
        if (active) { setReports([]); setError(cause instanceof Error ? cause.message : "No se pudieron cargar los reportes."); }
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [page, revision, tenant?.id]);
  const selected = reports.find((report) => report.id === selectedId);
  return <section className="space-y-4" aria-label="Reportes de productos con stock cero">
    <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-gray-900">Reportes de stock cero</h2><p className="mt-1 text-sm text-gray-600">Consulta los productos fuera del conteo, su stock anterior y el ajuste a cero. Selecciona una validacion para ver el reporte y descargar su CSV.</p></div><Button isDisabled={loading} onPress={() => setRevision((value) => value + 1)}>Actualizar</Button></div>
      {loading ? <p role="status" className="mt-4 text-sm text-gray-500">Cargando reportes de stock...</p> : error ? <p role="alert" className="mt-4 text-sm text-red-600">{error}</p> : reports.length === 0 ? <p className="mt-4 text-sm text-gray-500">No hay reportes de stock cero guardados.</p> : <>
        <label className="mt-4 flex flex-col gap-1 text-sm font-medium">Validacion de stock<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2">{reports.map((report) => <option key={report.id} value={report.id}>{report.snapshot.branchName} · {report.snapshot.periodKey} · {new Date(report.createdAt).toLocaleString("es-MX", { timeZone: serverTimeZone() })} · {report.id.slice(0, 8)}</option>)}</select></label>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>{total} reportes · Pagina {page} de {Math.max(1, Math.ceil(total / 5))}</span><div className="flex gap-2"><Button isDisabled={page <= 1} onPress={() => setPage((value) => value - 1)}>Anterior</Button><Button isDisabled={page * 5 >= total} onPress={() => setPage((value) => value + 1)}>Siguiente</Button></div></div>
      </>}
    </Card>
    {!loading && !error && selected && <ZeroStockReport report={selected} />}
  </section>;
}
