"use client";

import { StockValidationReports } from "./stock-validation-reports";
import { CashReportPanel } from "./cash-report";
import { Card } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getAnalyticsOverview,
  type AnalyticsOrdersByType,
  type AnalyticsSaleByDay,
  type AnalyticsSummary,
} from "@/api-implementations/analytics";
import { getInventory, getInventoryByBranchAndProduct } from "@/api-implementations/inventory";
import { getOrderDetails, getOrders } from "@/api-implementations/orders";
import { getProducts } from "@/api-implementations/products";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const numberFormatter = new Intl.NumberFormat("es-MX");

type BestSellingProduct = {
  productId: string;
  name: string;
  qty: number;
  total: number;
  orders: number;
};

type SalesReportPeriod = "day" | "week" | "month";

type SalesReportRow = {
  key: string;
  label: string;
  totalSells: number;
  totalOrders: number;
};

const salesReportPeriodLabels: Record<SalesReportPeriod, string> = {
  day: "Dia",
  week: "Semana",
  month: "Mes",
};

function getDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getWeekStart(date: Date) {
  const nextDate = new Date(date);
  const day = nextDate.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  nextDate.setUTCDate(nextDate.getUTCDate() + diff);
  nextDate.setUTCHours(0, 0, 0, 0);
  return nextDate;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("es-MX", { timeZone: "UTC", day: "2-digit", month: "short" });
}

function buildSalesReportRows(items: AnalyticsSaleByDay[], period: SalesReportPeriod): SalesReportRow[] {
  const rowsByKey = new Map<string, SalesReportRow>();

  for (const item of items) {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    let key = getDateKey(date);
    let label = formatShortDate(date);

    if (period === "week") {
      const weekStart = getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      key = getDateKey(weekStart);
      label = `${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`;
    }

    if (period === "month") {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      label = date.toLocaleDateString("es-MX", { timeZone: "UTC", month: "short", year: "numeric" });
    }

    const row = rowsByKey.get(key) || {
      key,
      label,
      totalSells: 0,
      totalOrders: 0,
    };

    row.totalSells += Number(item.totalSells || 0);
    row.totalOrders += Number(item.totalOrders || 0);
    rowsByKey.set(key, row);
  }

  return Array.from(rowsByKey.values()).sort((a, b) => a.key.localeCompare(b.key));
}

const reportTabs = [
  { id: "overview", label: "Ventas e inventario", description: "Resumen comercial, productos mas vendidos y ventas de los ultimos 90 dias." },
  { id: "stock", label: "Stock cero", description: "Consulta validaciones guardadas, revisa los ajustes a cero y descarga sus reportes CSV." },
  { id: "cash", label: "Caja y movimientos", description: "Revisa saldos diarios, diferencias de caja y movimientos por sucursal y periodo." },
] as const;
type ReportTab = (typeof reportTabs)[number]["id"];

export default function ReportsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [visitedTabs, setVisitedTabs] = useState<ReportTab[]>(["overview"]);
  const activateTab = (tab: ReportTab) => {
    setActiveTab(tab);
    setVisitedTabs((current) => current.includes(tab) ? current : [...current, tab]);
  };
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [salesReportPeriod, setSalesReportPeriod] = useState<SalesReportPeriod>("day");
  const [summary, setSummary] = useState<AnalyticsSummary>({
    totalSells: 0,
    totalOrders: 0,
    totalCustomers: 0,
  });
  const [productTotals, setProductTotals] = useState({
    totalCost: 0,
    totalPrice: 0,
    totalQty: 0,
  });
  const [salesByDay, setSalesByDay] = useState<AnalyticsSaleByDay[]>([]);
  const [ordersByType, setOrdersByType] = useState<AnalyticsOrdersByType[]>([]);
  const [bestSellingProducts, setBestSellingProducts] = useState<BestSellingProduct[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadReports = async () => {
      try {
        setIsLoading(true);
        const [analyticsResponse, productsResponse, inventoryResponse, paidOrdersResponse] = await Promise.all([
          getAnalyticsOverview(90),
          getProducts(),
          getInventory(),
          getOrders({ status: "paid", limit: 200 }),
        ]);
        const productById = new Map(productsResponse.products.map((product) => [product.id, product]));
        const [inventoryDetails, paidOrderDetails] = await Promise.all([
          Promise.all(
            inventoryResponse.inventory.map((item) =>
              getInventoryByBranchAndProduct(item.branchId, item.productId),
            ),
          ),
          Promise.all(paidOrdersResponse.orders.map((order) => getOrderDetails(order.id))),
        ]);

        if (!isMounted) {
          return;
        }

        setSummary(analyticsResponse.summary);
        setSalesByDay(analyticsResponse.salesByDay);
        setOrdersByType(analyticsResponse.ordersByType);
        const bestSellersByProductId = new Map<string, BestSellingProduct>();
        for (const response of paidOrderDetails) {
          for (const item of response.order.items || []) {
            const current = bestSellersByProductId.get(item.productId) || {
              productId: item.productId,
              name: item.productName || productById.get(item.productId)?.name || "Producto sin nombre",
              qty: 0,
              total: 0,
              orders: 0,
            };

            current.qty += Number(item.qty || 0);
            current.total += Number(item.total || 0);
            current.orders += 1;
            bestSellersByProductId.set(item.productId, current);
          }
        }
        setBestSellingProducts(
          Array.from(bestSellersByProductId.values())
            .sort((a, b) => b.qty - a.qty || b.total - a.total)
            .slice(0, 8),
        );
        setProductTotals(
          inventoryDetails.reduce(
            (acc, response) => {
              const inventory = response.inventory;
              const product = productById.get(inventory.productId);
              const qtyOnHand = Number(inventory.qtyOnHand || 0);

              acc.totalQty += qtyOnHand;
              acc.totalCost += qtyOnHand * Number(product?.cost || 0);
              acc.totalPrice += qtyOnHand * Number(product?.price || 0);
              return acc;
            },
            { totalCost: 0, totalPrice: 0, totalQty: 0 },
          ),
        );
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message.toLowerCase() : "";
        const isAuthError =
          message.includes("401") ||
          message.includes("token invalido") ||
          message.includes("token de autorizacion requerido") ||
          message.includes("token expirado") ||
          message.includes("autenticacion");

        if (isAuthError) {
          localStorage.removeItem("authToken");
          document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
          router.replace("/signin");
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los reportes.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadReports();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const salesTotal = Number(summary.totalSells || 0);
  const averageTicket = summary.totalOrders > 0 ? salesTotal / summary.totalOrders : 0;
  const maxDailySales = useMemo(
    () => Math.max(1, ...salesByDay.map((item) => Number(item.totalSells || 0))),
    [salesByDay],
  );
  const totalOrdersByType = useMemo(
    () => ordersByType.reduce((acc, item) => acc + Number(item.totalOrders || 0), 0),
    [ordersByType],
  );
  const salesReportRows = useMemo(
    () => buildSalesReportRows(salesByDay, salesReportPeriod),
    [salesByDay, salesReportPeriod],
  );
  const maxSalesReportTotal = useMemo(
    () => Math.max(1, ...salesReportRows.map((item) => Number(item.totalSells || 0))),
    [salesReportRows],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Reportes</h1>
          <p className="mt-2 text-sm text-gray-600">Consulta tus ventas, el inventario y la actividad de caja en un solo lugar.</p>

        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
        <div role="tablist" aria-label="Tipo de reporte" aria-orientation="horizontal" className="flex gap-1 overflow-x-auto">
          {reportTabs.map((tab, index) => <button
            key={tab.id}
            id={`report-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`report-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => activateTab(tab.id)}
            onKeyDown={(event) => {
              let nextIndex: number;
              if (event.key === "ArrowRight") nextIndex = (index + 1) % reportTabs.length;
              else if (event.key === "ArrowLeft") nextIndex = (index - 1 + reportTabs.length) % reportTabs.length;
              else if (event.key === "Home") nextIndex = 0;
              else if (event.key === "End") nextIndex = reportTabs.length - 1;
              else return;
              event.preventDefault();
              activateTab(reportTabs[nextIndex].id);
              document.getElementById(`report-tab-${reportTabs[nextIndex].id}`)?.focus();
            }}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${activeTab === tab.id ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
          >{tab.label}</button>)}
        </div>
      </div>
      <p className="text-sm text-gray-500">{reportTabs.find((tab) => tab.id === activeTab)?.description}</p>

      <div id="report-panel-overview" role="tabpanel" aria-labelledby="report-tab-overview" hidden={activeTab !== "overview"} tabIndex={0} className="space-y-6 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {errorMessage && <p role="alert" className="text-sm text-red-600">{errorMessage}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ventas</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoading ? "-" : currencyFormatter.format(salesTotal)}
          </p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ordenes</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoading ? "-" : numberFormatter.format(summary.totalOrders)}
          </p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ticket promedio</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoading ? "-" : currencyFormatter.format(averageTicket)}
          </p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Clientes</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoading ? "-" : numberFormatter.format(summary.totalCustomers)}
          </p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Costo inventario</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {isLoading ? "-" : currencyFormatter.format(productTotals.totalCost)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Existencia: {isLoading ? "-" : numberFormatter.format(productTotals.totalQty)}
          </p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Precio inventario</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {isLoading ? "-" : currencyFormatter.format(productTotals.totalPrice)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Existencia: {isLoading ? "-" : numberFormatter.format(productTotals.totalQty)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-800">Ventas por dia</h2>
            <span className="text-xs font-medium text-gray-500">90 dias</span>
          </div>
          <div className="mt-5 h-72">
            {isLoading ? (
              <div className="flex h-full items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Cargando reportes...
              </div>
            ) : salesByDay.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                No hay ventas para mostrar.
              </div>
            ) : (
              <div className="grid h-full grid-cols-[64px_1fr] gap-3">
                <div className="relative h-full border-r border-dashed border-gray-200 pr-2">
                  <span className="absolute left-0 top-0 text-[11px] font-medium text-gray-500">
                    {currencyFormatter.format(maxDailySales)}
                  </span>
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-500">
                    {currencyFormatter.format(maxDailySales / 2)}
                  </span>
                  <span className="absolute bottom-0 left-0 text-[11px] font-medium text-gray-500">$0</span>
                </div>
                <div className="grid h-full grid-flow-col items-end gap-1 overflow-x-auto pb-1">
                  {salesByDay.map((item) => {
                    const value = Number(item.totalSells || 0);
                    const height = Math.max(8, Math.round((value / maxDailySales) * 100));
                    const date = new Date(item.date);

                    return (
                      <div key={item.date} className="flex h-full min-w-8 flex-col justify-end">
                        <div className="group relative flex h-full items-end">
                          <div
                            className="w-full rounded-t bg-blue-600 transition-colors hover:bg-blue-700"
                            style={{ height: `${height}%` }}
                            title={currencyFormatter.format(value)}
                          />
                        </div>
                        <p className="mt-2 text-center text-[10px] font-medium text-gray-500">
                          {date.getUTCDate().toString().padStart(2, "0")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">Ordenes por tipo</h2>
          <div className="mt-5 space-y-4">
            {isLoading ? <p className="text-sm text-gray-500">Cargando reportes...</p> : null}
            {!isLoading && ordersByType.length === 0 ? (
              <p className="text-sm text-gray-500">No hay ordenes para mostrar.</p>
            ) : null}
            {!isLoading &&
              ordersByType.map((item) => {
                const totalOrders = Number(item.totalOrders || 0);
                const percentage = totalOrdersByType > 0 ? Math.round((totalOrders / totalOrdersByType) * 100) : 0;

                return (
                  <div key={item.orderType}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium capitalize text-gray-800">{item.orderType}</span>
                      <span className="text-gray-500">{percentage}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${percentage}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                      <span>{numberFormatter.format(totalOrders)} ordenes</span>
                      <span>{currencyFormatter.format(Number(item.totalSells || 0))}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>

        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Productos mas vendidos</h2>
              <p className="mt-1 text-xs text-gray-500">Calculado con las ultimas 200 ordenes pagadas.</p>
            </div>
            <span className="text-xs font-medium text-gray-500">Top {bestSellingProducts.length || 0}</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                Cargando productos...
              </div>
            ) : bestSellingProducts.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                No hay productos vendidos para mostrar.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Producto</th>
                    <th className="px-3 py-2 text-right font-semibold">Cantidad</th>
                    <th className="px-3 py-2 text-right font-semibold">Venta</th>
                    <th className="px-3 py-2 text-right font-semibold">Ordenes</th>
                  </tr>
                </thead>
                <tbody>
                  {bestSellingProducts.map((item, index) => (
                    <tr key={item.productId} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                            {index + 1}
                          </span>
                          <span className="font-medium text-gray-800">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-800">
                        {numberFormatter.format(item.qty)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {currencyFormatter.format(item.total)}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {numberFormatter.format(item.orders)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

      <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Ventas por periodo</h2>
            <p className="mt-1 text-xs text-gray-500">
              Agrupa las ventas pagadas por dia, semana o mes.
            </p>
          </div>
          <div className="inline-flex w-fit overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-1">
            {(["day", "week", "month"] as const).map((period) => (
              <button
                key={period}
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  salesReportPeriod === period
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
                onClick={() => setSalesReportPeriod(period)}
              >
                {salesReportPeriodLabels[period]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
              Cargando ventas...
            </div>
          ) : salesReportRows.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
              No hay ventas para este periodo.
            </div>
          ) : (
            <div className="min-w-[680px] space-y-3">
              {salesReportRows.map((item) => {
                const width = Math.max(6, Math.round((item.totalSells / maxSalesReportTotal) * 100));

                return (
                  <div key={item.key} className="grid grid-cols-[120px_1fr_130px_90px] items-center gap-3">
                    <span className="text-xs font-medium text-gray-600">{item.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
                    </div>
                    <span className="text-right text-sm font-semibold text-gray-900">
                      {currencyFormatter.format(item.totalSells)}
                    </span>
                    <span className="text-right text-xs text-gray-500">
                      {numberFormatter.format(item.totalOrders)} ordenes
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
      </div>
      </div>
      <div id="report-panel-stock" role="tabpanel" aria-labelledby="report-tab-stock" hidden={activeTab !== "stock"} tabIndex={0} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        {visitedTabs.includes("stock") && <StockValidationReports />}
      </div>
      <div id="report-panel-cash" role="tabpanel" aria-labelledby="report-tab-cash" hidden={activeTab !== "cash"} tabIndex={0} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        {visitedTabs.includes("cash") && <CashReportPanel />}
      </div>
    </section>
  );
}
