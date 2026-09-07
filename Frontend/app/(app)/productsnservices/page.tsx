"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card } from "@heroui/react";
import { useRouter } from "next/navigation";
import { getCategories } from "@/api-implementations/categories";
import { getInventory } from "@/api-implementations/inventory";
import { getMe } from "@/api-implementations/me";
import {
  createProduct,
  getProducts,
  updateProduct,
  type Product,
  type ProductPayload,
} from "@/api-implementations/products";
import { ProductsServicesSheet } from "./components/products-services-sheet";

type CatalogType = "Product" | "Service";
type Unit = "pc" | "kg" | "g" | "l" | "ml" | "box" | "pack" | "service";

type CatalogItem = {
  id: string;
  tenant_id: string;
  category_id: string;
  sku: string;
  barcode: string;
  name: string;
  unit: Unit;
  allow_decimal_qty: number;
  cost: number;
  price: number;
  wholesale_price: number;
  tax_rate: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

const unitOptions: Unit[] = ["pc", "kg", "g", "l", "ml", "box", "pack", "service"];

type ProductForm = {
  category_id: string;
  sku: string;
  barcode: string;
  name: string;
  unit: Unit;
  allow_decimal_qty: string;
  cost: string;
  price: string;
  wholesale_price: string;
  tax_rate: string;
  is_active: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type ExportFormat = "txt" | "xlsx" | "pdf" | "decap";
type ExportPriceField = "price" | "wholesale_price";

const makeEmptyForm = (entryType: CatalogType): ProductForm => ({
  category_id: "",
  sku: "",
  barcode: "",
  name: "",
  unit: entryType === "Service" ? "service" : "pc",
  allow_decimal_qty: "0",
  cost: "0.00",
  price: "0.00",
  wholesale_price: "0.00",
  tax_rate: "0.00",
  is_active: "1",
});

const mapApiProductToCatalogItem = (product: Product): CatalogItem => ({
  id: product.id,
  tenant_id: product.tenantId,
  category_id: product.categoryId || "",
  sku: product.sku || "",
  barcode: product.barcode || "",
  name: product.name,
  unit: product.unit,
  allow_decimal_qty: product.allowDecimalQty ? 1 : 0,
  cost: Number(product.cost),
  price: Number(product.price),
  wholesale_price: Number(product.wholesalePrice ?? product.wholesale_price ?? product.price),
  tax_rate: Number(product.taxRate),
  is_active: product.isActive ? 1 : 0,
  created_at: product.createdAt,
  updated_at: product.updatedAt,
});

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "producto";

const escapeFrontmatterValue = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const normalizeRoleName = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const buildDecapProductMarkdown = (item: CatalogItem, categoryName: string, quantity: number, exportPrice: number) =>
  [
    "---",
    `title: "${escapeFrontmatterValue(item.name)}"`,
    `price: ${exportPrice.toFixed(2)}`,
    'currency: "MXN"',
    `status: "${item.is_active === 1 ? "Activo" : "Inactivo"}"`,
    "featured: false",
    'image: ""',
    `category: "${escapeFrontmatterValue(categoryName)}"`,
    "discount: 0",
    'condition: "Nuevo"',
    `sku: "${escapeFrontmatterValue(item.sku)}"`,
    `quantity: ${Math.max(0, Math.trunc(quantity))}`,
    'contact_url: ""',
    "---",
    "",
    "",
  ].join("\n");

export default function CreateProductsServicesPage() {
  const router = useRouter();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsErrorMessage, setItemsErrorMessage] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isExportSheetOpen, setIsExportSheetOpen] = useState(false);
  const [copiedExportId, setCopiedExportId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<CatalogType>("Product");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(makeEmptyForm("Product"));
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "product" | "service">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "tax" | "updatedAt">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("decap");
  const [exportPriceField, setExportPriceField] = useState<ExportPriceField>("price");
  const [includeProductsWithoutStock, setIncludeProductsWithoutStock] = useState(true);
  const [inventoryQtyByProductId, setInventoryQtyByProductId] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalActivos = useMemo(() => items.filter((item) => item.is_active === 1).length, [items]);
  const isCategorySetupMissing = !isLoadingItems && categoryOptions.length === 0;
  const canCreateProducts = ["administrador", "supervisor"].includes(normalizeRoleName(currentUserRole));
  const hasActiveSearchFilters =
    searchQuery.trim().length > 0 ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    categoryFilter !== "all" ||
    sortBy !== "name" ||
    sortDirection !== "asc";
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery =
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.barcode.toLowerCase().includes(query);
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "service" ? item.unit === "service" : item.unit !== "service");
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? item.is_active === 1 : item.is_active === 0);
      const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;

      return matchesQuery && matchesType && matchesStatus && matchesCategory;
    });
  }, [items, searchQuery, typeFilter, statusFilter, categoryFilter]);
  const sortedItems = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;

    return [...filteredItems].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "es", { sensitivity: "base" }) * direction;
      }

      if (sortBy === "price") {
        return (a.price - b.price) * direction;
      }

      if (sortBy === "tax") {
        return (a.tax_rate - b.tax_rate) * direction;
      }

      return (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * direction;
    });
  }, [filteredItems, sortBy, sortDirection]);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedItems]);
  const pageStart = sortedItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, sortedItems.length);
  const categoryNameById = useMemo(
    () => Object.fromEntries(categoryOptions.map((category) => [category.id, category.name])),
    [categoryOptions],
  );
  const exportSourceItems = useMemo(
    () =>
      includeProductsWithoutStock
        ? sortedItems
        : sortedItems.filter((item) => Number(inventoryQtyByProductId[item.id] || 0) > 0),
    [includeProductsWithoutStock, inventoryQtyByProductId, sortedItems],
  );
  const getExportPrice = useCallback(
    (item: CatalogItem) => (exportPriceField === "wholesale_price" ? item.wholesale_price : item.price),
    [exportPriceField],
  );
  const decapExportItems = useMemo(
    () =>
      exportSourceItems.map((item) => ({
        id: item.id,
        filename: `${slugify(item.name)}.md`,
        name: item.name,
        exportPrice: getExportPrice(item),
        stockQty: Number(inventoryQtyByProductId[item.id] || 0),
        markdown: buildDecapProductMarkdown(
          item,
          categoryNameById[item.category_id] || "",
          Number(inventoryQtyByProductId[item.id] || 0),
          getExportPrice(item),
        ),
      })),
    [categoryNameById, exportSourceItems, getExportPrice, inventoryQtyByProductId],
  );

  const openNewSheet = (type: CatalogType) => {
    if (!canCreateProducts) {
      setItemsErrorMessage("Solo administrador o supervisor puede crear productos o servicios.");
      return;
    }

    if (isCategorySetupMissing) {
      setItemsErrorMessage("Primero debes configurar al menos una categoria para crear productos o servicios.");
      return;
    }

    setEditingItemId(null);
    setEntryType(type);
    setForm(makeEmptyForm(type));
    setIsSheetOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCategorySetupMissing) {
      setItemsErrorMessage("Primero debes configurar al menos una categoria para guardar productos o servicios.");
      return;
    }

    if (!form.name.trim()) {
      return;
    }

    const payload: ProductPayload = {
      categoryId: form.category_id.trim() || undefined,
      sku: form.sku.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      name: form.name.trim(),
      unit: form.unit,
      allowDecimalQty: Number(form.allow_decimal_qty || "0") === 1,
      cost: Number(form.cost || "0"),
      price: Number(form.price || "0"),
      wholesalePrice: Number(form.wholesale_price || form.price || "0"),
      taxRate: Number(form.tax_rate || "0"),
      isActive: Number(form.is_active || "1") === 1,
    };

    try {
      setIsSubmittingItem(true);

      if (editingItemId !== null) {
        const response = await updateProduct(editingItemId, payload);
        const parsedItem = mapApiProductToCatalogItem(response.product);
        setItems((prev) => prev.map((item) => (item.id === editingItemId ? parsedItem : item)));
      } else {
        const response = await createProduct(payload);
        const parsedItem = mapApiProductToCatalogItem(response.product);
        setItems((prev) => [parsedItem, ...prev]);
      }

      setEditingItemId(null);
      setForm(makeEmptyForm("Product"));
      setIsSheetOpen(false);
      setItemsErrorMessage(null);
    } catch (error) {
      setItemsErrorMessage(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleEdit = (item: CatalogItem) => {
    setEditingItemId(item.id);
    setEntryType(item.unit === "service" ? "Service" : "Product");
    setForm({
      category_id: item.category_id,
      sku: item.sku,
      barcode: item.barcode,
      name: item.name,
      unit: item.unit,
      allow_decimal_qty: String(item.allow_decimal_qty),
      cost: item.cost.toFixed(2),
      price: item.price.toFixed(2),
      wholesale_price: item.wholesale_price.toFixed(2),
      tax_rate: item.tax_rate.toFixed(2),
      is_active: String(item.is_active),
    });
    setIsSheetOpen(true);
  };

  const clearSearchFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setSortBy("name");
    setSortDirection("asc");
    setCurrentPage(1);
  };

  const copyExportText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopiedExportId(id);
  };

  const downloadTextFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportSheetOpen(false);
  };

  const handleDownloadPlainTextExport = () => {
    const sanitizeTextValue = (value: string) => value.replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
    const priceHeader = exportPriceField === "wholesale_price" ? "precio_mayoreo" : "precio";
    const content = [
      `nombre\t${priceHeader}`,
      ...exportSourceItems.map((item) => `${sanitizeTextValue(item.name)}\t${getExportPrice(item).toFixed(2)}`),
    ].join("\n");

    downloadTextFile(content, "productos-servicios.txt", "text/plain;charset=utf-8");
  };

  const handleDownloadDecapExport = () => {
    const content = decapExportItems
      .map((item) => [`# ${item.filename}`, item.markdown].join("\n"))
      .join("\n\n");

    downloadTextFile(content, "productos-servicios-decap.md", "text/markdown;charset=utf-8");
  };

  const handleDownloadExport = () => {
    if (exportFormat === "txt") {
      handleDownloadPlainTextExport();
      return;
    }

    if (exportFormat === "decap") {
      handleDownloadDecapExport();
      return;
    }

    setItemsErrorMessage("Este formato de exportacion aun no esta disponible.");
  };

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setIsLoadingItems(true);
        const [categoriesResponse, productsResponse, meResponse, inventoryResponse] = await Promise.all([
          getCategories(),
          getProducts(),
          getMe(),
          getInventory().catch(() => ({ inventory: [] })),
        ]);

        if (!isMounted) {
          return;
        }

        setCategoryOptions(
          categoriesResponse.categories
            .filter((category) => category.estatus)
            .map((category) => ({
              id: category.id,
              name: category.name,
            })),
        );
        setItems(productsResponse.products.map(mapApiProductToCatalogItem));
        setCurrentUserRole(meResponse.role);
        setInventoryQtyByProductId(
          inventoryResponse.inventory.reduce<Record<string, number>>((acc, inventoryItem) => {
            acc[inventoryItem.productId] =
              Number(acc[inventoryItem.productId] || 0) + Number(inventoryItem.qtyOnHand || 0);
            return acc;
          }, {}),
        );
        setItemsErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setItems([]);
        setCategoryOptions([]);
        setCurrentUserRole(null);
        setInventoryQtyByProductId({});
        setItemsErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los productos.");
      } finally {
        if (isMounted) {
          setIsLoadingItems(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, statusFilter, categoryFilter, sortBy, sortDirection, pageSize]);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Productos y servicios</h1>
          <p className="mt-2 text-sm text-gray-600">
            Crea y edita productos/servicios con todos los campos del modelo.
          </p>
          {isLoadingItems ? <p className="mt-1 text-xs text-gray-500">Cargando productos...</p> : null}
          {itemsErrorMessage ? <p className="mt-1 text-xs text-red-600">{itemsErrorMessage}</p> : null}
          <p className="mt-1 text-xs text-gray-500">
            Total registros: {items.length} | Activos: {totalActivos} | Mostrando: {filteredItems.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-label="Opciones de exportacion"
            title="Opciones de exportacion"
            isIconOnly
            onPress={() => setIsExportSheetOpen(true)}
            isDisabled={isLoadingItems || sortedItems.length === 0}
            className="rounded bg-gray-100 px-2 py-2 text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
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
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </Button>
          {canCreateProducts ? (
            <Button
              onPress={() => openNewSheet("Product")}
              isDisabled={isCategorySetupMissing}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Nuevo
            </Button>
          ) : null}
        </div>
      </div>

      {isCategorySetupMissing ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Configura categorias antes de crear productos</p>
              <p className="text-sm text-amber-800">
                No hay categorias activas disponibles. Crea al menos una categoria para continuar.
              </p>
            </div>
            <Button
              onPress={() => router.push("/admin?tab=categorias")}
              className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Ir a administracion
            </Button>
          </div>
        </section>
      ) : null}

      <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-7">
          <div className="flex flex-col gap-1">
            <label htmlFor="products-search" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Buscar
            </label>
            <input
              id="products-search"
              type="text"
              placeholder="Nombre, SKU o codigo de barras"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="products-type-filter" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Tipo
            </label>
            <select
              id="products-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as "all" | "product" | "service")}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              <option value="all">Todos</option>
              <option value="product">Producto</option>
              <option value="service">Servicio</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="products-status-filter" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Estado
            </label>
            <select
              id="products-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              <option value="all">Todos</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="products-category-filter" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Categoria
            </label>
            <select
              id="products-category-filter"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              <option value="all">Todas</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="products-sort-by" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Ordenar por
            </label>
            <select
              id="products-sort-by"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as "name" | "price" | "tax" | "updatedAt")}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              <option value="name">Nombre</option>
              <option value="price">Precio</option>
              <option value="tax">Impuesto</option>
              <option value="updatedAt">Actualizacion</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="products-sort-direction" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Direccion
            </label>
            <select
              id="products-sort-direction"
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <Button
              onPress={clearSearchFilters}
              isDisabled={!hasActiveSearchFilters}
              className="h-10 rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              Limpiar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="hidden min-w-[67.5rem] grid-cols-9 gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 md:grid">
            <p>Tipo</p>
            <p>Nombre</p>
            <p>SKU</p>
            <p>Unidad</p>
            <p>Precio</p>
            <p>Mayoreo</p>
            <p>Impuesto</p>
            <p>Estado</p>
            <p>Acciones</p>
          </div>

          <div className="min-w-0 md:min-w-[67.5rem]">
            {isLoadingItems
              ? Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="grid animate-pulse gap-2 border-b border-gray-100 px-5 py-4 md:grid-cols-9 md:items-center md:gap-4"
                  >
                    <div className="h-4 w-20 rounded bg-gray-200" />
                    <div className="h-4 w-36 rounded bg-gray-200" />
                    <div className="h-4 w-20 rounded bg-gray-200" />
                    <div className="h-4 w-14 rounded bg-gray-200" />
                    <div className="h-4 w-16 rounded bg-gray-200" />
                    <div className="h-4 w-16 rounded bg-gray-200" />
                    <div className="h-4 w-14 rounded bg-gray-200" />
                    <div className="h-6 w-20 rounded-full bg-gray-200" />
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded bg-gray-200" />
                      <div className="h-8 w-8 rounded bg-gray-200" />
                    </div>
                  </div>
                ))
              : null}
            {!isLoadingItems && sortedItems.length === 0 ? (
              <div className="px-5 py-4 text-sm text-gray-600">No hay resultados para los filtros seleccionados.</div>
            ) : null}
            {paginatedItems.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 border-b border-gray-100 px-5 py-4 text-sm text-gray-800 md:grid-cols-9 md:items-center md:gap-4"
              >
                <p className="font-medium text-gray-700">{item.unit === "service" ? "Servicio" : "Producto"}</p>
                <p className="font-medium text-gray-900">{item.name}</p>
                <p>{item.sku || "-"}</p>
                <p>{item.unit}</p>
                <p>${item.price.toFixed(2)}</p>
                <p>${item.wholesale_price.toFixed(2)}</p>
                <p>{item.tax_rate.toFixed(2)}%</p>
                <p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      item.is_active === 1 ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {item.is_active === 1 ? "Activo" : "Inactivo"}
                  </span>
                </p>
                {canCreateProducts ? (
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    isIconOnly
                    aria-label="Editar"
                    onPress={() => handleEdit(item)}
                    className="rounded bg-gray-100 px-2 py-2 text-gray-700 hover:bg-gray-200"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </Button>
                  
                    <Button
                      size="sm"
                      isIconOnly
                      aria-label="Inventario y movimientos"
                      onPress={() => router.push(`/inventory?item_id=${encodeURIComponent(item.id)}`)}
                      className="rounded bg-blue-50 px-2 py-2 text-blue-700 hover:bg-blue-100"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <path d="m3.3 7 8.7 5 8.7-5" />
                        <path d="M12 22V12" />
                      </svg>
                    </Button>
                  
                </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span>
              Mostrando {pageStart}-{pageEnd} de {sortedItems.length}
            </span>
            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Por pagina</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none focus:border-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              isDisabled={currentPage === 1 || sortedItems.length === 0}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              Anterior
            </Button>
            <span className="min-w-24 text-center text-sm font-medium text-gray-700">
              Pagina {currentPage} de {totalPages}
            </span>
            <Button
              size="sm"
              onPress={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              isDisabled={currentPage === totalPages || sortedItems.length === 0}
              className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Card>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsSheetOpen(false)}
      />

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isExportSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsExportSheetOpen(false)}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
          isExportSheetOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Exportar a Decap CMS</h2>
            <p className="mt-1 text-xs text-gray-500">Copia cada producto como archivo Markdown para Eleventy.</p>
          </div>
          <Button
            onPress={() => setIsExportSheetOpen(false)}
            className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Cerrar
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="products-export-format" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Tipo de exportacion
            </label>
            <select
              id="products-export-format"
              value={exportFormat}
              onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              <option value="decap">Decap CMS</option>
              <option value="txt">Texto plano</option>
              <option value="xlsx">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <label
            htmlFor="products-export-include-without-stock"
            className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3"
          >
            <input
              id="products-export-include-without-stock"
              type="checkbox"
              checked={includeProductsWithoutStock}
              onChange={(event) => setIncludeProductsWithoutStock(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block text-sm font-medium text-gray-800">Incluir productos sin stock</span>
              <span className="mt-1 block text-xs text-gray-500">
                Desactivalo para exportar solo productos con existencia mayor a 0.
              </span>
            </span>
          </label>

          <div className="flex flex-col gap-1">
            <label htmlFor="products-export-price-field" className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Precio para exportar
            </label>
            <select
              id="products-export-price-field"
              value={exportPriceField}
              onChange={(event) => setExportPriceField(event.target.value as ExportPriceField)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500"
            >
              <option value="price">Precio</option>
              <option value="wholesale_price">Precio mayoreo</option>
            </select>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Formato</p>
            <p className="mt-1 text-sm text-gray-700">
              {exportFormat === "decap"
                ? "Coleccion Decap: products"
                : exportFormat === "txt"
                  ? "Texto plano: nombre, precio"
                  : "Proximamente"}
            </p>
            {exportFormat === "decap" ? (
              <p className="mt-1 text-xs text-gray-500">La imagen queda vacia para subirla manualmente.</p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500">
              Precio: {exportPriceField === "wholesale_price" ? "mayoreo" : "regular"}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Registros: {decapExportItems.length} de {sortedItems.length}
            </p>
          </div>

          <Button
            onPress={handleDownloadExport}
            isDisabled={isLoadingItems || decapExportItems.length === 0}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {exportFormat === "txt" ? "Descargar texto plano" : exportFormat === "decap" ? "Descargar Decap CMS" : "Proximamente"}
          </Button>

          {exportFormat === "decap" ? (
          <div className="space-y-3">
            {decapExportItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {item.filename} | Stock: {item.stockQty} | Precio: ${item.exportPrice.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onPress={() => void copyExportText(item.id, item.markdown)}
                    className="shrink-0 rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    {copiedExportId === item.id ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={item.markdown}
                  className="h-64 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-800 outline-none"
                />
              </div>
            ))}
          </div>
          ) : null}
        </div>
      </aside>

      <ProductsServicesSheet
        isSheetOpen={isSheetOpen}
        editingItemId={editingItemId}
        entryType={entryType}
        setIsSheetOpen={setIsSheetOpen}
        setEntryType={setEntryType}
        form={form}
        setForm={setForm}
        categoryOptions={categoryOptions}
        unitOptions={unitOptions}
        handleSubmit={handleSubmit}
        isSubmitting={isSubmittingItem}
      />
    </section>
  );
}
