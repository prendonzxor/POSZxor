"use client";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, toast } from "@heroui/react";
import { getBranches, type Branch } from "@/api-implementations/branches";
import {
  completeStockValidationSession,
  createInventory,
  ensureStockValidationSession,
  getCurrentStockValidationSession,
  getInventory,
  markStockValidationItemAdjusted,
  saveStockValidationItem,
  updateInventory,
  type InventoryItem,
  type StockValidationItem,
  type StockValidationSession,
} from "@/api-implementations/inventory";
import { getProducts, type Product } from "@/api-implementations/products";

type ValidationStatus = "all" | "pending" | "matched" | "surplus" | "shortage";

type ValidationRow = {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  virtualStock: number;
  reservedStock: number;
  availableStock: number;
  reorderLevel: number;
  realStockValue: string;
  realStock: number | null;
  difference: number | null;
  status: Exclude<ValidationStatus, "all">;
  hasInventory: boolean;
  savedItem: StockValidationItem | null;
};

const formatQty = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : "0.000";
};

const parseRealStock = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const getStatusLabel = (status: ValidationRow["status"]) => {
  const labels: Record<ValidationRow["status"], string> = {
    pending: "Sin contar",
    matched: "Coincide",
    surplus: "Sobrante",
    shortage: "Faltante",
  };
  return labels[status];
};

const getStatusClassName = (status: ValidationRow["status"]) => {
  const classes: Record<ValidationRow["status"], string> = {
    pending: "bg-gray-100 text-gray-700",
    matched: "bg-emerald-100 text-emerald-700",
    surplus: "bg-blue-100 text-blue-700",
    shortage: "bg-red-100 text-red-700",
  };
  return classes[status];
};

const getCurrentPeriodKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export default function StockValidationPage() {
  const realStockInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [session, setSession] = useState<StockValidationSession | null>(null);
  const [savedItems, setSavedItems] = useState<StockValidationItem[]>([]);
  const [periodKey, setPeriodKey] = useState(getCurrentPeriodKey);
  const [realStockByProductId, setRealStockByProductId] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ValidationStatus>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [adjustingProductId, setAdjustingProductId] = useState<string | null>(null);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [isCompletingSession, setIsCompletingSession] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        const [branchesResponse, productsResponse] = await Promise.all([getBranches(), getProducts()]);

        if (!isMounted) {
          return;
        }

        const activeBranches = branchesResponse.branches.filter((branch) => branch.isActive);
        const nextBranches = activeBranches.length > 0 ? activeBranches : branchesResponse.branches;
        const firstBranchId = nextBranches[0]?.id || "";

        setBranches(nextBranches);
        setSelectedBranchId(firstBranchId);
        setProducts(productsResponse.products.filter((product) => product.isActive && product.unit !== "service"));
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setBranches([]);
        setProducts([]);
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar la informacion de stock.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedBranchId) {
      setInventory([]);
      return;
    }

    let isMounted = true;

    const loadInventory = async () => {
      try {
        setIsLoading(true);
        const response = await getInventory(selectedBranchId);

        if (!isMounted) {
          return;
        }

        setInventory(response.inventory);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setInventory([]);
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el inventario.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInventory();

    return () => {
      isMounted = false;
    };
  }, [selectedBranchId]);

  useEffect(() => {
    if (!selectedBranchId || !periodKey) {
      setSession(null);
      setSavedItems([]);
      return;
    }

    let isMounted = true;

    const loadSession = async () => {
      try {
        const currentResponse = await getCurrentStockValidationSession({
          branchId: selectedBranchId,
          periodKey,
        });
        const response = currentResponse.session
          ? currentResponse
          : await ensureStockValidationSession({
              branchId: selectedBranchId,
              periodKey,
            });

        if (!isMounted) {
          return;
        }

        setSession(response.session);
        setSavedItems(response.items);
        setRealStockByProductId(
          Object.fromEntries(
            response.items
              .filter((item) => item.realQty !== null)
              .map((item) => [item.productId, formatQty(item.realQty)]),
          ),
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setSession(null);
        setSavedItems([]);
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el seguimiento mensual.");
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [periodKey, selectedBranchId]);

  const inventoryByProductId = useMemo(
    () => new Map(inventory.map((item) => [item.productId, item])),
    [inventory],
  );

  const savedItemByProductId = useMemo(
    () => new Map(savedItems.map((item) => [item.productId, item])),
    [savedItems],
  );

  const rows = useMemo<ValidationRow[]>(() => {
    return products.map((product) => {
      const inventoryItem = inventoryByProductId.get(product.id);
      const savedItem = savedItemByProductId.get(product.id) || null;
      const virtualStock = Number(inventoryItem?.qtyOnHand || 0);
      const reservedStock = Number(inventoryItem?.qtyReserved || 0);
      const realStockValue = realStockByProductId[product.id] || "";
      const realStock = parseRealStock(realStockValue);
      const difference = realStock === null ? null : Number((realStock - virtualStock).toFixed(3));
      const status: ValidationRow["status"] =
        realStock === null
          ? "pending"
          : difference === 0
            ? "matched"
            : difference > 0
              ? "surplus"
              : "shortage";

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku || "",
        barcode: product.barcode || "",
        unit: product.unit,
        virtualStock,
        reservedStock,
        availableStock: virtualStock - reservedStock,
        reorderLevel: Number(inventoryItem?.reorderLevel || 0),
        realStockValue,
        realStock,
        difference,
        status,
        hasInventory: Boolean(inventoryItem),
        savedItem,
      };
    });
  }, [inventoryByProductId, products, realStockByProductId, savedItemByProductId]);

  const visibleRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesQuery =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.sku.toLowerCase().includes(query) ||
        row.barcode.toLowerCase().includes(query) ||
        row.productId.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [rows, searchTerm, statusFilter]);

  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc[row.status] += 1;
          if (row.difference !== null) {
            acc.absoluteDifference += Math.abs(row.difference);
          }
          return acc;
        },
        { pending: 0, matched: 0, surplus: 0, shortage: 0, absoluteDifference: 0 },
      ),
    [rows],
  );
  const isSessionCompleted = session?.status === "completed";
  const savedItemCount = savedItems.length;
  const rowsWithValidCount = rows.filter((row) => row.realStock !== null);
  const isReadyToComplete = rows.length > 0 && rows.every((row) => row.realStock !== null);

  const handleRealStockChange = (productId: string, value: string) => {
    setRealStockByProductId((current) => ({
      ...current,
      [productId]: value,
    }));
  };

  const focusRealStockInput = (productId: string) => {
    window.setTimeout(() => {
      const input = realStockInputRefs.current[productId];
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus({ preventScroll: true });
      input?.select();
    }, 0);
  };

  const handleProductSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    const query = event.currentTarget.value.trim().toLowerCase();
    if (!query) {
      return;
    }

    const exactMatch = rows.find(
      (row) =>
        row.productId.toLowerCase() === query ||
        row.sku.toLowerCase() === query ||
        row.barcode.toLowerCase() === query,
    );

    if (!exactMatch) {
      return;
    }

    setStatusFilter("all");
    setSearchTerm(exactMatch.barcode || exactMatch.sku || exactMatch.productId);
    focusRealStockInput(exactMatch.productId);
  };

  const upsertSavedItem = (item: StockValidationItem) => {
    setSavedItems((current) => {
      const existingIndex = current.findIndex((savedItem) => savedItem.productId === item.productId);
      if (existingIndex === -1) {
        return [...current, item];
      }

      return current.map((savedItem, index) => (index === existingIndex ? item : savedItem));
    });
  };

  const getOrCreateSession = async () => {
    if (session) {
      return session;
    }

    if (!selectedBranchId) {
      throw new Error("Selecciona una sucursal para guardar el conteo.");
    }

    const response = await ensureStockValidationSession({
      branchId: selectedBranchId,
      periodKey,
    });

    if (!response.session) {
      throw new Error("No se pudo crear la sesion de validacion.");
    }

    setSession(response.session);
    setSavedItems(response.items);
    return response.session;
  };

  const handleSaveCount = async (row: ValidationRow) => {
    if (row.realStock === null) {
      toast.danger("Conteo invalido", {
        description: "Ingresa el stock real antes de guardar.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return null;
    }

    try {
      setSavingProductId(row.productId);
      const activeSession = await getOrCreateSession();
      const response = await saveStockValidationItem(activeSession.id, {
        productId: row.productId,
        virtualQty: row.virtualStock,
        reservedQty: row.reservedStock,
        realQty: row.realStock,
      });

      upsertSavedItem(response.item);
      toast.success("Conteo guardado", {
        description: `${row.name}: ${formatQty(row.realStock)} guardado para ${activeSession.periodKey}.`,
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return response.item;
    } catch (error) {
      toast.danger("No se pudo guardar conteo", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return null;
    } finally {
      setSavingProductId(null);
    }
  };

  const handleApplyAdjustment = async (row: ValidationRow) => {
    if (!selectedBranchId || row.realStock === null) {
      return;
    }

    try {
      setAdjustingProductId(row.productId);
      const activeSession = await getOrCreateSession();
      const savedItem = await saveStockValidationItem(activeSession.id, {
        productId: row.productId,
        virtualQty: row.virtualStock,
        reservedQty: row.reservedStock,
        realQty: row.realStock,
      });
      const response = row.hasInventory
        ? await updateInventory({
            branchId: selectedBranchId,
            productId: row.productId,
            qtyOnHand: row.realStock,
            reorderLevel: row.reorderLevel,
          })
        : await createInventory({
            branchId: selectedBranchId,
            productId: row.productId,
            qtyOnHand: row.realStock,
            reorderLevel: row.reorderLevel,
          });

      await markStockValidationItemAdjusted(activeSession.id, row.productId);
      upsertSavedItem({
        ...savedItem.item,
        adjustedAt: new Date().toISOString(),
      });

      setInventory((current) => {
        const existingIndex = current.findIndex((item) => item.productId === row.productId);
        if (existingIndex === -1) {
          return [...current, response.inventory];
        }

        return current.map((item, index) => (index === existingIndex ? response.inventory : item));
      });

      toast.success("Stock actualizado", {
        description: `${row.name}: stock virtual ajustado a ${formatQty(row.realStock)}.`,
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      toast.danger("No se pudo ajustar stock", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setAdjustingProductId(null);
    }
  };

  const handleSaveOrCompleteSession = async () => {
    try {
      setIsCompletingSession(true);

      if (rowsWithValidCount.length === 0) {
        toast.danger("Sin conteos para guardar", {
          description: "Ingresa al menos un stock real antes de guardar el avance.",
          actionProps: {
            children: "Cerrar",
            onPress: () => toast.clear(),
            variant: "tertiary",
          },
        });
        return;
      }

      const activeSession = await getOrCreateSession();
      const savedResponses = await Promise.all(
        rowsWithValidCount.map((row) =>
          saveStockValidationItem(activeSession.id, {
            productId: row.productId,
            virtualQty: row.virtualStock,
            reservedQty: row.reservedStock,
            realQty: row.realStock as number,
          }),
        ),
      );

      savedResponses.forEach((response) => {
        upsertSavedItem(response.item);
      });

      if (!isReadyToComplete) {
        toast.success("Avance guardado", {
          description: `${savedResponses.length} conteo(s) guardado(s) para ${activeSession.periodKey}. Puedes continuar despues.`,
          actionProps: {
            children: "OK",
            onPress: () => toast.clear(),
            variant: "tertiary",
          },
        });
        return;
      }

      const response = await completeStockValidationSession(activeSession.id);
      setSession(response.session);
      setSavedItems(response.items);
      toast.success("Validacion completada", {
        description: `El seguimiento ${activeSession.periodKey} quedo cerrado.`,
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      toast.danger("No se pudo guardar", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsCompletingSession(false);
    }
  };

  const handleExport = () => {
    const header = ["Producto", "SKU", "Codigo", "Stock virtual", "Reservado", "Disponible", "Stock real", "Diferencia", "Estado"];
    const lines = visibleRows.map((row) =>
      [
        row.name,
        row.sku,
        row.barcode,
        formatQty(row.virtualStock),
        formatQty(row.reservedStock),
        formatQty(row.availableStock),
        row.realStock === null ? "" : formatQty(row.realStock),
        row.difference === null ? "" : formatQty(row.difference),
        getStatusLabel(row.status),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `validacion-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Validacion de stock</h1>
          <p className="mt-1 text-sm text-gray-600">
            Compara el stock virtual del sistema contra el conteo fisico real por sucursal.
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
              Periodo: {periodKey}
            </span>
            <span className={`rounded-full px-2.5 py-1 font-medium ${isSessionCompleted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {isSessionCompleted ? "Completada" : "Borrador mensual"}
            </span>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700">
              {savedItemCount} conteo(s) guardado(s)
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onPress={() => {
              void handleSaveOrCompleteSession();
            }}
            isDisabled={!selectedBranchId || isSessionCompleted || products.length === 0 || rowsWithValidCount.length === 0}
            isLoading={isCompletingSession}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isReadyToComplete ? "Guardar y completar" : "Guardar avance"}
          </Button>
          <Button
            onPress={handleExport}
            isDisabled={visibleRows.length === 0}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Exportar CSV
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sin contar</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{summary.pending}</p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coinciden</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{summary.matched}</p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sobrantes</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">{summary.surplus}</p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Faltantes</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{summary.shortage}</p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Diferencia total</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatQty(summary.absoluteDifference)}</p>
        </Card>
      </div>

      <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="stock-period" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Mes
            </label>
            <input
              id="stock-period"
              type="month"
              value={periodKey}
              onChange={(event) => {
                setPeriodKey(event.target.value || getCurrentPeriodKey());
                setRealStockByProductId({});
              }}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="stock-branch" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Sucursal
            </label>
            <select
              id="stock-branch"
              value={selectedBranchId}
              onChange={(event) => {
                setSelectedBranchId(event.target.value);
                setRealStockByProductId({});
              }}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label htmlFor="stock-search" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Buscar producto
            </label>
            <input
              id="stock-search"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={handleProductSearchKeyDown}
              placeholder="Nombre, ID, SKU o codigo de barras"
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="stock-status" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Estado
            </label>
            <select
              id="stock-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ValidationStatus)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              <option value="all">Todos</option>
              <option value="pending">Sin contar</option>
              <option value="matched">Coincide</option>
              <option value="surplus">Sobrante</option>
              <option value="shortage">Faltante</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="hidden min-w-[84rem] grid-cols-11 gap-3 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
            <p className="col-span-2">Producto</p>
            <p>SKU</p>
            <p>Codigo</p>
            <p className="text-right">Virtual</p>
            <p className="text-right">Reservado</p>
            <p className="text-right">Disponible</p>
            <p className="text-right">Real</p>
            <p className="text-right">Diferencia</p>
            <p className="col-span-2">Acciones</p>
          </div>

          <div className="min-w-0 md:min-w-[84rem]">
            {isLoading ? (
              <div className="px-5 py-4 text-sm text-gray-600">Cargando inventario...</div>
            ) : null}
            {!isLoading && visibleRows.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-600">No hay productos para los filtros seleccionados.</div>
            ) : null}
            {visibleRows.map((row) => (
              <div
                key={row.productId}
                className="grid gap-2 border-b border-gray-100 px-5 py-4 text-sm text-gray-800 md:grid-cols-11 md:items-center md:gap-3"
              >
                <div className="md:col-span-2">
                  <p className="font-semibold text-gray-900">{row.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClassName(row.status)}`}>
                      {getStatusLabel(row.status)}
                    </span>
                    <span className="text-xs text-gray-500">Unidad: {row.unit}</span>
                    {row.savedItem ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                        Guardado
                      </span>
                    ) : null}
                    {row.savedItem?.adjustedAt ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                        Ajustado
                      </span>
                    ) : null}
                  </div>
                </div>
                <p>{row.sku || "-"}</p>
                <p>{row.barcode || "-"}</p>
                <p className="text-right font-medium text-gray-900">{formatQty(row.virtualStock)}</p>
                <p className="text-right">{formatQty(row.reservedStock)}</p>
                <p className="text-right">{formatQty(row.availableStock)}</p>
                <div className="md:text-right">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={row.realStockValue}
                    onChange={(event) => handleRealStockChange(row.productId, event.target.value)}
                    ref={(element) => {
                      realStockInputRefs.current[row.productId] = element;
                    }}
                    disabled={isSessionCompleted}
                    className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm text-gray-900 outline-none focus:border-blue-500 md:max-w-[7.5rem] md:text-right"
                    placeholder="0.000"
                  />
                </div>
                <p
                  className={`text-right font-semibold ${
                    row.difference === null
                      ? "text-gray-400"
                      : row.difference < 0
                        ? "text-red-700"
                        : row.difference > 0
                          ? "text-blue-700"
                          : "text-emerald-700"
                  }`}
                >
                  {row.difference === null ? "-" : `${row.difference > 0 ? "+" : ""}${formatQty(row.difference)}`}
                </p>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Button
                    size="sm"
                    onPress={() => {
                      void handleSaveCount(row);
                    }}
                    isDisabled={row.realStock === null || isSessionCompleted}
                    isLoading={savingProductId === row.productId}
                    className="rounded bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    onPress={() => {
                      void handleApplyAdjustment(row);
                    }}
                    isDisabled={row.realStock === null || row.difference === 0 || !selectedBranchId || isSessionCompleted}
                    isLoading={adjustingProductId === row.productId}
                    className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    Ajustar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
