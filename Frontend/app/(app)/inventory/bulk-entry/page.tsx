"use client";

import { Button, Card, toast } from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBranches } from "@/api-implementations/branches";
import { createBulkInventoryEntry, getInventory } from "@/api-implementations/inventory";
import { searchProducts } from "@/api-implementations/products";

const formatToFixed3 = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : "0.000";
};

const mapInventoryRows = (items: Awaited<ReturnType<typeof getInventory>>["inventory"]) =>
  items.map((item) => ({
    id: `${item.branchId}-${item.productId}`,
    store: item.branchId,
    product_id: item.productId,
    qty_on_hand: Number(item.qtyOnHand || 0),
  }));

type InventoryRow = {
  id: string;
  store: string;
  product_id: string;
  qty_on_hand: number;
};

type BranchOption = {
  id: string;
  name: string;
};

type BulkEntryItem = {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  qty: number;
  currentQty: number;
};

export default function BulkInventoryEntryPage() {
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [bulkBranchId, setBulkBranchId] = useState("");
  const [bulkScanValue, setBulkScanValue] = useState("");
  const [bulkItems, setBulkItems] = useState<BulkEntryItem[]>([]);
  const [bulkNote, setBulkNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingBulkProduct, setIsSearchingBulkProduct] = useState(false);
  const [isApplyingBulkEntry, setIsApplyingBulkEntry] = useState(false);
  const bulkScanInputRef = useRef<HTMLInputElement | null>(null);

  const totalUnits = useMemo(
    () => bulkItems.reduce((acc, item) => acc + Number(item.qty || 0), 0),
    [bulkItems],
  );

  const refreshInventory = useCallback(async () => {
    const response = await getInventory();
    setInventoryRows(mapInventoryRows(response.inventory));
  }, []);

  const focusBulkScanInput = () => {
    window.setTimeout(() => {
      bulkScanInputRef.current?.focus();
      bulkScanInputRef.current?.select();
    }, 0);
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [branchesResponse, inventoryResponse] = await Promise.all([getBranches(), getInventory()]);

        if (!isMounted) return;

        const activeBranches = branchesResponse.branches
          .filter((branch) => branch.isActive)
          .map((branch) => ({ id: branch.id, name: branch.name }));

        setBranchOptions(activeBranches);
        setBulkBranchId((prev) => prev || activeBranches[0]?.id || "");
        setInventoryRows(mapInventoryRows(inventoryResponse.inventory));
      } catch (error) {
        toast.danger("No se pudo cargar entrada masiva", {
          description: error instanceof Error ? error.message : "Intenta nuevamente.",
          actionProps: {
            children: "Cerrar",
            onPress: () => toast.clear(),
            variant: "tertiary",
          },
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
          focusBulkScanInput();
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleBulkScanSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const query = bulkScanValue.trim();

    if (!bulkBranchId) {
      toast.danger("Selecciona una sucursal", {
        description: "La entrada masiva necesita una sucursal destino.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    if (query.length < 2 || isSearchingBulkProduct) {
      focusBulkScanInput();
      return;
    }

    try {
      setIsSearchingBulkProduct(true);
      const response = await searchProducts({ sku: query, barcode: query, name: query });
      const product =
        response.products.find((item) => item.barcode === query || item.sku === query) || response.products[0];

      if (!product || product.unit === "service") {
        toast.danger("Producto no encontrado", {
          description: `No se encontro un producto inventariable para "${query}".`,
          actionProps: {
            children: "Cerrar",
            onPress: () => toast.clear(),
            variant: "tertiary",
          },
        });
        return;
      }

      const existingInventory = inventoryRows.find(
        (row) => row.store === bulkBranchId && row.product_id === product.id,
      );
      const currentQty = Number(existingInventory?.qty_on_hand || 0);

      setBulkItems((prev) => {
        const existing = prev.find((item) => item.productId === product.id);
        if (existing) {
          return prev.map((item) =>
            item.productId === product.id ? { ...item, qty: Number((item.qty + 1).toFixed(3)) } : item,
          );
        }

        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku || "",
            barcode: product.barcode || "",
            qty: 1,
            currentQty,
          },
        ];
      });
      setBulkScanValue("");
      toast.success("Producto agregado", {
        description: product.name,
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      toast.danger("No se pudo buscar producto", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsSearchingBulkProduct(false);
      focusBulkScanInput();
    }
  };

  const handleApplyBulkEntry = async () => {
    if (!bulkBranchId || bulkItems.length === 0) {
      return;
    }

    try {
      setIsApplyingBulkEntry(true);
      await createBulkInventoryEntry({
        branchId: bulkBranchId,
        type: "purchase",
        note: bulkNote.trim() || null,
        items: bulkItems.map((item) => ({
          productId: item.productId,
          qtyDelta: Number(item.qty || 0),
        })),
      });
      await refreshInventory();
      setBulkItems([]);
      setBulkNote("");
      toast.success("Entrada masiva aplicada", {
        description: "Las existencias se actualizaron correctamente.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      focusBulkScanInput();
    } catch (error) {
      toast.danger("No se pudo aplicar entrada", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsApplyingBulkEntry(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Entrada masiva</h1>
          <p className="mt-2 text-sm text-gray-600">
            Escanea productos para sumar existencias en lote. El lector debe enviar Enter al terminar cada codigo.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Productos</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{bulkItems.length}</p>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Unidades</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatToFixed3(totalUnits)}</p>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sucursal</p>
          <p className="mt-2 truncate text-lg font-bold text-gray-900">
            {branchOptions.find((branch) => branch.id === bulkBranchId)?.name || "Sin sucursal"}
          </p>
        </section>
      </div>

      <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="bulk-branch" className="text-sm font-medium text-gray-800">Sucursal destino</label>
              <select
                id="bulk-branch"
                value={bulkBranchId}
                onChange={(event) => {
                  setBulkBranchId(event.target.value);
                  setBulkItems([]);
                  focusBulkScanInput();
                }}
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                disabled={isLoading}
              >
                <option value="">Selecciona sucursal</option>
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleBulkScanSubmit} className="space-y-2">
              <label htmlFor="bulk-scan" className="text-sm font-medium text-gray-800">Escaner / codigo</label>
              <div className="flex gap-2">
                <input
                  ref={bulkScanInputRef}
                  id="bulk-scan"
                  type="text"
                  value={bulkScanValue}
                  onChange={(event) => setBulkScanValue(event.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  placeholder="Escanea o escribe SKU / barcode"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  isDisabled={isSearchingBulkProduct || !bulkBranchId}
                  className="group h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-300"
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
                    {isSearchingBulkProduct ? "..." : "Agregar"}
                  </span>
                </Button>
              </div>
              <p className="text-xs text-gray-500">Mantén este campo enfocado para escanear muchos productos rapido.</p>
            </form>

            <div className="flex flex-col gap-1">
              <label htmlFor="bulk-note" className="text-sm font-medium text-gray-800">Nota / factura</label>
              <textarea
                id="bulk-note"
                value={bulkNote}
                onChange={(event) => setBulkNote(event.target.value)}
                className="h-24 resize-none rounded-xl border border-gray-300 p-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                placeholder="Factura, proveedor o comentario"
              />
            </div>

            <Button
              onPress={handleApplyBulkEntry}
              isDisabled={isApplyingBulkEntry || bulkItems.length === 0 || !bulkBranchId}
              className="group w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <span className="inline-flex items-center justify-center gap-2">
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
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {isApplyingBulkEntry ? "Aplicando..." : "Aplicar entrada"}
              </span>
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="grid grid-cols-[1fr_96px_96px_80px] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <p>Producto</p>
              <p>Actual</p>
              <p>Entrada</p>
              <p></p>
            </div>
            <div>
              {bulkItems.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500">Aun no hay productos escaneados.</p>
              ) : null}
              {bulkItems.map((item) => (
                <div
                  key={item.productId}
                  className="grid grid-cols-[1fr_96px_96px_80px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{item.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      SKU: {item.sku || "-"} | Barcode: {item.barcode || "-"}
                    </p>
                  </div>
                  <p className="text-gray-700">{formatToFixed3(item.currentQty)}</p>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.qty}
                    onChange={(event) => {
                      const nextQty = Math.max(0, Number(event.target.value || 0));
                      setBulkItems((prev) =>
                        prev.map((bulkItem) =>
                          bulkItem.productId === item.productId ? { ...bulkItem, qty: nextQty } : bulkItem,
                        ),
                      );
                    }}
                    className="h-9 rounded-lg border border-gray-300 px-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                  <Button
                    size="sm"
                    onPress={() => setBulkItems((prev) => prev.filter((bulkItem) => bulkItem.productId !== item.productId))}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                  >
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
