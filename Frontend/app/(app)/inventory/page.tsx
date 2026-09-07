"use client";

import { Button, Card, Tabs, toast } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getBranches } from "@/api-implementations/branches";
import {
  createInventory,
  getInventory,
  getInventoryMovements,
  updateInventory,
  type InventoryMovement,
} from "@/api-implementations/inventory";
import { getProductById } from "@/api-implementations/products";
import { InventoryFormCard } from "./components/inventory-form-card";

const formatToFixed3 = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : "0.000";
};

function buildBarcodePattern(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  // Visual-only barcode preview pattern (not intended for scanner-grade encoding).
  let bits = "101011";
  for (const char of normalized) {
    bits += char.charCodeAt(0).toString(2).padStart(8, "0");
    bits += "0";
  }
  bits += "110101";
  return bits;
}

const toLocalDateTimeInput = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part: number) => part.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isSameLocalDay = (value: string | Date, date = new Date()) => {
  const movementDate = value instanceof Date ? value : new Date(value);
  return (
    movementDate.getFullYear() === date.getFullYear() &&
    movementDate.getMonth() === date.getMonth() &&
    movementDate.getDate() === date.getDate()
  );
};

const formatMovementType = (type: InventoryMovement["type"]) => {
  const labels: Record<InventoryMovement["type"], string> = {
    purchase: "Entrada",
    sale: "Salida",
    adjustment: "Ajuste",
    return: "Devolucion",
    transfer_in: "Transferencia entrada",
    transfer_out: "Transferencia salida",
  };
  return labels[type] || type;
};

const formatMovementReason = (movement: InventoryMovement) => {
  if (movement.note) return movement.note;
  if (movement.referenceType === "order_cancellation") return "Cancelacion de orden";
  if (movement.referenceType) return movement.referenceType;
  return "Movimiento de inventario";
};

const mapInventoryRows = (items: Awaited<ReturnType<typeof getInventory>>["inventory"]) =>
  items.map((item) => {
    const qtyOnHand = Number(item.qtyOnHand || 0);
    const qtyReserved = Number(item.qtyReserved || 0);
    const updatedAt = new Date(item.updatedAt);

    return {
      id: `${item.branchId}-${item.productId}`,
      store: item.branchId,
      product_id: item.productId,
      qty_on_hand: qtyOnHand,
      reorder_level: Number(item.reorderLevel || 0),
      qty_reserved: qtyReserved,
      qty_available: qtyOnHand - qtyReserved,
      updated_at: updatedAt.toLocaleString("es-MX"),
      updated_at_input: toLocalDateTimeInput(updatedAt),
    };
  });

type InventoryRow = {
  id: string;
  store: string;
  product_id: string;
  qty_on_hand?: number;
  reorder_level?: number;
  qty_reserved?: number;
  qty_available?: number;
  updated_at: string;
  updated_at_input: string;
};

type BranchOption = {
  id: string;
  name: string;
};

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get("item_id") ?? "sin-item";
  const view = searchParams.get("view") === "movements" ? "movements" : "inventory";
  const buildLocalDateTime = () => {
    const now = new Date();
    return toLocalDateTimeInput(now);
  };
  const defaultUpdatedAt = useMemo(() => buildLocalDateTime(), []);
  const [inventoryForm, setInventoryForm] = useState({
    tenant_id: "",
    branch_id: "",
    product_id: itemId === "sin-item" ? "" : itemId,
    product_name: "",
    qty_on_hand: "0.000",
    reorder_level: "0.000",
    updated_at: defaultUpdatedAt,
  });
  const [isFormSheetOpen, setIsFormSheetOpen] = useState(false);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isLoadingMovements, setIsLoadingMovements] = useState(true);
  const [selectedProductName, setSelectedProductName] = useState("");
  const [selectedProductSku, setSelectedProductSku] = useState("");
  const [selectedProductBarcode, setSelectedProductBarcode] = useState("");
  const [isLoadingSelectedProduct, setIsLoadingSelectedProduct] = useState(false);
  const branchNameById = useMemo(
    () => Object.fromEntries(branchOptions.map((branch) => [branch.id, branch.name])),
    [branchOptions],
  );
  const inventorySummary = useMemo(() => {
    const rowsForView =
      itemId === "sin-item" ? inventoryRows : inventoryRows.filter((row) => row.product_id === itemId);

    return rowsForView.reduce(
      (acc, row) => {
        acc.onHand += Number(row.qty_on_hand || 0);
        acc.reserved += Number(row.qty_reserved || 0);
        acc.available += Number(row.qty_available || 0);
        return acc;
      },
      { onHand: 0, reserved: 0, available: 0 },
    );
  }, [inventoryRows, itemId]);
  const visibleInventoryRows = useMemo(
    () => (itemId === "sin-item" ? inventoryRows : inventoryRows.filter((row) => row.product_id === itemId)),
    [inventoryRows, itemId],
  );
  const movementRows = useMemo(
    () =>
      inventoryMovements.map((movement) => {
        const qty = Number(movement.qtyDelta || 0);
        return {
          id: movement.id,
          date: new Date(movement.createdAt).toLocaleString("es-MX"),
          type: formatMovementType(movement.type),
          qty: `${qty > 0 ? "+" : ""}${formatToFixed3(qty)}`,
          reason: formatMovementReason(movement),
          ref: movement.referenceId || "-",
          isPositive: qty >= 0,
        };
      }),
    [inventoryMovements],
  );
  const movementsTodayCount = useMemo(
    () => inventoryMovements.filter((movement) => isSameLocalDay(movement.createdAt)).length,
    [inventoryMovements],
  );
  const selectedProductBarcodePattern = useMemo(
    () => buildBarcodePattern(selectedProductBarcode),
    [selectedProductBarcode],
  );
  const isBranchSetupMissing = !isLoadingBranches && branchOptions.length === 0;

  const loadMovements = useCallback(async () => {
    try {
      setIsLoadingMovements(true);
      const response = await getInventoryMovements({
        productId: itemId === "sin-item" ? undefined : itemId,
      });

      setInventoryMovements(response.movements);
    } catch (error) {
      setInventoryMovements([]);
      const message = error instanceof Error ? error.message : "No se pudieron cargar los movimientos.";
      toast.danger("No se pudieron cargar movimientos", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsLoadingMovements(false);
    }
  }, [itemId]);

  useEffect(() => {
    let isMounted = true;

    const loadInventory = async () => {
      try {
        setIsLoadingInventory(true);
        const response = await getInventory();

        if (!isMounted) {
          return;
        }

        setInventoryRows(mapInventoryRows(response.inventory));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setInventoryRows([]);
        const message = error instanceof Error ? error.message : "No se pudo cargar el inventario.";
        toast.danger("No se pudo cargar inventario", {
          description: message,
          actionProps: {
            children: "Cerrar",
            onPress: () => toast.clear(),
            variant: "tertiary",
          },
        });
      } finally {
        if (isMounted) {
          setIsLoadingInventory(false);
        }
      }
    };

    loadInventory();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    loadMovements();
  }, [loadMovements, view]);

  useEffect(() => {
    const refreshOnFocus = () => {
      loadMovements();
    };

    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadMovements]);

  useEffect(() => {
    let isMounted = true;

    const loadSelectedProductName = async () => {
      if (itemId === "sin-item") {
        setSelectedProductName("");
        setSelectedProductSku("");
        setSelectedProductBarcode("");
        return;
      }

      try {
        setIsLoadingSelectedProduct(true);
        const response = await getProductById(itemId);
        if (!isMounted) {
          return;
        }
        setSelectedProductName(response.product.name || "");
        setSelectedProductSku(response.product.sku || "");
        setSelectedProductBarcode(response.product.barcode || "");
      } catch {
        if (!isMounted) {
          return;
        }
        setSelectedProductName("");
        setSelectedProductSku("");
        setSelectedProductBarcode("");
      } finally {
        if (isMounted) {
          setIsLoadingSelectedProduct(false);
        }
      }
    };

    loadSelectedProductName();

    return () => {
      isMounted = false;
    };
  }, [itemId]);

  useEffect(() => {
    let isMounted = true;

    const loadProductName = async () => {
      if (!isFormSheetOpen) {
        return;
      }

      const productId = String(inventoryForm.product_id ?? "").trim();

      if (!productId) {
        if (isMounted) {
          setInventoryForm((prev) => ({ ...prev, product_name: "" }));
        }
        return;
      }

      try {
        const response = await getProductById(productId);
        if (!isMounted) {
          return;
        }

        setInventoryForm((prev) => ({ ...prev, product_name: response.product.name || "" }));
      } catch {
        if (!isMounted) {
          return;
        }

        setInventoryForm((prev) => ({ ...prev, product_name: "" }));
      }
    };

    loadProductName();

    return () => {
      isMounted = false;
    };
  }, [inventoryForm.product_id, isFormSheetOpen]);

  useEffect(() => {
    let isMounted = true;

    const loadBranches = async () => {
      try {
        setIsLoadingBranches(true);
        const response = await getBranches();
        if (!isMounted) {
          return;
        }

        setBranchOptions(
          response.branches.map((branch) => ({
            id: branch.id,
            name: branch.name,
          })),
        );
      } catch {
        if (!isMounted) {
          return;
        }
        setBranchOptions([]);
      } finally {
        if (isMounted) {
          setIsLoadingBranches(false);
        }
      }
    };

    loadBranches();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleInventorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBranchSetupMissing) {
      toast.danger("Configura una sucursal primero", {
        description: "Debes crear al menos una sucursal antes de guardar inventario.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    try {
      const branchId = inventoryForm.branch_id.trim();
      const productId = inventoryForm.product_id.trim();
      const inventoryPayload = {
        branchId,
        productId,
        qtyOnHand: Number(inventoryForm.qty_on_hand || "0"),
        reorderLevel: Number(inventoryForm.reorder_level || "0"),
      };
      const inventoryExists = inventoryRows.some((row) => row.store === branchId && row.product_id === productId);

      if (inventoryExists) {
        await updateInventory(inventoryPayload);
      } else {
        await createInventory(inventoryPayload);
      }

      const response = await getInventory();
      setInventoryRows(mapInventoryRows(response.inventory));
      await loadMovements();
      setIsFormSheetOpen(false);
      toast.success("Inventario guardado", {
        description: inventoryExists
          ? "La existencia del inventario se actualizo correctamente."
          : "El registro de inventario se guardo correctamente.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el inventario.";
      toast.danger("No se pudo guardar inventario", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    }
  };

  const handleEditInventoryRow = (row: InventoryRow) => {
    if (isBranchSetupMissing) {
      toast.danger("Configura una sucursal primero", {
        description: "Debes crear al menos una sucursal para editar inventario.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    setInventoryForm({
      tenant_id: "",
      branch_id: row.store,
      product_id: row.product_id,
      product_name: "",
      qty_on_hand: formatToFixed3(row.qty_on_hand),
      reorder_level: formatToFixed3(row.reorder_level),
      updated_at: row.updated_at_input,
    });
    setIsFormSheetOpen(true);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Inventario y movimientos</h1>
          <p className="mt-2 text-sm text-gray-600">
            Administra el inventario y revisa el historial de movimientos.
          </p>
        </div>
        <Button
          onPress={() => router.push("/productsnservices")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md"
        >
          Volver a productos
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-xl border border-dotted border-gray-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Existencia total</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{isLoadingInventory ? "-" : inventorySummary.onHand}</p>
        </section>
        <section className="rounded-xl border border-dotted border-gray-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reservado</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{isLoadingInventory ? "-" : inventorySummary.reserved}</p>
        </section>
        <section className="rounded-xl border border-dotted border-gray-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Disponible</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{isLoadingInventory ? "-" : inventorySummary.available}</p>
        </section>
        <section className="rounded-xl border border-dotted border-gray-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Movimientos hoy</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoadingMovements ? "-" : movementsTodayCount}
          </p>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-xl border border-dotted border-gray-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">ID producto</p>
          <p className="mt-2 break-all text-sm font-semibold text-gray-900">
            {itemId === "sin-item" ? "Sin producto seleccionado" : itemId}
          </p>
        </section>
        <section className="rounded-xl border border-dotted border-gray-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre del producto</p>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            {itemId === "sin-item"
              ? "Sin producto seleccionado"
              : isLoadingSelectedProduct
                ? "Cargando..."
                : selectedProductName || "No disponible"}
          </p>
        </section>
        <section className="rounded-xl border border-dotted border-gray-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SKU</p>
          <p className="mt-2 break-all text-sm font-semibold text-gray-900">
            {itemId === "sin-item"
              ? "Sin producto seleccionado"
              : isLoadingSelectedProduct
                ? "Cargando..."
                : selectedProductSku || "No disponible"}
          </p>
        </section>
        <section className="rounded-xl border border-dotted border-gray-300 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Codigo de barras</p>
          {itemId === "sin-item" ? (
            <p className="mt-2 break-all text-sm font-semibold text-gray-900">Sin producto seleccionado</p>
          ) : isLoadingSelectedProduct ? (
            <p className="mt-2 break-all text-sm font-semibold text-gray-900">Cargando...</p>
          ) : selectedProductBarcodePattern ? (
            <div className="mt-2">
              <div className="overflow-x-auto rounded-md border border-gray-200 bg-white p-2">
                <div className="flex h-10 min-w-max items-stretch">
                  {selectedProductBarcodePattern.split("").map((bit, index) => (
                    <span
                      key={`${bit}-${index}`}
                      className={bit === "1" ? "bg-black" : "bg-white"}
                      style={{ width: 2 }}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-1 text-center font-mono text-[11px] tracking-widest text-gray-700">
                {selectedProductBarcode}
              </p>
            </div>
          ) : (
            <p className="mt-2 break-all text-sm font-semibold text-gray-900">No disponible</p>
          )}
        </section>
      </div>

      {isBranchSetupMissing ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Configura sucursales antes de gestionar inventario</p>
              <p className="text-sm text-amber-800">
                No hay sucursales disponibles. Crea al menos una sucursal para registrar inventario.
              </p>
            </div>
            <Button
              onPress={() => router.push("/admin?tab=tiendas")}
              className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Ir a sucursales
            </Button>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto">
          <Tabs
            selectedKey={view}
            onSelectionChange={(key) =>
              router.push(`/inventory?item_id=${encodeURIComponent(itemId)}&view=${String(key)}`)
            }
          >
            <Tabs.List aria-label="Secciones de inventario" className="min-w-max">
              <Tabs.Tab
                id="inventory"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white"
              >
                Inventario
              </Tabs.Tab>
              <Tabs.Tab
                id="movements"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 data-[selected=true]:bg-blue-600 data-[selected=true]:text-white"
              >
                Movimientos
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
        </div>
        <Button
          onPress={() => {
            if (isBranchSetupMissing) {
              toast.danger("Configura una sucursal primero", {
                description: "Debes crear una sucursal para agregar inventario.",
                actionProps: {
                  children: "Cerrar",
                  onPress: () => toast.clear(),
                  variant: "tertiary",
                },
              });
              return;
            }

            setInventoryForm({
              tenant_id: "",
              branch_id: "",
              product_id: itemId === "sin-item" ? "" : itemId,
              product_name: "",
              qty_on_hand: "0.000",
              reorder_level: "0.000",
              updated_at: buildLocalDateTime(),
            });
            setIsFormSheetOpen(true);
          }}
          isDisabled={isBranchSetupMissing}
          className="group rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <span className="inline-flex items-center gap-2">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 transition-transform group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Agregar
          </span>
        </Button>
      </div>

      {view === "inventory" ? (
        <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="hidden min-w-[920px] grid-cols-6 gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
              <p>Tienda</p>
              <p>Existencia</p>
              <p>Reservado</p>
              <p>Disponible</p>
              <p>Actualizado</p>
              <p>Acciones</p>
            </div>
            <div className="min-w-0 md:min-w-[920px]">
              {isLoadingInventory ? (
                <div className="px-5 py-4 text-sm text-gray-600">Cargando inventario...</div>
              ) : null}
              {!isLoadingInventory && visibleInventoryRows.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-600">No hay registros de inventario.</div>
              ) : null}
              {visibleInventoryRows.map((row, index) => (
                <div
                  key={`${row.id}-${index}`}
                  className="grid gap-2 border-b border-gray-100 px-5 py-4 text-sm text-gray-800 md:grid-cols-6 md:items-center md:gap-4"
                >
                  <p className="font-medium text-gray-900">
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Tienda</span>
                    {branchNameById[row.store] || row.store}
                  </p>
                  <p>
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Existencia</span>
                    {row.qty_on_hand}
                  </p>
                  <p>
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Reservado</span>
                    {row.qty_reserved}
                  </p>
                  <p>
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Disponible</span>
                    {row.qty_available}
                  </p>
                  <p>
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Actualizado</span>
                    {row.updated_at}
                  </p>
                  <div>
                    <Button
                      size="sm"
                      onClick={() => handleEditInventoryRow(row)}
                      isDisabled={isBranchSetupMissing}
                      className="rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="hidden min-w-[760px] grid-cols-5 gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
              <p>Fecha</p>
              <p>Tipo</p>
              <p>Cantidad</p>
              <p>Motivo</p>
              <p>Referencia</p>
            </div>
            <div className="min-w-0 md:min-w-[760px]">
              {isLoadingMovements ? (
                <div className="px-5 py-4 text-sm text-gray-600">Cargando movimientos...</div>
              ) : null}
              {!isLoadingMovements && movementRows.length === 0 ? (
                <div className="px-5 py-4 text-sm text-gray-600">No hay movimientos de inventario.</div>
              ) : null}
              {movementRows.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-2 border-b border-gray-100 px-5 py-4 text-sm text-gray-800 md:grid-cols-5 md:items-center md:gap-4"
                >
                  <p>
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Fecha</span>
                    {row.date}
                  </p>
                  <p className="font-medium text-gray-900">
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Tipo</span>
                    {row.type}
                  </p>
                  <p className={row.isPositive ? "text-emerald-600" : "text-red-600"}>
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Cantidad</span>
                    {row.qty}
                  </p>
                  <p>
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Motivo</span>
                    {row.reason}
                  </p>
                  <p>
                    <span className="mr-2 text-xs uppercase tracking-wide text-gray-500 md:hidden">Referencia</span>
                    {row.ref}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isFormSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsFormSheetOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
          isFormSheetOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Formulario de inventario</h2>
          <Button
            onPress={() => setIsFormSheetOpen(false)}
            className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Cerrar
          </Button>
        </div>
        <InventoryFormCard
          form={inventoryForm}
          setForm={setInventoryForm}
          branchOptions={branchOptions}
          handleSubmit={handleInventorySubmit}
        />
      </aside>
    </section>
  );
}
