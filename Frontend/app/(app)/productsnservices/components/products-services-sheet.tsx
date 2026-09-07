"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";

type CatalogType = "Product" | "Service";
type Unit = "pc" | "kg" | "g" | "l" | "ml" | "box" | "pack" | "service";

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

type ProductsServicesSheetProps = {
  isSheetOpen: boolean;
  editingItemId: string | null;
  entryType: CatalogType;
  setIsSheetOpen: Dispatch<SetStateAction<boolean>>;
  setEntryType: Dispatch<SetStateAction<CatalogType>>;
  form: ProductForm;
  setForm: Dispatch<SetStateAction<ProductForm>>;
  categoryOptions: CategoryOption[];
  unitOptions: Unit[];
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  isSubmitting: boolean;
};

type BarcodeDetectorResult = {
  rawValue: string;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorWindow = Window &
  typeof globalThis & {
    BarcodeDetector?: BarcodeDetectorConstructor;
  };

function buildBarcodePattern(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  // Visual-only barcode preview pattern (not intended for scanner-grade encoding).
  let bits = "101011"; // start guard
  for (const char of normalized) {
    bits += char.charCodeAt(0).toString(2).padStart(8, "0");
    bits += "0";
  }
  bits += "110101"; // end guard
  return bits;
}

export function ProductsServicesSheet({
  isSheetOpen,
  editingItemId,
  entryType,
  setIsSheetOpen,
  setEntryType,
  form,
  setForm,
  categoryOptions,
  unitOptions,
  handleSubmit,
  isSubmitting,
}: ProductsServicesSheetProps) {
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [isScannerStarting, setIsScannerStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const barcodePattern = buildBarcodePattern(form.barcode);
  const isNameValid = form.name.trim().length > 0;
  const isCategoryValid = form.category_id.trim().length > 0;
  const isSkuValid = form.sku.trim().length > 0;
  const costValue = Number(form.cost);
  const priceValue = Number(form.price);
  const wholesalePriceValue = Number(form.wholesale_price);
  const isCostValid = Number.isFinite(costValue) && costValue > 0;
  const isPriceValid = Number.isFinite(priceValue) && priceValue > 0;
  const isWholesalePriceValid = Number.isFinite(wholesalePriceValue) && wholesalePriceValue > 0;
  const canSubmit =
    isNameValid &&
    isCategoryValid &&
    isSkuValid &&
    isCostValid &&
    isPriceValid &&
    isWholesalePriceValid;

  useEffect(() => {
    if (isSheetOpen) {
      queueMicrotask(() => setShowValidationErrors(false));
    }
  }, [isSheetOpen, editingItemId]);

  const stopScannerResources = useCallback(() => {
    if (scanFrameRef.current !== null) {
      window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopScanner = useCallback(() => {
    stopScannerResources();
    setIsScannerOpen(false);
    setIsScannerStarting(false);
  }, [stopScannerResources]);

  const startScanner = useCallback(async () => {
    setScannerError("");
    setIsScannerOpen(true);
    setIsScannerStarting(true);

    const barcodeDetector = (window as BarcodeDetectorWindow).BarcodeDetector;

    if (!barcodeDetector) {
      setScannerError("Tu navegador no soporta lectura de codigos de barras con la camara.");
      setIsScannerStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) {
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new barcodeDetector({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf"],
      });

      const scan = async () => {
        if (!videoRef.current) {
          return;
        }

        if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          scanFrameRef.current = window.requestAnimationFrame(scan);
          return;
        }

        try {
          const results = await detector.detect(videoRef.current);
          const barcode = results[0]?.rawValue;

          if (barcode) {
            setForm((prev) => ({ ...prev, barcode }));
            stopScanner();
            return;
          }
        } catch {
          // Some browsers throw while the camera stream is settling; keep scanning.
        }

        scanFrameRef.current = window.requestAnimationFrame(scan);
      };

      setIsScannerStarting(false);
      scanFrameRef.current = window.requestAnimationFrame(scan);
    } catch {
      setScannerError("No se pudo abrir la camara. Revisa los permisos del navegador.");
      setIsScannerStarting(false);
    }
  }, [setForm, stopScanner]);

  useEffect(() => {
    if (!isSheetOpen) {
      stopScannerResources();
      queueMicrotask(() => {
        setIsScannerOpen(false);
        setIsScannerStarting(false);
      });
    }
  }, [isSheetOpen, stopScannerResources]);

  useEffect(() => {
    return () => stopScanner();
  }, [stopScanner]);

  return (
    <aside
      className={`fixed top-0 right-0 z-50 h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
        isSheetOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {editingItemId ? "Editar" : "Crear"} {entryType === "Product" ? "producto" : "servicio"}
          </h2>
          <p className="mt-1 text-xs text-gray-500">Completa los datos comerciales y de inventario.</p>
        </div>
        <Button
          onPress={() => setIsSheetOpen(false)}
          isDisabled={isSubmitting}
          className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          Cerrar
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        <Button
          onPress={() => {
            setEntryType("Product");
            setForm((prev) => ({ ...prev, unit: prev.unit === "service" ? "pc" : prev.unit }));
          }}
          isDisabled={isSubmitting}
          className={`rounded-xl px-3 py-1.5 text-sm ${
            entryType === "Product" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Producto
        </Button>
        <Button
          onPress={() => {
            setEntryType("Service");
            setForm((prev) => ({ ...prev, unit: "service" }));
          }}
          isDisabled={isSubmitting}
          className={`rounded-xl px-3 py-1.5 text-sm ${
            entryType === "Service" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Servicio
        </Button>
      </div>

      <form
        onSubmit={(event) => {
          setShowValidationErrors(true);
          if (!canSubmit) {
            event.preventDefault();
            return;
          }
          void handleSubmit(event);
        }}
        className="space-y-4 rounded-xl bg-white p-4"
      >
        <TextField>
          <Label className="text-sm font-medium text-gray-800">Nombre</Label>
          <Input
            type="text"
            className={`w-full rounded-xl ${!showValidationErrors || isNameValid ? "border-border/60" : "border-red-300"}`}
            placeholder={entryType === "Product" ? "Ej. Refresco 600ml" : "Ej. Instalacion de equipo"}
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          {showValidationErrors && !isNameValid ? (
            <p className="mt-1 text-xs text-red-600">El nombre es obligatorio.</p>
          ) : null}
          <FieldError className="text-xs" />
        </TextField>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Categoria</Label>
            <select
              className={`w-full rounded-xl border bg-white px-3 py-2 text-sm text-gray-800 ${
                !showValidationErrors || isCategoryValid ? "border-gray-300" : "border-red-300"
              }`}
              value={form.category_id}
              onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}
            >
              <option value="">Selecciona una categoria</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {showValidationErrors && !isCategoryValid ? (
              <p className="mt-1 text-xs text-red-600">Selecciona una categoria valida.</p>
            ) : null}
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Unidad</Label>
            <select
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
              value={form.unit}
              onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value as Unit }))}
            >
              {unitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <FieldError className="text-xs" />
          </TextField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField>
            <Label className="text-sm font-medium text-gray-800">SKU</Label>
            <Input
              type="text"
              className={`w-full rounded-xl ${!showValidationErrors || isSkuValid ? "border-border/60" : "border-red-300"}`}
              placeholder="SKU-001"
              value={form.sku}
              onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
            />
            {showValidationErrors && !isSkuValid ? (
              <p className="mt-1 text-xs text-red-600">El SKU es obligatorio.</p>
            ) : null}
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Codigo de barras</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                className="w-full rounded-xl border-border/60"
                placeholder="750100000001"
                value={form.barcode}
                onChange={(event) => setForm((prev) => ({ ...prev, barcode: event.target.value }))}
              />
              <Button
                type="button"
                aria-label="Leer codigo de barras con camara"
                title="Leer con camara"
                onPress={startScanner}
                isDisabled={isSubmitting || isScannerOpen}
                className="min-w-11 rounded-xl bg-gray-100 px-3 text-gray-700 hover:bg-gray-200"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </Button>
            </div>
            <FieldError className="text-xs" />
          </TextField>
        </div>
        

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Permitir decimales</Label>
            <select
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
              value={form.allow_decimal_qty}
              onChange={(event) => setForm((prev) => ({ ...prev, allow_decimal_qty: event.target.value }))}
            >
              <option value="0">No</option>
              <option value="1">Si</option>
            </select>
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Estatus</Label>
            <select
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
              value={form.is_active}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.value }))}
            >
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
            <FieldError className="text-xs" />
          </TextField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Costo</Label>
            <Input
              type="number"
              step="0.01"
              className={`w-full rounded-xl ${!showValidationErrors || isCostValid ? "border-border/60" : "border-red-300"}`}
              placeholder="0.00"
              value={form.cost}
              onChange={(event) => setForm((prev) => ({ ...prev, cost: event.target.value }))}
            />
            {showValidationErrors && !isCostValid ? (
              <p className="mt-1 text-xs text-red-600">El costo debe ser mayor a 0.00.</p>
            ) : null}
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Precio</Label>
            <Input
              type="number"
              step="0.01"
              className={`w-full rounded-xl ${!showValidationErrors || isPriceValid ? "border-border/60" : "border-red-300"}`}
              placeholder="0.00"
              value={form.price}
              onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
            />
            {showValidationErrors && !isPriceValid ? (
              <p className="mt-1 text-xs text-red-600">El precio debe ser mayor a 0.00.</p>
            ) : null}
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Precio mayoreo</Label>
            <Input
              type="number"
              step="0.01"
              className={`w-full rounded-xl ${!showValidationErrors || isWholesalePriceValid ? "border-border/60" : "border-red-300"}`}
              placeholder="0.00"
              value={form.wholesale_price}
              onChange={(event) => setForm((prev) => ({ ...prev, wholesale_price: event.target.value }))}
            />
            {showValidationErrors && !isWholesalePriceValid ? (
              <p className="mt-1 text-xs text-red-600">El precio mayoreo debe ser mayor a 0.00.</p>
            ) : null}
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Impuesto (%)</Label>
            <Input
              type="number"
              step="0.01"
              className="w-full rounded-xl border-border/60"
              placeholder="16.00"
              value={form.tax_rate}
              onChange={(event) => setForm((prev) => ({ ...prev, tax_rate: event.target.value }))}
            />
            <FieldError className="text-xs" />
          </TextField>
        </div>

        {barcodePattern ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Vista previa de codigo</p>
            <div className="overflow-x-auto rounded-md bg-white p-2">
              <div className="flex h-14 min-w-max items-stretch">
                {barcodePattern.split("").map((bit, index) => (
                  <span
                    key={`${bit}-${index}`}
                    className={bit === "1" ? "bg-black" : "bg-white"}
                    style={{ width: 2 }}
                  />
                ))}
              </div>
            </div>
            <p className="mt-2 text-center font-mono text-xs tracking-widest text-gray-700">{form.barcode}</p>
          </div>
        ) : null}
        
        <Button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          isLoading={isSubmitting}
          isDisabled={isSubmitting}
        >
          {editingItemId !== null ? "Actualizar" : "Guardar"} {entryType === "Product" ? "producto" : "servicio"}
        </Button>
      </form>

      {isScannerOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Leer codigo de barras</h3>
              <Button
                type="button"
                onPress={stopScanner}
                className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
              >
                Cerrar
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
            </div>
            {isScannerStarting ? <p className="mt-3 text-sm text-gray-600">Abriendo camara...</p> : null}
            {scannerError ? <p className="mt-3 text-sm text-red-600">{scannerError}</p> : null}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
