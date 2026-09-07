"use client";

import { Button, Input, Switch, TextArea, toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createCoupon,
  getCoupons,
  type Coupon,
  updateCoupon,
  validateCoupon,
} from "@/api-implementations/promotions";
import { AdminNavbar } from "@/app/components/admin-navbar";

type CouponForm = {
  code: string;
  name: string;
  description: string;
  scope: Coupon["scope"];
  targetRef: string;
  discountType: Coupon["discountType"];
  discountValue: string;
  maxDiscountAmount: string;
  minOrderAmount: string;
  usageLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const EMPTY_FORM: CouponForm = {
  code: "",
  name: "",
  description: "",
  scope: "subscription_plan",
  targetRef: "PRO",
  discountType: "percentage",
  discountValue: "10",
  maxDiscountAmount: "",
  minOrderAmount: "",
  usageLimit: "",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromCouponToForm(coupon: Coupon): CouponForm {
  return {
    code: coupon.code,
    name: coupon.name,
    description: coupon.description || "",
    scope: coupon.scope,
    targetRef: coupon.targetRef || "",
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue),
    maxDiscountAmount: coupon.maxDiscountAmount == null ? "" : String(coupon.maxDiscountAmount),
    minOrderAmount: coupon.minOrderAmount == null ? "" : String(coupon.minOrderAmount),
    usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
    startsAt: toDateTimeLocal(coupon.startsAt),
    endsAt: toDateTimeLocal(coupon.endsAt),
    isActive: coupon.isActive,
  };
}

export function CouponManagementPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
  const [validationCode, setValidationCode] = useState("");
  const [validationSubtotal, setValidationSubtotal] = useState("399");
  const [validationResult, setValidationResult] = useState<Awaited<ReturnType<typeof validateCoupon>> | null>(null);

  useEffect(() => {
    const nextToken = window.localStorage.getItem("authToken") || "";
    if (!nextToken) {
      router.replace("/signin");
      return;
    }

    setToken(nextToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;
    const loadCoupons = async () => {
      try {
        setIsLoading(true);
        const nextCoupons = await getCoupons(token);
        if (!isMounted) return;
        setCoupons(nextCoupons);
      } catch (error) {
        if (!isMounted) return;
        toast.danger("No se pudieron cargar los cupones", {
          description: error instanceof Error ? error.message : "Error desconocido.",
          actionProps: { children: "Cerrar", onPress: () => toast.clear(), variant: "tertiary" },
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadCoupons();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const activeCoupons = useMemo(() => coupons.filter((coupon) => coupon.isActive).length, [coupons]);
  const subscriptionCoupons = useMemo(
    () => coupons.filter((coupon) => coupon.scope === "subscription" || coupon.scope === "subscription_plan").length,
    [coupons],
  );

  const inputClassName = "rounded-2xl border-slate-300/80";
  const selectClassName =
    "w-full rounded-2xl border border-slate-300/80 bg-white px-3.5 py-3 text-sm text-slate-900";

  const refreshCoupons = async () => {
    if (!token) return;
    const nextCoupons = await getCoupons(token);
    setCoupons(nextCoupons);
  };

  const resetForm = () => {
    setSelectedCouponId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async () => {
    if (!token) return;

    if (!form.code.trim() || !form.name.trim() || !form.discountValue.trim()) {
      toast.danger("Formulario incompleto", {
        description: "Code, nombre y valor de descuento son requeridos.",
        actionProps: { children: "Cerrar", onPress: () => toast.clear(), variant: "tertiary" },
      });
      return;
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      scope: form.scope,
      targetRef: form.targetRef.trim() || null,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
      minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      isActive: form.isActive,
    } as const;

    try {
      setIsSaving(true);
      if (selectedCouponId) {
        await updateCoupon(token, selectedCouponId, payload);
        toast.success("Cupon actualizado", {
          description: "Los cambios se guardaron correctamente.",
          actionProps: { children: "OK", onPress: () => toast.clear(), variant: "tertiary" },
        });
      } else {
        await createCoupon(token, payload);
        toast.success("Cupon creado", {
          description: "El nuevo cupon ya esta disponible para el tenant.",
          actionProps: { children: "OK", onPress: () => toast.clear(), variant: "tertiary" },
        });
      }

      await refreshCoupons();
      resetForm();
    } catch (error) {
      toast.danger("No se pudo guardar el cupon", {
        description: error instanceof Error ? error.message : "Error desconocido.",
        actionProps: { children: "Cerrar", onPress: () => toast.clear(), variant: "tertiary" },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (!token || !validationCode.trim()) return;

    try {
      const result = await validateCoupon(token, {
        code: validationCode.trim().toUpperCase(),
        subtotal: Number(validationSubtotal || 0),
      });
      setValidationResult(result);
    } catch (error) {
      toast.danger("No se pudo validar el cupon", {
        description: error instanceof Error ? error.message : "Error desconocido.",
        actionProps: { children: "Cerrar", onPress: () => toast.clear(), variant: "tertiary" },
      });
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <AdminNavbar />

        <section className="rounded-[32px] border border-slate-200 bg-white/95 p-8 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700">FrontAdm</p>
              <h1 className="mt-4 text-3xl font-bold text-slate-950">Gestion de cupones</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                Administra cupones y descuentos del tenant desde el panel tecnico. Esta vista esta pensada para alta, edicion y validacion operativa de promociones, incluyendo cupones de suscripcion para el signup.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-emerald-700">Total</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-950">{coupons.length}</p>
              </div>
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-sky-700">Activos</p>
                <p className="mt-1 text-2xl font-semibold text-sky-950">{activeCoupons}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-violet-700">Suscripcion</p>
                <p className="mt-1 text-2xl font-semibold text-violet-950">{subscriptionCoupons}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  {selectedCouponId ? "Editar cupon" : "Nuevo cupon"}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Configuracion</h2>
              </div>
              <Button onPress={resetForm} className="rounded-2xl bg-slate-100 text-slate-700">
                Limpiar
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Code"
                  className={inputClassName}
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  placeholder="BIENVENIDA10"
                />
                <Input
                  label="Nombre"
                  className={inputClassName}
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Cupon de bienvenida"
                />
              </div>

              <TextArea
                label="Descripcion"
                className={inputClassName}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Promocion para nuevos clientes"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-800">Scope</label>
                  <select
                    className={selectClassName}
                    value={form.scope}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, scope: event.target.value as Coupon["scope"] }))
                    }
                  >
                    <option value="order">order</option>
                    <option value="product">product</option>
                    <option value="category">category</option>
                    <option value="customer">customer</option>
                    <option value="subscription">subscription</option>
                    <option value="subscription_plan">subscription_plan</option>
                  </select>
                </div>
                <Input
                  label="Target ref"
                  className={inputClassName}
                  value={form.targetRef}
                  onChange={(event) => setForm((prev) => ({ ...prev, targetRef: event.target.value }))}
                  placeholder="PRO / category-id / customer-id"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-800">Tipo</label>
                  <select
                    className={selectClassName}
                    value={form.discountType}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        discountType: event.target.value as Coupon["discountType"],
                      }))
                    }
                  >
                    <option value="percentage">percentage</option>
                    <option value="fixed_amount">fixed_amount</option>
                  </select>
                </div>
                <Input
                  label="Valor"
                  className={inputClassName}
                  type="number"
                  value={form.discountValue}
                  onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
                  placeholder="10"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Max descuento"
                  className={inputClassName}
                  type="number"
                  value={form.maxDiscountAmount}
                  onChange={(event) => setForm((prev) => ({ ...prev, maxDiscountAmount: event.target.value }))}
                />
                <Input
                  label="Min orden"
                  className={inputClassName}
                  type="number"
                  value={form.minOrderAmount}
                  onChange={(event) => setForm((prev) => ({ ...prev, minOrderAmount: event.target.value }))}
                />
                <Input
                  label="Limite de uso"
                  className={inputClassName}
                  type="number"
                  value={form.usageLimit}
                  onChange={(event) => setForm((prev) => ({ ...prev, usageLimit: event.target.value }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Inicio"
                  type="datetime-local"
                  className={inputClassName}
                  value={form.startsAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, startsAt: event.target.value }))}
                />
                <Input
                  label="Fin"
                  type="datetime-local"
                  className={inputClassName}
                  value={form.endsAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, endsAt: event.target.value }))}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Switch
                  isSelected={form.isActive}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))}
                >
                  Cupon activo
                </Switch>
              </div>

              <Button
                isLoading={isSaving}
                onPress={() => {
                  void handleSubmit();
                }}
                className="h-12 w-full rounded-2xl bg-emerald-600 text-sm font-semibold text-white"
              >
                {selectedCouponId ? "Actualizar cupon" : "Crear cupon"}
              </Button>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Validacion</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Probar cupon</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                  <Input
                    className={inputClassName}
                    value={validationCode}
                    onChange={(event) => setValidationCode(event.target.value.toUpperCase())}
                    placeholder="BIENVENIDA10"
                  />
                  <Input
                    className={inputClassName}
                    type="number"
                    value={validationSubtotal}
                    onChange={(event) => setValidationSubtotal(event.target.value)}
                    placeholder="399"
                  />
                  <Button
                    onPress={() => {
                      void handleValidate();
                    }}
                    className="rounded-2xl bg-sky-600 text-white"
                  >
                    Validar
                  </Button>
                </div>
              </div>

              {validationResult ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Valido</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {validationResult.isValid ? "Si" : "No"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">Descuento</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-950">
                      ${validationResult.discountAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-sky-700">Subtotal final</p>
                    <p className="mt-1 text-lg font-semibold text-sky-950">
                      ${validationResult.finalSubtotal.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-amber-700">Motivo</p>
                    <p className="mt-1 text-sm font-medium text-amber-950">
                      {validationResult.reason || "Aplicado correctamente"}
                    </p>
                  </div>
                </div>
              ) : null}
            </section>

            <section
              id="coupon-management"
              className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Catalogo</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Cupones del tenant</h2>
                </div>
                <Button
                  onPress={() => {
                    void refreshCoupons();
                  }}
                  className="rounded-2xl bg-slate-100 text-slate-700"
                >
                  Recargar
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {isLoading ? <p className="text-sm text-slate-500">Cargando cupones...</p> : null}
                {!isLoading && coupons.length === 0 ? (
                  <p className="text-sm text-slate-500">Aun no hay cupones registrados para este tenant.</p>
                ) : null}

                {coupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-950">{coupon.code}</p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                              coupon.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {coupon.isActive ? "Activo" : "Inactivo"}
                          </span>
                          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                            {coupon.scope}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-900">{coupon.name}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {coupon.description || "Sin descripcion"}
                        </p>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                          <span>Tipo: {coupon.discountType}</span>
                          <span>Valor: {coupon.discountValue}</span>
                          <span>Target: {coupon.targetRef || "General"}</span>
                          <span>Usos: {coupon.usedCount}/{coupon.usageLimit ?? "∞"}</span>
                        </div>
                      </div>

                      <Button
                        onPress={() => {
                          setSelectedCouponId(coupon.id);
                          setForm(fromCouponToForm(coupon));
                        }}
                        className="rounded-2xl bg-slate-900 text-white"
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
