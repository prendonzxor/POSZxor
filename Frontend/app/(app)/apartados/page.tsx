"use client";

import { serverCalendarDate, serverDateTimeToIso } from "@/lib/server-time";

import { Button, Card, Collection, ComboBox, EmptyState, FieldError, Input, Label, ListBox } from "@heroui/react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getBranches, type Branch } from "@/api-implementations/branches";
import { getCustomers, type Customer } from "@/api-implementations/customers";
import { getInventory, type InventoryItem } from "@/api-implementations/inventory";
import {
  cancelLayaway,
  completeLayaway,
  createLayaway,
  getLayaways,
  type Layaway,
  type LayawayStatus,
} from "@/api-implementations/layaways";
import { getProducts, type Product } from "@/api-implementations/products";

type DraftItem = {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  availableQty: number;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  availableQty: number;
};

const getProductOptionTextValue = (product: ProductOption) =>
  [product.name, product.sku, product.barcode].filter(Boolean).join(" ");

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const numberFormatter = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 3,
});

const statusLabels: Record<LayawayStatus, string> = {
  active: "Activo",
  partially_paid: "Pago parcial",
  completed: "Completado",
  cancelled: "Cancelado",
  expired: "Vencido",
};

const statusClasses: Record<LayawayStatus, string> = {
  active: "bg-blue-50 text-blue-700",
  partially_paid: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-gray-100 text-gray-700",
  expired: "bg-red-50 text-red-700",
};

function getDefaultExpirationDate() {
  const date = serverCalendarDate();
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function toDateTimeIso(dateValue: string) {
  if (!dateValue) return null;
  return serverDateTimeToIso(`${dateValue}T23:59:59`);
}

export default function LayawaysPage() {
  const [layaways, setLayaways] = useState<Layaway[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<LayawayStatus | "all">("all");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.00");
  const [expiresAt, setExpiresAt] = useState(getDefaultExpirationDate);
  const [notes, setNotes] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productFilterText, setProductFilterText] = useState("");
  const [selectedQty, setSelectedQty] = useState("1");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const inventoryByBranchProduct = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventory.forEach((item) => {
      map.set(`${item.branchId}:${item.productId}`, item);
    });
    return map;
  }, [inventory]);

  const filteredLayaways = useMemo(
    () => (statusFilter === "all" ? layaways : layaways.filter((layaway) => layaway.status === statusFilter)),
    [layaways, statusFilter],
  );

  const summary = useMemo(
    () => ({
      active: layaways.filter((layaway) => ["active", "partially_paid"].includes(layaway.status)).length,
      reservedTotal: layaways
        .filter((layaway) => ["active", "partially_paid"].includes(layaway.status))
        .reduce((acc, layaway) => acc + Number(layaway.total || 0), 0),
      balanceDue: layaways
        .filter((layaway) => ["active", "partially_paid"].includes(layaway.status))
        .reduce((acc, layaway) => acc + Number(layaway.balanceDue || 0), 0),
    }),
    [layaways],
  );

  const draftSubtotal = useMemo(
    () => draftItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0),
    [draftItems],
  );
  const draftBalance = Math.max(0, draftSubtotal - Number(depositAmount || 0));

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [layawaysResponse, customersResponse, branchesResponse, productsResponse, inventoryResponse] =
        await Promise.all([getLayaways({ limit: 200 }), getCustomers(), getBranches(), getProducts(), getInventory()]);

      setLayaways(layawaysResponse.layaways);
      setCustomers(customersResponse.customers.filter((customer) => customer.isActive));
      setBranches(branchesResponse.branches.filter((branch) => branch.isActive));
      setProducts(productsResponse.products.filter((product) => product.isActive && product.unit !== "service"));
      setInventory(inventoryResponse.inventory);
      setBranchId((prev) => prev || branchesResponse.branches.find((branch) => branch.isActive)?.id || "");
      setCustomerId((prev) => prev || customersResponse.customers.find((customer) => customer.isActive)?.id || "");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los apartados.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getAvailableQty = useCallback((productId: string) => {
    const inventoryItem = inventoryByBranchProduct.get(`${branchId}:${productId}`);
    return Math.max(0, Number(inventoryItem?.qtyOnHand || 0) - Number(inventoryItem?.qtyReserved || 0));
  }, [branchId, inventoryByBranchProduct]);

  const productOptions = useMemo<ProductOption[]>(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: Number(product.price || 0),
        availableQty: getAvailableQty(product.id),
      })),
    [getAvailableQty, products],
  );

  const filteredProductOptions = useMemo(() => {
    const query = productFilterText.trim().toLowerCase();
    if (query.length < 2) {
      return [];
    }

    return productOptions.filter((product) =>
      [product.name, product.sku || "", product.barcode || ""].some((value) => value.toLowerCase().includes(query)),
    );
  }, [productFilterText, productOptions]);

  const resetForm = () => {
    setDepositAmount("0.00");
    setExpiresAt(getDefaultExpirationDate());
    setNotes("");
    setSelectedProductId("");
    setProductFilterText("");
    setSelectedQty("1");
    setDraftItems([]);
  };

  const addDraftItem = () => {
    const product = productsById.get(selectedProductId);
    const qty = Number(selectedQty || 0);
    if (!product || !branchId || qty <= 0) return;

    const currentDraftQty = draftItems
      .filter((item) => item.productId === product.id)
      .reduce((acc, item) => acc + item.qty, 0);
    const availableQty = getAvailableQty(product.id);
    if (currentDraftQty + qty > availableQty) {
      setErrorMessage(`Stock insuficiente para ${product.name}. Disponible: ${numberFormatter.format(availableQty)}.`);
      return;
    }

    setDraftItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + qty, availableQty } : item,
        );
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          qty,
          unitPrice: Number(product.price || 0),
          availableQty,
        },
      ];
    });
    setSelectedQty("1");
    setErrorMessage(null);
  };

  const handleCreateLayaway = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId || !customerId || draftItems.length === 0) {
      setErrorMessage("Selecciona sucursal, cliente y al menos un producto.");
      return;
    }

    try {
      setIsSaving(true);
      const response = await createLayaway({
        branchId,
        customerId,
        depositAmount: Number(depositAmount || 0),
        expiresAt: toDateTimeIso(expiresAt),
        notes: notes.trim() || null,
        items: draftItems.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })),
      });
      setLayaways((prev) => [response.layaway, ...prev]);
      await loadData();
      resetForm();
      setIsSheetOpen(false);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el apartado.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseLayaway = async (layaway: Layaway, action: "complete" | "cancel") => {
    try {
      setIsSaving(true);
      const response = action === "complete" ? await completeLayaway(layaway.id) : await cancelLayaway(layaway.id);
      setLayaways((prev) => prev.map((item) => (item.id === layaway.id ? response.layaway : item)));
      await loadData();
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar el apartado.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Apartados</h1>
          <p className="mt-2 text-sm text-gray-600">
            Reserva productos por cliente, controla anticipos y evita vender stock prometido.
          </p>
          {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
        </div>
        <Button
          onPress={() => setIsSheetOpen(true)}
          isDisabled={isLoading || customers.length === 0 || branches.length === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:bg-gray-300"
        >
          Nuevo apartado
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Activos</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? "-" : summary.active}</p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total apartado</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoading ? "-" : currencyFormatter.format(summary.reservedTotal)}
          </p>
        </Card>
        <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Saldo pendiente</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {isLoading ? "-" : currencyFormatter.format(summary.balanceDue)}
          </p>
        </Card>
      </div>

      <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex max-w-xs flex-col gap-1">
          <label htmlFor="layaway-status" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Estado
          </label>
          <select
            id="layaway-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as LayawayStatus | "all")}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="partially_paid">Pago parcial</option>
            <option value="completed">Completados</option>
            <option value="cancelled">Cancelados</option>
            <option value="expired">Vencidos</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden grid-cols-8 gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
          <p className="col-span-2">Cliente</p>
          <p>Sucursal</p>
          <p>Total</p>
          <p>Anticipo</p>
          <p>Saldo</p>
          <p>Estado</p>
          <p>Acciones</p>
        </div>
        <div>
          {isLoading ? (
            <div className="px-5 py-4 text-sm text-gray-500">Cargando apartados...</div>
          ) : null}
          {!isLoading && filteredLayaways.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-500">No hay apartados para mostrar.</div>
          ) : null}
          {filteredLayaways.map((layaway) => {
            const canClose = ["active", "partially_paid"].includes(layaway.status);
            return (
              <div
                key={layaway.id}
                className="grid gap-2 border-b border-gray-100 px-5 py-4 text-sm text-gray-800 md:grid-cols-8 md:items-center md:gap-4"
              >
                <div className="md:col-span-2">
                  <p className="font-semibold text-gray-900">{layaway.customer.fullName}</p>
                  <p className="text-xs text-gray-500">
                    {layaway.customer.phone || "Sin telefono"} | {layaway.itemCount} productos
                  </p>
                </div>
                <p>{layaway.branchName || "-"}</p>
                <p>{currencyFormatter.format(Number(layaway.total || 0))}</p>
                <p>{currencyFormatter.format(Number(layaway.depositAmount || 0))}</p>
                <p>{currencyFormatter.format(Number(layaway.balanceDue || 0))}</p>
                <p>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses[layaway.status]}`}>
                    {statusLabels[layaway.status]}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    isDisabled={!canClose || isSaving}
                    onPress={() => void handleCloseLayaway(layaway, "complete")}
                    className="rounded bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    Completar
                  </Button>
                  <Button
                    size="sm"
                    isDisabled={!canClose || isSaving}
                    onPress={() => void handleCloseLayaway(layaway, "cancel")}
                    className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:text-gray-400"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSheetOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
          isSheetOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nuevo apartado</h2>
            <p className="mt-1 text-xs text-gray-500">Selecciona cliente, sucursal y productos a reservar.</p>
          </div>
          <Button
            onPress={() => setIsSheetOpen(false)}
            isDisabled={isSaving}
            className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleCreateLayaway} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Sucursal</span>
              <select
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setDraftItems([]);
                }}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Cliente</span>
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500"
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
              <label className="flex flex-col gap-1">
                <ComboBox
                  allowsEmptyCollection
                  className="w-full"
                  inputValue={productFilterText}
                  selectedKey={selectedProductId || undefined}
                  onInputChange={(value) => {
                    setProductFilterText(value);
                    setSelectedProductId("");
                  }}
                  onSelectionChange={(key) => {
                    if (!key) {
                      setSelectedProductId("");
                      return;
                    }

                    const selected = productOptions.find((product) => product.id === String(key));
                    if (!selected) {
                      return;
                    }

                    setSelectedProductId(selected.id);
                    setProductFilterText(selected.name);
                  }}
                >
                  <Label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Producto</Label>
                  <ComboBox.InputGroup>
                    <Input
                      type="text"
                      className="w-full rounded-lg border-gray-300"
                      placeholder="Buscar por nombre, SKU o codigo de barras"
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        if (!selectedProductId && filteredProductOptions[0]) {
                          setSelectedProductId(filteredProductOptions[0].id);
                          setProductFilterText(filteredProductOptions[0].name);
                          return;
                        }
                        addDraftItem();
                      }}
                    />
                    <ComboBox.Trigger />
                  </ComboBox.InputGroup>
                  <ComboBox.Popover>
                    <ListBox
                      aria-label="Resultados de productos"
                      renderEmptyState={() =>
                        productFilterText.trim().length < 2 ? (
                          <p className="px-3 py-2 text-sm text-gray-500">Escribe al menos 2 caracteres.</p>
                        ) : (
                          <EmptyState />
                        )
                      }
                    >
                      <Collection items={filteredProductOptions}>
                        {(product) => (
                          <ListBox.Item id={product.id} textValue={getProductOptionTextValue(product)}>
                            <div className="flex flex-col">
                              <span>{product.name}</span>
                              <span className="text-xs text-gray-500">
                                SKU: {product.sku || "-"} | Barcode: {product.barcode || "-"} | Disp.{" "}
                                {numberFormatter.format(product.availableQty)}
                              </span>
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        )}
                      </Collection>
                    </ListBox>
                  </ComboBox.Popover>
                  {selectedProductId ? (
                    <p className="mt-1 text-xs text-gray-500">Producto seleccionado: {selectedProductId}</p>
                  ) : null}
                  <FieldError className="text-xs" />
                </ComboBox>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Cantidad</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={selectedQty}
                  onChange={(event) => setSelectedQty(event.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500"
                />
              </label>
              <Button
                type="button"
                onPress={addDraftItem}
                className="h-10 rounded bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800"
              >
                Agregar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {draftItems.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-500">
                Agrega productos para crear el apartado.
              </p>
            ) : null}
            {draftItems.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                  <p className="text-xs text-gray-500">
                    {numberFormatter.format(item.qty)} x {currencyFormatter.format(item.unitPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {currencyFormatter.format(item.qty * item.unitPrice)}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onPress={() => setDraftItems((prev) => prev.filter((draftItem) => draftItem.productId !== item.productId))}
                    className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Anticipo</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Vence</span>
              <input
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none focus:border-blue-500"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Notas</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="h-20 resize-none rounded-lg border border-gray-300 p-3 text-sm text-gray-900 outline-none focus:border-blue-500"
              placeholder="Condiciones, contacto o comentarios"
            />
          </label>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-semibold text-gray-900">{currencyFormatter.format(draftSubtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-gray-600">Saldo pendiente</span>
              <span className="font-semibold text-gray-900">{currencyFormatter.format(draftBalance)}</span>
            </div>
          </div>

          <Button
            type="submit"
            isDisabled={isSaving || draftItems.length === 0}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {isSaving ? "Guardando..." : "Crear apartado"}
          </Button>
        </form>
      </aside>
    </section>
  );
}
