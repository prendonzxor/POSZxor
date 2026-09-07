"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@heroui/react";
import { useRouter } from "next/navigation";
import { getAnalyticsOverview, type AnalyticsOrdersByType, type AnalyticsSaleByDay } from "@/api-implementations/analytics";
import { getNotifications, type Notification } from "@/api-implementations/notifications";

const relativeTimeFormatter = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });
const salesDayFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: "UTC",
  weekday: "short",
});

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }

  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }

  return relativeTimeFormatter.format(diffDays, "day");
}

export default function DashboardPage() {
  
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalSells: 0,
    totalOrders: 0,
    totalCustomers: 0,
  });
  const [salesByDay, setSalesByDay] = useState<AnalyticsSaleByDay[]>([]);
  const [ordersByType, setOrdersByType] = useState<AnalyticsOrdersByType[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const handleAuthError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isAuthError =
      message.includes("401") ||
      message.includes("token invalido") ||
      message.includes("token de autorizacion requerido") ||
      message.includes("token expirado") ||
      message.includes("autenticacion");

    if (!isAuthError) {
      return false;
    }
    
    localStorage.removeItem("authToken");
    document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
    router.replace("/signin");
    return true;
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      try {
        setIsLoading(true);
        const [analyticsResponse, notificationsResponse] = await Promise.all([
          getAnalyticsOverview(7),
          getNotifications({ status: "unread", limit: 4 }),
        ]);

        if (!isMounted) return;
        setSummary(analyticsResponse.summary);
        setSalesByDay(analyticsResponse.salesByDay);
        setOrdersByType(analyticsResponse.ordersByType);
        setNotifications(notificationsResponse.notifications);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) return;
        if (handleAuthError(error)) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las metricas.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadAnalytics();
    return () => {
      isMounted = false;
    };
  }, [handleAuthError]);

  const salesBars = useMemo(() => {
    if (salesByDay.length === 0) {
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const fullDate = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");

        return {
          label: salesDayFormatter.format(new Date(`${fullDate}T00:00:00.000Z`)).replace(".", ""),
          value: 0,
          fullDate,
        };
      });
    }

    return salesByDay.map((item) => {
      const fullDate = item.date.slice(0, 10);
      return {
        label: salesDayFormatter.format(new Date(`${fullDate}T00:00:00.000Z`)).replace(".", ""),
        value: Number(item.totalSells || 0),
        fullDate,
      };
    });
  }, [salesByDay]);

  const orderBars = useMemo(() => {
    if (salesByDay.length === 0) {
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const fullDate = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");

        return {
          label: salesDayFormatter.format(new Date(`${fullDate}T00:00:00.000Z`)).replace(".", ""),
          value: 0,
          fullDate,
        };
      });
    }

    return salesByDay.map((item) => {
      const fullDate = item.date.slice(0, 10);
      return {
        label: salesDayFormatter.format(new Date(`${fullDate}T00:00:00.000Z`)).replace(".", ""),
        value: Number(item.totalOrders || 0),
        fullDate,
      };
    });
  }, [salesByDay]);

  const ordersByChannel = useMemo(() => {
    const totalOrders = ordersByType.reduce((acc, item) => acc + Number(item.totalOrders || 0), 0);
    if (totalOrders === 0) {
      return [];
    }

    return ordersByType.map((item) => ({
      name: item.orderType,
      value: Math.round((Number(item.totalOrders || 0) / totalOrders) * 100),
    }));
  }, [ordersByType]);

  const salesBarsMax = useMemo(
    () => Math.max(1, ...salesBars.map((item) => Number(item.value || 0))),
    [salesBars],
  );
  const orderBarsMax = useMemo(
    () => Math.max(1, ...orderBars.map((item) => Number(item.value || 0))),
    [orderBars],
  );

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Bienvenido al panel principal de la aplicacion.
          </p>
        </div>
        {errorMessage ? (
          <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="min-h-32 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">Ventas totales</h2>
          <p className="mt-3 text-3xl font-bold text-gray-950">
            {isLoading ? "-" : `$${Number(summary.totalSells || 0).toFixed(2)}`}
          </p>
          <p className="mt-2 text-xs font-medium text-gray-500">Ultimos 7 dias</p>
        </Card>
        <Card className="min-h-32 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700">Ordenes</h2>
          <p className="mt-3 text-3xl font-bold text-gray-950">{isLoading ? "-" : summary.totalOrders}</p>
          <p className="mt-2 text-xs font-medium text-gray-500">Total de ordenes</p>
        </Card>
        <Card className="min-h-32 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:col-span-2 xl:col-span-1">
          <h2 className="text-sm font-semibold text-gray-700">Clientes</h2>
          <p className="mt-3 text-3xl font-bold text-gray-950">{isLoading ? "-" : summary.totalCustomers}</p>
          <p className="mt-2 text-xs font-medium text-gray-500">Clientes activos</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
        <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Tendencia de ventas (7 dias)</h2>
            <span className="text-xs font-medium text-gray-500">
              Total: {isLoading ? "-" : `$${Number(summary.totalSells || 0).toFixed(2)}`}
            </span>
          </div>
          <div className="mt-4">
            <div className="h-64 w-full rounded-xl bg-gray-50 p-4">
              <div className="grid h-full grid-cols-[64px_1fr] gap-3">
                <div className="relative h-full border-r border-dashed border-gray-200 pr-2">
                  <span className="absolute left-0 top-0 text-[11px] font-medium text-gray-500">
                    ${salesBarsMax.toFixed(0)}
                  </span>
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-500">
                    ${(salesBarsMax / 2).toFixed(0)}
                  </span>
                  <span className="absolute left-0 bottom-0 text-[11px] font-medium text-gray-500">
                    $0
                  </span>
                </div>

                <div className="grid h-full grid-cols-7 items-end gap-2">
                  {salesBars.map((item, index) => {
                    const ratio = Math.max(0, Number(item.value || 0)) / salesBarsMax;
                    const height = Math.max(8, Math.round(ratio * 100));
                    return (
                      <div key={`${item.fullDate}-${index}`} className="flex h-full flex-col justify-end">
                        <div className="group relative flex h-full items-end">
                          <div
                            className="w-full rounded-t-md bg-blue-500/90 transition-all duration-200 hover:bg-blue-600"
                            style={{ height: `${height}%` }}
                            title={`$${Number(item.value || 0).toFixed(2)}`}
                          />
                          <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-0.5 text-[10px] text-white group-hover:block">
                            ${Number(item.value || 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-2 text-center text-[11px] font-medium uppercase text-gray-500">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Ordenes por dia (7 dias)</h2>
            <span className="text-xs font-medium text-gray-500">
              Total: {isLoading ? "-" : summary.totalOrders}
            </span>
          </div>
          <div className="mt-4">
            <div className="h-64 w-full rounded-xl bg-gray-50 p-4">
              <div className="grid h-full grid-cols-[64px_1fr] gap-3">
                <div className="relative h-full border-r border-dashed border-gray-200 pr-2">
                  <span className="absolute left-0 top-0 text-[11px] font-medium text-gray-500">
                    {orderBarsMax.toFixed(0)}
                  </span>
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-500">
                    {(orderBarsMax / 2).toFixed(0)}
                  </span>
                  <span className="absolute left-0 bottom-0 text-[11px] font-medium text-gray-500">
                    0
                  </span>
                </div>

                <div className="grid h-full grid-cols-7 items-end gap-2">
                  {orderBars.map((item, index) => {
                    const ratio = Math.max(0, Number(item.value || 0)) / orderBarsMax;
                    const height = Math.max(8, Math.round(ratio * 100));
                    return (
                      <div key={`${item.fullDate}-${index}`} className="flex h-full flex-col justify-end">
                        <div className="group relative flex h-full items-end">
                          <div
                            className="w-full rounded-t-md bg-emerald-500/90 transition-all duration-200 hover:bg-emerald-600"
                            style={{ height: `${height}%` }}
                            title={`${Number(item.value || 0).toFixed(0)} ordenes`}
                          />
                          <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-0.5 text-[10px] text-white group-hover:block">
                            {Number(item.value || 0).toFixed(0)}
                          </span>
                        </div>
                        <p className="mt-2 text-center text-[11px] font-medium uppercase text-gray-500">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Card>
        </div>

        <div className="space-y-6">
        <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-semibold text-gray-700">Ordenes por canal</h2>
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-gray-500">Cargando distribucion...</p>
            ) : null}
            {!isLoading && ordersByChannel.length === 0 ? (
              <p className="text-sm text-gray-500">Sin ordenes para mostrar.</p>
            ) : null}
            {ordersByChannel.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                  <span>{item.name}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

      <Card className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Notificaciones</h2>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
            {notifications.length} nuevas
          </span>
        </div>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">{formatRelativeTime(notification.createdAt)}</span>
              </div>
            </div>
          ))}
          {!isLoading && notifications.length === 0 ? (
            <p className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              No hay notificaciones pendientes.
            </p>
          ) : null}
        </div>
      </Card>
        </div>
      </div>
    </section>
  );
}
