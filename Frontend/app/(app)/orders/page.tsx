"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { getOrders, type OrderSummary } from "@/api-implementations/orders";

function formatCurrency(value: number | string | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "created" | "cancelled">("all");

  const handleAuthError = (error: unknown) => {
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
  };

  useEffect(() => {
    let isMounted = true;

    const loadOrders = async () => {
      try {
        setIsLoading(true);
        const response = await getOrders({ limit: 100 });
        if (!isMounted) return;
        setOrders(response.orders);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) return;
        if (handleAuthError(error)) return;
        setOrders([]);
        setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las ordenes.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadOrders();
    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusBadgeClasses = (status: string) => {
    if (status === "paid") return "bg-green-100 text-green-700";
    if (status === "created") return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const getStatusLabel = (status: string) => {
    if (status === "paid") return "Pagada";
    if (status === "created") return "Pendiente";
    if (status === "cancelled") return "Cancelada";
    return status;
  };

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" ? true : order.status === statusFilter;
      if (!matchesStatus) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const orderNumber = (order.numOrder || order.id || "").toLowerCase();
      const customerName = (order.customer?.fullName || order.customerId || "").toLowerCase();
      return orderNumber.includes(normalizedSearch) || customerName.includes(normalizedSearch);
    });
  }, [orders, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((acc, order) => acc + Number(order.total || 0), 0);
    return {
      total: filteredOrders.length,
      paid: filteredOrders.filter((order) => order.status === "paid").length,
      pending: filteredOrders.filter((order) => order.status === "created").length,
      revenue: totalRevenue,
    };
  }, [filteredOrders]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Ordenes</h1>
          <p className="mt-2 text-sm text-gray-600">
            Revisa y administra todas las ordenes creadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-200">
            {summary.total} orden(es)
          </span>
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            {summary.paid} pagada(s)
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            {summary.pending} pendiente(s)
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ordenes filtradas</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.total}</p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pagadas</p>
          <p className="mt-2 text-2xl font-bold text-green-700">{summary.paid}</p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pendientes</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{summary.pending}</p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ingreso (filtro actual)</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">${summary.revenue.toFixed(2)}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="w-full rounded-full border-border/60 sm:min-w-[280px]"
          placeholder="Buscar por numero de orden o cliente..."
        />
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "all" | "paid" | "created" | "cancelled")
          }
          className="h-10 rounded-full border border-default-200 bg-white px-3 text-sm text-gray-900 outline-hidden transition-colors focus:border-blue-500"
        >
          <option value="all">Todos los estados</option>
          <option value="paid">Pagada</option>
          <option value="created">Pendiente</option>
          <option value="cancelled">Cancelada</option>
        </select>
        {(searchTerm.trim() || statusFilter !== "all") && (
          <Button
            onPress={() => {
              setSearchTerm("");
              setStatusFilter("all");
            }}
            className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Mostrando <span className="font-semibold text-gray-900">{filteredOrders.length}</span> de{" "}
            <span className="font-semibold text-gray-900">{orders.length}</span> ordenes.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="hidden min-w-[1180px] grid-cols-8 gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
            <p>No. orden</p>
            <p>Cliente</p>
            <p>Total</p>
            <p>Costo</p>
            <p>Ganancia</p>
            <p>Estado</p>
            <p>Fecha</p>
            <p className="text-right">Acciones</p>
          </div>

          <div className="min-w-0 md:min-w-[1180px]">
            {isLoading ? (
              <div className="px-5 py-4 text-sm text-gray-600">Cargando ordenes...</div>
            ) : null}
            {!isLoading && errorMessage ? (
              <div className="px-5 py-4 text-sm text-red-600">{errorMessage}</div>
            ) : null}
            {!isLoading && !errorMessage && filteredOrders.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-600">No hay ordenes disponibles.</div>
            ) : null}
            {!isLoading &&
              !errorMessage &&
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid gap-2 border-b border-gray-100 px-5 py-4 text-sm text-gray-800 transition-colors hover:bg-gray-50 md:grid-cols-8 md:items-center md:gap-4"
                >
                  <p className="font-medium text-gray-900">{order.numOrder || order.id}</p>
                  <p>
                    {order.customer?.fullName
                      ? order.customer.fullName
                      : order.customerId || "-"}
                  </p>
                  <p className="font-semibold text-gray-900">{formatCurrency(order.total)}</p>
                  <p className="font-medium text-gray-700">{formatCurrency(order.cost)}</p>
                  <p className={`font-semibold ${Number(order.profit || 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {formatCurrency(order.profit)}
                  </p>
                  <p>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClasses(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </p>
                  <p>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("es-MX") : "-"}</p>
                  <div className="flex justify-start md:justify-end">
                    <Button
                      size="sm"
                      onPress={() => router.push(`/orders/${order.id}`)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                    >
                      Ver detalle
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </Card>
    </section>
  );
}
