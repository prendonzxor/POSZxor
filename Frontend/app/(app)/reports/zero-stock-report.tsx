"use client";
import { serverTimeZone } from "@/lib/server-time";
import { Button, Card } from "@heroui/react";
import type { StockValidationReport } from "@/api-implementations/inventory";

export function downloadZeroStockCsv(report: StockValidationReport) {
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return `"${(typeof value === "string" && /^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replace(/"/g, '""')}"`;
  };
  const header = ["Reporte", "Fecha", "Sucursal", "Periodo", "Producto", "SKU", "Codigo", "Stock anterior", "Stock final", "Ajuste"];
  const lines = report.snapshot.items.filter((item) => item.omitted).map((item) => [report.id, report.createdAt, report.snapshot.branchName, report.snapshot.periodKey, item.name, item.sku, item.barcode, item.previousQty, 0, item.differenceQty]);
  const blob = new Blob(["\uFEFF", [header, ...lines].map((line) => line.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = `stock-cero-${report.snapshot.periodKey}-${report.id}.csv`;
  document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ZeroStockReport({ report }: { report: StockValidationReport }) {
  const items = report.snapshot.items.filter((item) => item.omitted);
  return <Card className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-gray-900">Reporte: productos fuera del conteo con stock cero</h2><p className="mt-1 text-sm text-gray-600">{report.snapshot.branchName} · {report.snapshot.periodKey} · {new Date(report.createdAt).toLocaleString("es-MX", { timeZone: serverTimeZone() })}</p><p className="mt-1 text-xs text-gray-500">Reporte {report.id} · {items.length} productos ({items.filter((item) => item.previousQty !== 0).length} con cambio de stock).</p></div><Button onPress={() => downloadZeroStockCsv(report)}>Descargar CSV de stock cero</Button></div>
    <div className="mt-4 max-h-96 overflow-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50"><tr>{["Producto", "SKU", "Codigo", "Stock anterior", "Stock final", "Ajuste"].map((label) => <th scope="col" key={label} className="whitespace-nowrap px-3 py-2 text-left">{label}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.productId} className="border-t border-gray-100"><td className="px-3 py-2">{item.name}</td><td className="px-3 py-2">{item.sku || "—"}</td><td className="px-3 py-2">{item.barcode || "—"}</td><td className="px-3 py-2">{item.previousQty.toFixed(3)}</td><td className="px-3 py-2 font-semibold">0.000</td><td className="px-3 py-2">{item.differenceQty.toFixed(3)}</td></tr>)}</tbody></table>{items.length === 0 && <p className="py-4 text-sm text-gray-500">Todos los productos estaban en el conteo. No se asigno cero a productos fuera de la lista.</p>}</div>
  </Card>;
}
