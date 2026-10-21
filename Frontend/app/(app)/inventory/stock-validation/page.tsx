"use client";

import { serverNow, serverDateKey } from "@/lib/server-time";

import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, toast } from "@heroui/react";
import { getBranches, type Branch } from "@/api-implementations/branches";
import {
  applyFullStockValidation,
  getStockValidationReport,
  type StockValidationReport,
  createNewStockValidationSession,
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

import { downloadZeroStockCsv } from "../../reports/zero-stock-report";
import Link from "next/link";

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

const getCurrentPeriodKey = () => serverDateKey().slice(0, 7);

export default function StockValidationPage() {
  const [stockReport, setStockReport] = useState<StockValidationReport | null>(null);
  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const [gridProductIds, setGridProductIds] = useState<string[]>([]);
  const [lastScannedProductId, setLastScannedProductId] = useState<string | null>(null);
  const newValidationDialogRef = useRef<HTMLDialogElement | null>(null);
  const [isCreatingValidation, setIsCreatingValidation] = useState(false);
  const [newValidationError, setNewValidationError] = useState("");
  const [updateStockOnly, setUpdateStockOnly] = useState(false);
  const saveDialogRef = useRef<HTMLDialogElement | null>(null);
  const [saveAll, setSaveAll] = useState(false);
  const [pendingSave, setPendingSave] = useState<ValidationRow[] | null>(null);
  const [confirmationError, setConfirmationError] = useState("");
  const [isConfirmingSave, setIsConfirmingSave] = useState(false);
  const [scanFeedback, setScanFeedback] = useState("");
  const [isSessionLoading, setIsSessionLoading] = useState(true);
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
      setIsSessionLoading(true);
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

        const reportResponse = response.session ? await getStockValidationReport(response.session.id) : { report: null };
        if (!isMounted) return;
        setStockReport(reportResponse.report);
        const omittedIds = new Set(reportResponse.report?.snapshot.items.filter((item) => item.omitted).map((item) => item.productId) || []);
        setSession(response.session);
        setSavedItems(response.items);
        setGridProductIds(response.items.filter((item) => item.realQty !== null && !omittedIds.has(item.productId)).map((item) => item.productId));
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
      } finally {
        if (isMounted) setIsSessionLoading(false);
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
            : (difference ?? 0) > 0
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

  const gridRows = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.productId, row]));
    return gridProductIds.map((id) => byId.get(id)).filter((row): row is ValidationRow => Boolean(row));
  }, [rows, gridProductIds]);
  const visibleRows = useMemo(
    () => gridRows.filter((row) => statusFilter === "all" || row.status === statusFilter),
    [gridRows, statusFilter],
  );
  const searchMatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];
    return rows.filter((row) => [row.name, row.sku, row.barcode, row.productId].some((value) => value.toLowerCase().includes(query)));
  }, [rows, searchTerm]);

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
  const isBusy = isCreatingValidation || isConfirmingSave || isCompletingSession || Boolean(savingProductId || adjustingProductId);
  const isCountReady = !isLoading && !isSessionLoading && session?.branchId === selectedBranchId && session?.periodKey === periodKey && !isSessionCompleted;
  const savedItemCount = savedItems.length;
  const rowsWithValidCount = rows.filter((row) => row.realStock !== null);

  useEffect(() => {
    if (isCountReady && !isBusy && !pendingSave) scannerInputRef.current?.focus({ preventScroll: true });
  }, [isCountReady, isBusy, pendingSave]);

  const addProductToCount = (row: ValidationRow) => {
    if (!isCountReady || isBusy || pendingSave) return;
    setRealStockByProductId((current) => ({
      ...current,
      [row.productId]: formatQty((parseRealStock(current[row.productId] || "") ?? 0) + 1),
    }));
    setGridProductIds((current) => [row.productId, ...current.filter((id) => id !== row.productId)]);
    setLastScannedProductId(row.productId);
    setStatusFilter("all");
    setScanFeedback(`${row.name}: Real ${formatQty((row.realStock ?? 0) + 1)} (+1).`);
    setSearchTerm("");
    scannerInputRef.current?.focus({ preventScroll: true });
  };

  const handleRealStockChange = (productId: string, value: string) => {
    setRealStockByProductId((current) => ({
      ...current,
      [productId]: value,
    }));
  };

  const handleProductSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    const query = event.currentTarget.value.trim().toLowerCase();
    if (!query) {
      return;
    }

    event.preventDefault();
    if (event.repeat || event.nativeEvent.isComposing || !isCountReady || isBusy || pendingSave) return;
    const exactMatches = rows.filter((row) =>
      row.productId.toLowerCase() === query || row.sku.toLowerCase() === query || row.barcode.toLowerCase() === query,
    );
    if (exactMatches.length !== 1) {
      setScanFeedback(exactMatches.length > 1 ? "Hay varios productos con ese codigo. Selecciona el producto en los resultados para agregarlo." : "No se encontro una coincidencia exacta de SKU o codigo.");
      event.currentTarget.select();
      return;
    }
    addProductToCount(exactMatches[0]);
  };

  const openSaveDialog = (items: ValidationRow[], all = false, updateOnly = false) => {
    if (!isCountReady || isBusy || items.length === 0) return;
    setConfirmationError("");
    setUpdateStockOnly(updateOnly);
    setSaveAll(all);
    setPendingSave(items.map((row) => ({ ...row })));
    saveDialogRef.current?.showModal();
  };
  const closeSaveDialog = () => {
    if (isConfirmingSave) return;
    saveDialogRef.current?.close();
    setPendingSave(null);
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

  const handleApplyAdjustment = async (row: ValidationRow, quiet = false) => {
    if (!selectedBranchId || row.realStock === null) {
      return false;
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
        adjustedAt: serverNow().toISOString(),
      });

      setInventory((current) => {
        const existingIndex = current.findIndex((item) => item.productId === row.productId);
        if (existingIndex === -1) {
          return [...current, response.inventory];
        }

        return current.map((item, index) => (index === existingIndex ? response.inventory : item));
      });

      if (!quiet) toast.success("Stock actualizado", {
        description: `${row.name}: stock virtual ajustado a ${formatQty(row.realStock)}.`,
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return true;
    } catch (error) {
      toast.danger("No se pudo ajustar stock", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return false;
    } finally {
      setAdjustingProductId(null);
    }
  };

  const handleSavePartialCounts = async (items = rowsWithValidCount) => {
    try {
      setIsCompletingSession(true);

      if (items.length === 0) {
        toast.danger("Sin conteos para guardar", {
          description: "Ingresa al menos un stock real antes de guardar el avance.",
          actionProps: {
            children: "Cerrar",
            onPress: () => toast.clear(),
            variant: "tertiary",
          },
        });
        return false;
      }

      const activeSession = await getOrCreateSession();
      const savedResponses = await Promise.all(
        items.map((row) =>
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

      toast.success("Avance guardado", {
        description: `${savedResponses.length} conteo(s) guardado(s) para ${activeSession.periodKey}. El stock no cambio y puedes continuar el conteo.`,
        actionProps: { children: "OK", onPress: () => toast.clear(), variant: "tertiary" },
      });
      return true;
    } catch (error) {
      toast.danger("No se pudo guardar", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return false;
    } finally {
      setIsCompletingSession(false);
    }
  };

  const omittedRows = useMemo(() => {
    const counted = new Set(pendingSave?.map((row) => row.productId) || []);
    return rows.filter((row) => !counted.has(row.productId));
  }, [rows, pendingSave]);

  const confirmSave = async (updateStock: boolean) => {
    if (!pendingSave || isConfirmingSave || !isCountReady) return;
    setIsConfirmingSave(true);
    setConfirmationError("");
    try {
      let success: boolean;
      if (updateStockOnly && updateStock) {
        try {
          const activeSession = await getOrCreateSession();
          const response = await applyFullStockValidation(activeSession.id, {
            scopeProductIds: rows.map((row) => row.productId),
            items: pendingSave.map((row) => ({ productId: row.productId, realQty: row.realStock as number })),
          });
          setStockReport(response.report);
          setSession({ ...activeSession, status: "completed", completedAt: response.report.createdAt });
          success = true;
          try {
            const [inventoryResponse, sessionResponse] = await Promise.all([getInventory(selectedBranchId), getCurrentStockValidationSession({ branchId: selectedBranchId, periodKey })]);
            setInventory(inventoryResponse.inventory);
            setSavedItems(sessionResponse.items);
          } catch { setErrorMessage("El stock y reporte se guardaron. Recarga la pagina para actualizar las cantidades mostradas."); }
          try { downloadZeroStockCsv(response.report); } catch { /* The saved report also has a download button. */ }
          toast.success("Stock actualizado y reporte guardado", { description: `${response.report.snapshot.items.filter((item) => item.omitted).length} productos fuera del conteo quedaron con stock cero.` });
        } catch (error) {
          setConfirmationError(error instanceof Error ? error.message : "No se pudo aplicar el conteo.");
          return;
        }
      } else if (saveAll) success = await handleSavePartialCounts(pendingSave);
      else success = updateStock ? await handleApplyAdjustment(pendingSave[0]) : Boolean(await handleSaveCount(pendingSave[0]));
      if (success) {
        saveDialogRef.current?.close();
        setPendingSave(null);
      } else {
        setConfirmationError("No se pudo completar la operacion. Revisa el error y vuelve a intentar; los conteos ya guardados se conservan.");
      }
    } finally { setIsConfirmingSave(false); }
  };

  const handleNewValidation = async () => {
    if (isBusy || !selectedBranchId) return;
    setIsCreatingValidation(true);
    setNewValidationError("");
    try {
      if (!isSessionCompleted && rowsWithValidCount.length > 0) {
        if (!await handleSavePartialCounts()) {
          setNewValidationError("No se pudieron guardar los conteos actuales. Intenta de nuevo antes de crear la validacion.");
          return;
        }
      }
      const inventoryResponse = await getInventory(selectedBranchId);
      const response = await createNewStockValidationSession({ branchId: selectedBranchId, periodKey });
      if (!response.session) throw new Error("No se pudo crear la nueva validacion.");
      setSession(response.session);
      setInventory(inventoryResponse.inventory);
      setStockReport(null);
      setSavedItems([]);
      setRealStockByProductId({});
      setGridProductIds([]);
      setLastScannedProductId(null);
      setSearchTerm("");
      setStatusFilter("all");
      setScanFeedback("Nueva validacion lista. Escanea el primer producto.");
      newValidationDialogRef.current?.close();
      toast.success("Nueva validacion creada");
    } catch (error) {
      setNewValidationError(error instanceof Error ? error.message : "No se pudo crear la validacion.");
    } finally { setIsCreatingValidation(false); }
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
    link.download = `validacion-stock-${serverDateKey()}.csv`;
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
            Escanea o agrega productos para construir el conteo fisico real por sucursal.
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
          <Button onPress={() => openSaveDialog(gridRows.filter((row) => row.realStock !== null), true, true)} isDisabled={!isCountReady || isBusy || gridRows.length === 0 || gridRows.some((row) => row.realStock === null)} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300">
            {isCompletingSession ? "Guardando..." : "Guardar items y actualizar stock"}
          </Button>
          <Button onPress={() => { setNewValidationError(""); newValidationDialogRef.current?.showModal(); }} isDisabled={isBusy || isLoading || isSessionLoading || !session || session.branchId !== selectedBranchId || session.periodKey !== periodKey} className="rounded border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700">Nueva validacion</Button>
          <Button
            onPress={() => {
              void handleSavePartialCounts(gridRows.filter((row) => row.realStock !== null));
            }}
            isDisabled={!isCountReady || isBusy || !gridRows.some((row) => row.realStock !== null)}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isCompletingSession ? "Guardando..." : "Guardar parcialmente"}
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
              disabled={isBusy}
              id="stock-period"
              type="month"
              value={periodKey}
              onChange={(event) => {
                setPeriodKey(event.target.value || getCurrentPeriodKey());
                setStockReport(null);
                setRealStockByProductId({});
                setGridProductIds([]);
                setLastScannedProductId(null);
                setSearchTerm("");
                setScanFeedback("");
              }}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="stock-branch" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Sucursal
            </label>
            <select
              disabled={isBusy}
              id="stock-branch"
              value={selectedBranchId}
              onChange={(event) => {
                setSelectedBranchId(event.target.value);
                setStockReport(null);
                setRealStockByProductId({});
                setGridProductIds([]);
                setLastScannedProductId(null);
                setSearchTerm("");
                setScanFeedback("");
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
              Escanear o buscar producto
            </label>
            <input
              disabled={!isCountReady || isBusy}
              ref={scannerInputRef}
              id="stock-search"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              type="text"
              value={searchTerm}
              onChange={(event) => { setSearchTerm(event.target.value); setScanFeedback(""); }}
              onKeyDown={handleProductSearchKeyDown}
              placeholder="Escanea el codigo y presiona Enter"
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            />
            <p className="text-xs text-gray-500">Configura el lector para enviar Enter al terminar cada lectura. Cada lectura suma 1 a Real.</p>
            {searchTerm.trim() && <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white" aria-label="Resultados de busqueda">
              {searchMatches.length === 0 ? <p className="p-3 text-sm text-gray-500">No se encontro el producto. Revisa el codigo.</p> : searchMatches.slice(0, 20).map((row) => <button type="button" key={row.productId} disabled={!isCountReady || isBusy} onClick={() => addProductToCount(row)} className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-blue-50 focus-visible:bg-blue-50">
                <span><span className="block font-medium">{row.name}</span><span className="block text-xs text-gray-500">SKU: {row.sku || "—"} · Codigo: {row.barcode || "—"}</span></span><span className="shrink-0 text-blue-700">Agregar +1</span>
              </button>)}
              {searchMatches.length > 20 && <p className="p-2 text-xs text-gray-500">Hay mas resultados. Ingresa un codigo o nombre mas especifico.</p>}
            </div>}
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

      <p role="status" aria-live="polite" className="text-sm text-gray-600">{scanFeedback || "Ingresa un SKU o codigo exacto y presiona Enter para sumar una unidad al conteo Real."}</p>

      <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3"><h2 className="text-base font-semibold text-gray-900">Productos del conteo ({gridRows.length})</h2><p className="mt-1 text-xs text-gray-500">Cada producto aparece una sola vez. Las lecturas repetidas aumentan Real y muestran el producto al inicio. Los conteos guardados se recuperan al volver.</p></div>
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
              <div className="px-5 py-4 text-sm text-gray-600">{gridRows.length === 0 ? "Escanea un codigo o busca un producto para agregarlo al conteo." : "No hay productos del conteo con el estado seleccionado."}</div>
            ) : null}
            {visibleRows.map((row) => (
              <div
                key={row.productId}
                className={`grid gap-2 border-b border-gray-100 px-5 py-4 text-sm text-gray-800 md:grid-cols-11 md:items-center md:gap-3 ${lastScannedProductId === row.productId ? "bg-blue-50" : ""}`}
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
                    disabled={!isCountReady || isBusy}
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
                      openSaveDialog([row]);
                    }}
                    isDisabled={row.realStock === null || !isCountReady || isBusy}
                    className="rounded bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    onPress={() => {
                      openSaveDialog([row]);
                    }}
                    isDisabled={row.realStock === null || row.difference === 0 || !isCountReady || isBusy}
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
      <dialog ref={newValidationDialogRef} aria-labelledby="new-validation-title" onCancel={(event) => { if (isCreatingValidation) event.preventDefault(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-gray-200 bg-white p-5 text-gray-900 shadow-2xl backdrop:bg-black/40">
        <h2 id="new-validation-title" className="text-lg font-semibold">Nueva validacion de stock</h2>
        <p className="mt-3 text-sm text-gray-600">Se guardaran los conteos actuales y se cerrara esta validacion. La nueva validacion comenzara con una lista vacia en la misma sucursal y periodo. Esta accion no actualiza el stock; usa Guardar items y actualizar stock para aplicar el conteo.</p>
        {newValidationError && <p role="alert" className="mt-3 text-sm text-red-600">{newValidationError}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button isDisabled={isCreatingValidation} onPress={() => newValidationDialogRef.current?.close()}>Cancelar</Button><Button isDisabled={isCreatingValidation} onPress={() => { void handleNewValidation(); }}>{isCreatingValidation ? "Creando..." : "Guardar y crear validacion"}</Button></div>
      </dialog>
      <dialog ref={saveDialogRef} aria-labelledby="save-stock-title" aria-describedby="save-stock-description" onCancel={(event) => { if (isConfirmingSave) event.preventDefault(); else setPendingSave(null); }} className="fixed inset-0 m-auto max-h-[85vh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 text-gray-900 shadow-2xl backdrop:bg-black/40">
        <h2 id="save-stock-title" className="text-lg font-semibold">Guardar conteo y actualizar stock</h2>
        <p id="save-stock-description" className="mt-2 text-sm text-gray-600">{updateStockOnly ? "Se aplicara el conteo de la lista y se pondra en CERO el stock de los productos activos no inventariados en esta lista. Se cerrara la validacion y se guardara un reporte con CSV." : "Puedes guardar solo el conteo o actualizar el stock virtual con las cantidades reales."} Sucursal: {branches.find((branch) => branch.id === selectedBranchId)?.name}. Periodo: {periodKey}.</p>
        {updateStockOnly && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3"><h3 className="text-sm font-semibold text-amber-900">{omittedRows.length} productos fuera de la lista: stock final 0</h3><p className="mt-1 text-xs text-amber-800">Solo productos activos que no son servicios, en esta sucursal. Las cantidades reservadas se conservan.</p><div className="mt-2 max-h-40 overflow-auto"><table className="w-full text-sm"><thead><tr><th className="text-left" scope="col">Producto / SKU</th><th className="text-right" scope="col">Stock actual</th><th className="text-right" scope="col">Final</th></tr></thead><tbody>{omittedRows.map((row) => <tr key={row.productId}><td className="py-1">{row.name} · {row.sku || "—"}</td><td className="text-right">{formatQty(row.virtualStock)}</td><td className="text-right font-semibold">0.000</td></tr>)}</tbody></table></div></div>}
        <div className="mt-4 max-h-64 overflow-auto">
          <table className="w-full text-sm"><thead><tr><th className="py-2 text-left" scope="col">Producto</th><th className="px-2 text-right" scope="col">Virtual</th><th className="px-2 text-right" scope="col">Real</th></tr></thead><tbody>{pendingSave?.map((row) => <tr key={row.productId} className="border-t border-gray-100"><td className="py-2">{row.name}<span className="block text-xs text-gray-500">{row.sku}</span></td><td className="px-2 text-right">{formatQty(row.virtualStock)}</td><td className="px-2 text-right font-semibold">{formatQty(row.realStock)}</td></tr>)}</tbody></table>
        </div>
        {confirmationError && <p role="alert" className="mt-3 text-sm text-red-600">{confirmationError}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" isDisabled={isConfirmingSave} onPress={closeSaveDialog}>Cancelar</Button>
          {!updateStockOnly && <Button type="button" isDisabled={isConfirmingSave} onPress={() => { void confirmSave(false); }}>Solo guardar conteo</Button>}
          <Button type="button" isDisabled={isConfirmingSave} onPress={() => { void confirmSave(true); }} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">{isConfirmingSave ? "Guardando..." : updateStockOnly ? "Confirmar conteo y poner faltantes en cero" : "Guardar y actualizar stock"}</Button>
        </div>
      </dialog>
    </div>
  );
}
