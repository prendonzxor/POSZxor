"use client";
import { serverTimeZone } from "@/lib/server-time";

import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@heroui/react";
import { useParams, useRouter } from "next/navigation";
import { cancelOrder, getOrderDetails, type CheckoutOrderResponse } from "@/api-implementations/orders";
import { getProductById } from "@/api-implementations/products";
import { getCategories } from "@/api-implementations/categories";

type OrderItemDetails = {
  name: string | null;
  category: string | null;
  sku: string | null;
  cost: number | null;
  price: number | null;
};

function formatCurrency(value: number | string | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatPercent(value: number | string | null | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function MissingValue() {
  return (
    <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
      Requerido
    </span>
  );
}

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = useMemo(() => (params?.id ? String(params.id) : ""), [params]);

  const [order, setOrder] = useState<CheckoutOrderResponse | null>(null);
  const [itemDetailsByProductId, setItemDetailsByProductId] = useState<Record<string, OrderItemDetails>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAuthError = (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isAuthError =
      message.includes("401") ||
      message.includes("token invalido") ||
      message.includes("token de autorizacion requerido") ||
      message.includes("token expirado") ||
      message.includes("autenticacion");

    if (!isAuthError) return false;

    localStorage.removeItem("authToken");
    document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
    router.replace("/signin");
    return true;
  };

  useEffect(() => {
    let isMounted = true;

    const loadOrder = async () => {
      if (!orderId) {
        setErrorMessage("ID de orden invalido.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await getOrderDetails(orderId);
        if (!isMounted) return;
        setOrder(response.order);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) return;
        if (handleAuthError(error)) return;
        setOrder(null);
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el detalle de la orden.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  useEffect(() => {
    let isMounted = true;

    const loadItemDetails = async () => {
      if (!order?.items?.length) {
        setItemDetailsByProductId({});
        return;
      }

      const productIds = Array.from(new Set(order.items.map((item) => item.productId).filter(Boolean)));
      if (productIds.length === 0) {
        setItemDetailsByProductId({});
        return;
      }

      try {
        const categoriesResponse = await getCategories();
        if (!isMounted) return;
        const categoryNameById = new Map(
          categoriesResponse.categories.map((category) => [category.id, category.name] as const),
        );

        const productsResult = await Promise.all(
          productIds.map(async (productId) => {
            try {
              const productResponse = await getProductById(productId);
              const product = productResponse.product;
              return [
                productId,
                {
                  name: product.name || null,
                  category: product.categoryId ? categoryNameById.get(product.categoryId) || null : null,
                  sku: product.sku || null,
                  cost: Number.isFinite(Number(product.cost)) ? Number(product.cost) : null,
                  price: Number.isFinite(Number(product.price)) ? Number(product.price) : null,
                } satisfies OrderItemDetails,
              ] as const;
            } catch (error) {
              if (handleAuthError(error)) {
                return null;
              }
              return [
                productId,
                {
                  name: null,
                  category: null,
                  sku: null,
                  cost: null,
                  price: null,
                } satisfies OrderItemDetails,
              ] as const;
            }
          }),
        );

        if (!isMounted) return;
        const nextMap: Record<string, OrderItemDetails> = {};
        for (const item of productsResult) {
          if (!item) continue;
          nextMap[item[0]] = item[1];
        }
        setItemDetailsByProductId(nextMap);
      } catch (error) {
        if (handleAuthError(error)) return;
        if (!isMounted) return;
        setItemDetailsByProductId({});
      }
    };

    loadItemDetails();

    return () => {
      isMounted = false;
    };
  }, [order]);

  const getStatusBadgeClasses = (status: string) => {
    if (status === "paid") return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "created") return "border border-amber-200 bg-amber-50 text-amber-700";
    return "border border-red-200 bg-red-50 text-red-700";
  };

  const getStatusLabel = (status: string) => {
    if (status === "paid") return "Pagada";
    if (status === "created") return "Pendiente";
    if (status === "cancelled") return "Cancelada";
    return status;
  };

  const formatOrderType = (value: string) => {
    if (value === "pos") return "POS";
    if (value === "delivery") return "Envio";
    if (value === "pickup") return "Recogida";
    return value;
  };

  const formatPaymentType = (value: string) => {
    if (value === "cash") return "Efectivo";
    if (value === "card") return "Tarjeta";
    if (value === "transfer") return "Transferencia";
    if (value === "mixed") return "Mixto";
    if (value === "credit") return "Credito";
    return value;
  };

  const handleCancelOrder = async () => {
    if (!order || order.status === "cancelled" || isCancelling) {
      return;
    }

    try {
      setIsCancelling(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      const response = await cancelOrder(order.id);
      setOrder(response.order);
      setIsCancelConfirmOpen(false);
      setSuccessMessage(
        response.restoredItemCount > 0
          ? `Orden cancelada. Stock restaurado para ${response.restoredItemCount} producto(s).`
          : "Orden cancelada.",
      );
    } catch (error) {
      if (handleAuthError(error)) return;
      setErrorMessage(error instanceof Error ? error.message : "No se pudo cancelar la orden.");
    } finally {
      setIsCancelling(false);
    }
  };

  const orderFinancials = useMemo(() => {
    if (!order) {
      return {
        cost: 0,
        profit: 0,
        margin: 0,
        lineFinancialsByItemId: {} as Record<string, { cost: number; profit: number }>,
      };
    }

    const lineFinancialsByItemId: Record<string, { cost: number; profit: number }> = {};
    let cost = 0;

    for (const item of order.items) {
      const unitCost = Number(itemDetailsByProductId[item.productId]?.cost || 0);
      const lineCost = Number((unitCost * Number(item.qty || 0)).toFixed(2));
      const lineProfit = Number((Number(item.total || 0) - lineCost).toFixed(2));

      lineFinancialsByItemId[item.id] = {
        cost: lineCost,
        profit: lineProfit,
      };
      cost = Number((cost + lineCost).toFixed(2));
    }

    return {
      cost,
      profit: Number((Number(order.total || 0) - cost).toFixed(2)),
      margin: Number(order.total || 0) > 0 ? Number((((Number(order.total || 0) - cost) / Number(order.total || 0)) * 100).toFixed(1)) : 0,
      lineFinancialsByItemId,
    };
  }, [itemDetailsByProductId, order]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Orden</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            {order?.numOrder || order?.id || "Detalle de orden"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Consulta informacion general, montos y productos de la orden.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {order ? (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          ) : null}
          <p className="text-xs text-gray-500">
            {order?.createdAt ? `Creada: ${new Date(order.createdAt).toLocaleString("es-MX", { timeZone: serverTimeZone() })}` : "Sin fecha disponible"}
          </p>
          {order?.updatedAt ? (
            <p className="text-xs text-gray-500">Actualizada: {new Date(order.updatedAt).toLocaleString("es-MX", { timeZone: serverTimeZone() })}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {order && order.status !== "cancelled" ? (
          <Button
            onPress={() => setIsCancelConfirmOpen(true)}
            isDisabled={isCancelling || isLoading}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCancelling ? "Cancelando..." : "Cancelar orden"}
          </Button>
        ) : null}
        <Button
          onPress={() => router.push("/orders")}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          Volver a ordenes
        </Button>
      </div>

      {isLoading ? (
        <Card className="rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
          Cargando detalle...
        </Card>
      ) : null}

      {!isLoading && errorMessage ? (
        <Card className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMessage}</Card>
      ) : null}

      {!isLoading && successMessage ? (
        <Card className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </Card>
      ) : null}

      {!isLoading && !errorMessage && order ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <Card className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Cliente</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {order.customer?.fullName || order.customerId || "Publico general"}
              </p>
              <p className="mt-1 text-xs text-gray-500">{order.customer?.phone || "Sin telefono"}</p>
            </Card>
            <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de orden</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{formatOrderType(order.orderType)}</p>
            </Card>
            <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Metodo de pago</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{formatPaymentType(order.paymentType)}</p>
            </Card>
            <Card className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800">{formatCurrency(order.total)}</p>
            </Card>
            <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Costo</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(orderFinancials.cost)}</p>
            </Card>
            <Card className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Ganancia</p>
              <p className={`mt-1 text-2xl font-bold ${orderFinancials.profit >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                {formatCurrency(orderFinancials.profit)}
              </p>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
            <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-9">
              <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Productos</p>
                  <p className="mt-1 text-sm text-gray-500">{order.items.length} item(s) en esta orden</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-[360px]">
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <span className="block text-gray-500">Venta</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(order.total)}</span>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <span className="block text-gray-500">Costo</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(orderFinancials.cost)}</span>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <span className="block text-emerald-700">Margen</span>
                    <span className={`font-semibold ${orderFinancials.profit >= 0 ? "text-emerald-800" : "text-red-700"}`}>
                      {formatPercent(orderFinancials.margin)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-100 md:hidden">
                {order.items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-500">Sin productos en la orden.</div>
                ) : (
                  order.items.map((item) => {
                    const details = itemDetailsByProductId[item.productId];
                    const lineFinancials = orderFinancials.lineFinancialsByItemId[item.id] || { cost: 0, profit: 0 };
                    const productName = details?.name || item.productName;
                    const productPrice =
                      details?.price !== null && details?.price !== undefined
                        ? details.price
                        : Number(item.unitPrice || 0) > 0
                          ? item.unitPrice
                          : null;

                    return (
                      <article key={item.id} className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{productName || <MissingValue />}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span>{details?.category || "Sin categoria"}</span>
                              <span className="text-gray-300">/</span>
                              <span>{details?.sku || "Sin SKU"}</span>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${lineFinancials.profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {formatCurrency(lineFinancials.profit)}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Cantidad</p>
                            <p className="font-medium text-gray-900">{Number(item.qty || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Precio</p>
                            <p className="font-medium text-gray-900">{productPrice === null ? <MissingValue /> : formatCurrency(productPrice)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Costo total</p>
                            <p className="font-medium text-gray-900">{formatCurrency(lineFinancials.cost)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="font-semibold text-gray-900">{formatCurrency(item.total)}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[1280px] text-sm">
                  <thead className="bg-white text-xs uppercase tracking-wide text-gray-500">
                    <tr className="border-b border-gray-100">
                      <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-left">Categoria</th>
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-right">Costo unit.</th>
                      <th className="px-4 py-3 text-right">Precio unit.</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-right">Desc.</th>
                      <th className="px-4 py-3 text-right">Impuesto</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Costo total</th>
                      <th className="px-4 py-3 text-right">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-6 text-center text-gray-500">
                          Sin productos en la orden.
                        </td>
                      </tr>
                    ) : (
                      order.items.map((item) => {
                        const details = itemDetailsByProductId[item.productId];
                        const lineFinancials = orderFinancials.lineFinancialsByItemId[item.id] || { cost: 0, profit: 0 };

                        return (
                          <tr key={item.id} className="border-b border-gray-100 transition-colors hover:bg-gray-50">
                            <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-gray-900">
                              {details?.name || item.productName || <MissingValue />}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{details?.category || <MissingValue />}</td>
                            <td className="px-4 py-3 text-gray-700">{details?.sku || <MissingValue />}</td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {details?.cost !== null && details?.cost !== undefined ? formatCurrency(details.cost) : <MissingValue />}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {details?.price !== null && details?.price !== undefined
                                ? formatCurrency(details.price)
                                : Number(item.unitPrice || 0) > 0
                                  ? formatCurrency(item.unitPrice)
                                  : <MissingValue />}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">{Number(item.qty || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.discountAmount)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.taxAmount)}</td>
                            <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.subtotal)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.total)}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-700">{formatCurrency(lineFinancials.cost)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${lineFinancials.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                              {formatCurrency(lineFinancials.profit)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resumen</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${orderFinancials.profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {formatPercent(orderFinancials.margin)}
                </span>
              </div>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Descuento</span>
                  <span className="font-medium text-gray-900">-{formatCurrency(order.discountAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Impuestos</span>
                  <span className="font-medium text-gray-900">{formatCurrency(order.taxAmount)}</span>
                </div>
                <div className="my-3 border-t border-dashed border-gray-200" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Costo</span>
                  <span className="font-medium text-gray-900">{formatCurrency(orderFinancials.cost)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Ganancia</span>
                  <span className={`font-semibold ${orderFinancials.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {formatCurrency(orderFinancials.profit)}
                  </span>
                </div>
                <div className="mt-4 rounded-lg bg-gray-50 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Total</span>
                    <span className="text-xl font-bold text-gray-900">{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      <div
        className={`fixed inset-0 z-50 bg-black/35 transition-opacity ${
          isCancelConfirmOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (isCancelling) return;
          setIsCancelConfirmOpen(false);
        }}
      />
      <div
        className={`fixed inset-0 z-[51] flex items-center justify-center p-4 transition-all ${
          isCancelConfirmOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
      >
        <Card className="w-full max-w-md rounded-xl border border-red-100 bg-white p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="cancel-order-title" className="text-base font-semibold text-gray-900">
                Cancelar orden
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Esta accion cancelara la orden {order?.numOrder || order?.id || ""} y restaurara el stock de cada producto.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              onPress={() => setIsCancelConfirmOpen(false)}
              isDisabled={isCancelling}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Mantener orden
            </Button>
            <Button
              onPress={() => {
                void handleCancelOrder();
              }}
              isLoading={isCancelling}
              isDisabled={isCancelling || !order || order.status === "cancelled"}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCancelling ? "Cancelando..." : "Confirmar cancelacion"}
            </Button>
          </div>
        </Card>
      </div>
    </section>
  );
}
