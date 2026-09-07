"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Label, Switch, Tabs, toast } from "@heroui/react";
import {
  getTenantSubscription,
  type SubscriptionPlanCode,
  type TenantSubscription,
  updateTenantSubscription,
} from "@/api-implementations/tenants";
import {
  getSubscriptionPlans,
  type SubscriptionPlan,
} from "@/api-implementations/subscription-plans";
import { SectionHeader } from "./shared";

type SubscriptionForm = {
  planCode: SubscriptionPlanCode;
  status: "trialing" | "trial_ended" | "active" | "past_due" | "suspended" | "canceled";
  autoRenew: boolean;
  paymentProvider: string;
  paymentCustomerRef: string;
  paymentMethodToken: string;
  paymentMethodBrand: string;
  paymentMethodLast4: string;
  paymentMethodStatus: "pending" | "ready" | "expired" | "revoked";
  trialEndsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  limitsUsers: string;
  limitsBranches: string;
  limitsProducts: string;
  limitsOrdersPerMonth: string;
  limitsCustomers: string;
};

const PLAN_DESCRIPTIONS: Record<SubscriptionForm["planCode"], string> = {
  BASIC: "Plan inicial para negocios pequenos con operacion esencial.",
  FREE: "Plan base para iniciar: limites reducidos y operacion esencial.",
  PREMIUM: "Plan premium para operacion multi-sucursal, soporte prioritario y automatizaciones.",
  STARTER: "Plan para negocios en crecimiento con mas capacidad en usuarios y catalogo.",
  PRO: "Plan avanzado para operacion diaria intensiva y mayor volumen de ventas.",
  ENTERPRISE: "Plan empresarial con alta capacidad y escalabilidad.",
};

const PLAN_LIMITS: Record<
  SubscriptionForm["planCode"],
  { users: string; branches: string; products: string; ordersPerMonth: string; customers: string }
> = {
  BASIC: { users: "1", branches: "1", products: "500", ordersPerMonth: "1,000", customers: "1,000" },
  FREE: { users: "1", branches: "1", products: "100", ordersPerMonth: "300", customers: "300" },
  PREMIUM: { users: "Ilimitado", branches: "Ilimitado", products: "Ilimitado", ordersPerMonth: "Ilimitado", customers: "Ilimitado" },
  STARTER: { users: "1", branches: "1", products: "500", ordersPerMonth: "1,000", customers: "1,000" },
  PRO: { users: "5", branches: "1", products: "5,000", ordersPerMonth: "5,000", customers: "5,000" },
  ENTERPRISE: { users: "Ilimitado", branches: "Ilimitado", products: "Ilimitado", ordersPerMonth: "Ilimitado", customers: "Ilimitado" },
};

const PLAN_COMMERCIAL_INFO: Record<
  SubscriptionForm["planCode"],
  { price: string; billing: string; recommendation: string }
> = {
  BASIC: {
    price: "$150 MXN",
    billing: "Mensual",
    recommendation: "Ideal para negocios pequenos que estan comenzando.",
  },
  FREE: {
    price: "$0 MXN",
    billing: "Mensual (sin costo)",
    recommendation: "Ideal para pruebas o negocios muy pequenos.",
  },
  PREMIUM: {
    price: "$599 MXN",
    billing: "Mensual",
    recommendation: "Ideal para escalamiento multi-sucursal y soporte prioritario.",
  },
  STARTER: {
    price: "$199 MXN",
    billing: "Mensual",
    recommendation: "Recomendado para etapas iniciales de crecimiento.",
  },
  PRO: {
    price: "$399 MXN",
    billing: "Mensual",
    recommendation: "Recomendado para operacion estable con mayor volumen.",
  },
  ENTERPRISE: {
    price: "$999 MXN",
    billing: "Mensual",
    recommendation: "Recomendado para multi-sucursal y alta escalabilidad.",
  },
};

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionForm["status"], string> = {
  trialing: "En prueba",
  trial_ended: "Prueba finalizada",
  active: "Activa",
  past_due: "Pago vencido",
  suspended: "Suspendida",
  canceled: "Cancelada",
};

function getSubscriptionStatusLabel(status: SubscriptionForm["status"]) {
  return SUBSCRIPTION_STATUS_LABELS[status] || status;
}

function toDateDDMMYYYY(value: string | null): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function formatDateDDMMYYYYInput(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function fromDateDDMMYYYY(value: string): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  const isValid =
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day;
  if (!isValid) return null;

  return utcDate.toISOString();
}

function toForm(data: TenantSubscription): SubscriptionForm {
  return {
    planCode: data.planCode,
    status: data.status,
    autoRenew: Boolean(data.autoRenew),
    paymentProvider: data.paymentProvider || "",
    paymentCustomerRef: data.paymentCustomerRef || "",
    paymentMethodToken: data.paymentMethodToken || "",
    paymentMethodBrand: data.paymentMethodBrand || "",
    paymentMethodLast4: data.paymentMethodLast4 || "",
    paymentMethodStatus: data.paymentMethodStatus || "pending",
    trialEndsAt: toDateDDMMYYYY(data.trialEndsAt),
    currentPeriodStart: toDateDDMMYYYY(data.currentPeriodStart),
    currentPeriodEnd: toDateDDMMYYYY(data.currentPeriodEnd),
    limitsUsers: String(data.limitsUsers ?? 0),
    limitsBranches: String(data.limitsBranches ?? 0),
    limitsProducts: String(data.limitsProducts ?? 0),
    limitsOrdersPerMonth: String(data.limitsOrdersPerMonth ?? 0),
    limitsCustomers: String(data.limitsCustomers ?? 0),
  };
}

export function SubscriptionTab() {
  const [form, setForm] = useState<SubscriptionForm | null>(null);
  const [initialForm, setInitialForm] = useState<SubscriptionForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const response = await getTenantSubscription();
        if (!isMounted) return;

        const mapped = toForm(response.subscription);
        setForm(mapped);
        setInitialForm(mapped);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar la suscripcion.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadPlans = async () => {
      try {
        const response = await getSubscriptionPlans();
        if (!isMounted) return;
        setAvailablePlans(response.plans);
      } catch {
        if (!isMounted) return;
        setAvailablePlans([]);
      }
    };

    void loadPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  const inputClassName = "rounded-xl border-border/60 bg-white";
  const isFormDisabled = isLoading || isSaving || !form;
  const hasUnsavedChanges = form && initialForm ? JSON.stringify(form) !== JSON.stringify(initialForm) : false;
  const isAlreadyCanceled = form?.status === "canceled";
  const hasPaymentMethod = Boolean(form?.paymentMethodToken.trim());
  const canUseAutoRenew = form ? form.planCode === "FREE" || hasPaymentMethod : false;

  const planOptions = (() => {

    const options = availablePlans.map((plan) => ({
      code: plan.code,
      label: `${plan.name} - $${plan.priceMxn} MXN/${plan.billingPeriod === "month" ? "mes" : plan.billingPeriod}`,
    }));

    if (form && !options.some((plan) => plan.code === form.planCode)) {
      options.unshift({
        code: form.planCode,
        label: form.planCode,
      });
    }

    return options;
  })();

  const handleSave = async () => {
    if (!form) return;

    const numericFields = [
      ["limitsUsers", form.limitsUsers],
      ["limitsBranches", form.limitsBranches],
      ["limitsProducts", form.limitsProducts],
      ["limitsOrdersPerMonth", form.limitsOrdersPerMonth],
      ["limitsCustomers", form.limitsCustomers],
    ] as const;

    const invalidField = numericFields.find(([, value]) => !Number.isInteger(Number(value)) || Number(value) < 0);
    if (invalidField) {
      setErrorMessage(`${invalidField[0]} debe ser un entero mayor o igual a 0.`);
      return;
    }

    if (form.paymentMethodLast4 && !/^\d{4}$/.test(form.paymentMethodLast4)) {
      setErrorMessage("Ultimos 4 digitos debe contener exactamente 4 numeros.");
      return;
    }

    if (form.paymentMethodToken && !form.paymentProvider.trim()) {
      setErrorMessage("Proveedor de pago es requerido cuando existe un token de pago.");
      return;
    }

    const normalizedPaymentProvider = form.paymentProvider.trim().toLowerCase();
    const supportedPaymentProvider =
      normalizedPaymentProvider === "mercado pago" ||
      normalizedPaymentProvider === "mercado-pago";
    if (form.paymentMethodToken && !supportedPaymentProvider) {
      setErrorMessage("El proveedor debe ser Mercado Pago.");
      return;
    }

    if (!form.paymentMethodToken.trim() && (form.paymentMethodBrand.trim() || form.paymentMethodLast4.trim())) {
      setErrorMessage("Marca y ultimos 4 solo deben guardarse junto con un token valido.");
      return;
    }

    if (form.planCode !== "FREE" && form.autoRenew && !form.paymentMethodToken.trim()) {
      setErrorMessage("Debes registrar un token de pago para activar la renovacion automatica.");
      return;
    }

    if (form.planCode === "FREE" && form.trialEndsAt && !fromDateDDMMYYYY(form.trialEndsAt)) {
      setErrorMessage("Fin de prueba debe estar en formato DD-MM-YYYY.");
      return;
    }

    if (form.currentPeriodStart && !fromDateDDMMYYYY(form.currentPeriodStart)) {
      setErrorMessage("Inicio de periodo debe estar en formato DD-MM-YYYY.");
      return;
    }

    if (form.currentPeriodEnd && !fromDateDDMMYYYY(form.currentPeriodEnd)) {
      setErrorMessage("Fin de periodo debe estar en formato DD-MM-YYYY.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const payload = {
        planCode: form.planCode,
        status: form.status,
        autoRenew: form.autoRenew,
        paymentProvider: form.paymentProvider.trim() || null,
        paymentCustomerRef: form.paymentCustomerRef.trim() || null,
        paymentMethodToken: form.paymentMethodToken.trim() || null,
        paymentMethodBrand: form.paymentMethodBrand.trim() || null,
        paymentMethodLast4: form.paymentMethodLast4.trim() || null,
        paymentMethodStatus: form.paymentMethodToken.trim() ? form.paymentMethodStatus : null,
        trialEndsAt: fromDateDDMMYYYY(form.trialEndsAt),
        currentPeriodStart: fromDateDDMMYYYY(form.currentPeriodStart),
        currentPeriodEnd: fromDateDDMMYYYY(form.currentPeriodEnd),
        limitsUsers: Number(form.limitsUsers),
        limitsBranches: Number(form.limitsBranches),
        limitsProducts: Number(form.limitsProducts),
        limitsOrdersPerMonth: Number(form.limitsOrdersPerMonth),
        limitsCustomers: Number(form.limitsCustomers),
      };

      await updateTenantSubscription(payload);

      setInitialForm(form);
      toast.success("Suscripcion actualizada", {
        description: "Los cambios de plan y limites se guardaron correctamente.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la suscripcion.";
      setErrorMessage(message);
      toast.danger("Error al guardar", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStopSubscription = async () => {
    if (!form || isAlreadyCanceled) {
      setIsCancelConfirmOpen(false);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      await updateTenantSubscription({
        status: "canceled",
        autoRenew: false,
      });

      const updatedForm: SubscriptionForm = {
        ...form,
        status: "canceled",
        autoRenew: false,
      };

      setForm(updatedForm);
      setInitialForm(updatedForm);
      setIsCancelConfirmOpen(false);

      toast.success("Suscripcion detenida", {
        description: "La suscripcion quedo en estado canceled y se desactivo la renovacion automatica.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo detener la suscripcion.";
      setErrorMessage(message);
      setIsCancelConfirmOpen(false);
      toast.danger("No se pudo detener", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Tabs.Panel id="suscripcion" className="pt-5">
      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-emerald-100 bg-gradient-to-r from-white via-emerald-50 to-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          title="Suscripcion y facturacion"
          subtitle="Configura plan, estado, renovacion y limites operativos del tenant."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            isDisabled={isFormDisabled || isAlreadyCanceled}
            onPress={() => setIsCancelConfirmOpen(true)}
            className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200"
          >
            Detener suscripcion
          </Button>
          <Button
            isLoading={isSaving}
            isDisabled={isFormDisabled || !hasUnsavedChanges}
            onPress={() => {
              void handleSave();
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Guardar suscripcion
          </Button>
        </div>
      </div>

      {errorMessage ? <p className="mb-3 text-sm text-red-600">{errorMessage}</p> : null}
      {isLoading ? <p className="mb-3 text-sm text-gray-600">Cargando suscripcion...</p> : null}

      {form ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Plan actual</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{initialForm?.planCode || form.planCode}</p>
            </Card>
            <Card className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{getSubscriptionStatusLabel(form.status)}</p>
            </Card>
          </div>

          <div className="mt-4 overflow-visible rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Configuracion comercial</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="subscription-plan">Plan</Label>
                  <div className="group relative z-[9999] overflow-visible">
                    <button
                      type="button"
                      aria-label="Descripcion del plan"
                      title={PLAN_DESCRIPTIONS[form.planCode]}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                    >
                      i
                    </button>
                    <div className="pointer-events-none absolute left-full top-1/2 z-[9999] ml-2 hidden w-72 -translate-y-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-2xl ring-1 ring-black/20 group-hover:block group-focus-within:block">
                      <p className="font-semibold text-white">{PLAN_DESCRIPTIONS[form.planCode]}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-100">
                        <span>Usuarios:</span><span className="text-right font-medium">{PLAN_LIMITS[form.planCode].users}</span>
                        <span>Tiendas:</span><span className="text-right font-medium">{PLAN_LIMITS[form.planCode].branches}</span>
                        <span>Productos:</span><span className="text-right font-medium">{PLAN_LIMITS[form.planCode].products}</span>
                        <span>Ordenes/mes:</span><span className="text-right font-medium">{PLAN_LIMITS[form.planCode].ordersPerMonth}</span>
                        <span>Clientes:</span><span className="text-right font-medium">{PLAN_LIMITS[form.planCode].customers}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <select
                  id="subscription-plan"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                  disabled={isFormDisabled}
                  value={form.planCode}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, planCode: event.target.value as SubscriptionForm["planCode"] } : prev,
                    )
                  }
                >
                  {planOptions.map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="subscription-status">Estado</Label>
                <div
                  id="subscription-status"
                  className="inline-flex w-fit items-center py-1.5 text-sm font-medium text-gray-700"
                  aria-readonly="true"
                >
                  {getSubscriptionStatusLabel(form.status)}
                </div>
              </div>

              <div className="flex items-end pb-1">
                <Switch
                  isSelected={form.autoRenew}
                  isDisabled={isFormDisabled || !canUseAutoRenew}
                  onValueChange={(value) => setForm((prev) => (prev ? { ...prev, autoRenew: value } : prev))}
                >
                  Renovacion automatica
                </Switch>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="plan-price">Precio del plan</Label>
                <Input
                  id="plan-price"
                  className={inputClassName}
                  disabled
                  value={PLAN_COMMERCIAL_INFO[form.planCode].price}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="plan-billing">Tipo de cobro</Label>
                <Input
                  id="plan-billing"
                  className={inputClassName}
                  disabled
                  value={PLAN_COMMERCIAL_INFO[form.planCode].billing}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="plan-recommendation">Uso recomendado</Label>
                <Input
                  id="plan-recommendation"
                  className={inputClassName}
                  disabled
                  value={PLAN_COMMERCIAL_INFO[form.planCode].recommendation}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {form.planCode === "FREE" ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="trial-ends-at">Fin de prueba</Label>
                  <Input
                    id="trial-ends-at"
                    type="text"
                    className={inputClassName}
                    disabled={isFormDisabled}
                    inputMode="numeric"
                    placeholder="DD-MM-YYYY"
                    maxLength={10}
                    value={form.trialEndsAt}
                    onChange={(event) =>
                      setForm((prev) =>
                        prev ? { ...prev, trialEndsAt: formatDateDDMMYYYYInput(event.target.value) } : prev,
                      )
                    }
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <Label htmlFor="period-start">Inicio de periodo</Label>
                <Input
                  id="period-start"
                  type="text"
                  className={inputClassName}
                  disabled={isFormDisabled}
                  inputMode="numeric"
                  placeholder="DD-MM-YYYY"
                  maxLength={10}
                  value={form.currentPeriodStart}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, currentPeriodStart: formatDateDDMMYYYYInput(event.target.value) } : prev,
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="period-end">Fin de periodo</Label>
                <Input
                  id="period-end"
                  type="text"
                  className={inputClassName}
                  disabled={isFormDisabled}
                  inputMode="numeric"
                  placeholder="DD-MM-YYYY"
                  maxLength={10}
                  value={form.currentPeriodEnd}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, currentPeriodEnd: formatDateDDMMYYYYInput(event.target.value) } : prev,
                    )
                  }
                />
              </div>
            </div>
          </div>

      
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Limites del plan</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="flex flex-col gap-1">
                <Label htmlFor="limit-users">Usuarios</Label>
                <Input
                  id="limit-users"
                  type="number"
                  min="0"
                  className={inputClassName}
                  disabled={isFormDisabled}
                  value={form.limitsUsers}
                  onChange={(event) => setForm((prev) => (prev ? { ...prev, limitsUsers: event.target.value } : prev))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="limit-branches">Tiendas</Label>
                <Input
                  id="limit-branches"
                  type="number"
                  min="0"
                  className={inputClassName}
                  disabled={isFormDisabled}
                  value={form.limitsBranches}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, limitsBranches: event.target.value } : prev))
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="limit-products">Productos</Label>
                <Input
                  id="limit-products"
                  type="number"
                  min="0"
                  className={inputClassName}
                  disabled={isFormDisabled}
                  value={form.limitsProducts}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, limitsProducts: event.target.value } : prev))
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="limit-orders">Ordenes/mes</Label>
                <Input
                  id="limit-orders"
                  type="number"
                  min="0"
                  className={inputClassName}
                  disabled={isFormDisabled}
                  value={form.limitsOrdersPerMonth}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, limitsOrdersPerMonth: event.target.value } : prev))
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="limit-customers">Clientes</Label>
                <Input
                  id="limit-customers"
                  type="number"
                  min="0"
                  className={inputClassName}
                  disabled={isFormDisabled}
                  value={form.limitsCustomers}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, limitsCustomers: event.target.value } : prev))
                  }
                />
              </div>
            </div>
          </div>
        </>
      ) : null}

      {isCancelConfirmOpen ? (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => {
              if (isSaving) return;
              setIsCancelConfirmOpen(false);
            }}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <Card
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-subscription-title"
              className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl"
            >
              <h3 id="cancel-subscription-title" className="text-lg font-semibold text-gray-900">
                Confirmar detencion
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                Esta accion cambiara el estado de la suscripcion a <span className="font-medium">canceled</span> y
                desactivara la renovacion automatica.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  onPress={() => setIsCancelConfirmOpen(false)}
                  isDisabled={isSaving}
                  className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
                >
                  Cancelar
                </Button>
                <Button
                  onPress={() => {
                    void handleStopSubscription();
                  }}
                  isLoading={isSaving}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Confirmar
                </Button>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </Tabs.Panel>
  );
}
