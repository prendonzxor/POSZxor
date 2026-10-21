"use client";

import { serverNow } from "@/lib/server-time";

import { useEffect, useState } from "react";
import { Button, toast } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMe } from "@/api-implementations/me";
import { getSubscriptionPlans, type SubscriptionPlan } from "@/api-implementations/subscription-plans";
import {
  createMercadoPagoPreapproval,
  getTenantSubscription,
  updateTenantSubscription,
} from "@/api-implementations/tenants";
import {
  createMercadoPagoCheckoutInitialState,
  MercadoPagoCheckoutForm,
  type MercadoPagoTokenizedPayload,
} from "@/app/components/mercado-pago-checkout-form";

function normalizeAmount(value: string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : "1.00";
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months);
  return nextDate;
}

function getMercadoPagoPreapprovalStatus(
  preapprovalResponse: Awaited<ReturnType<typeof createMercadoPagoPreapproval>>,
) {
  return String(preapprovalResponse.preapproval?.status || "").trim().toLowerCase();
}

function getEmailFromMeResponse(meResponse: Awaited<ReturnType<typeof getMe>>) {
  return String(meResponse.tenant?.email || meResponse.user.email || "").trim();
}

export default function SubscriptionCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState("");
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [plansErrorMessage, setPlansErrorMessage] = useState<string | null>(null);
  const [tokenizedPayment, setTokenizedPayment] = useState<MercadoPagoTokenizedPayload | null>(null);
  const [isChargingPayment, setIsChargingPayment] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const [loggedUserEmail, setLoggedUserEmail] = useState("");
  const [checkoutForm, setCheckoutForm] = useState(() =>
    createMercadoPagoCheckoutInitialState(
      normalizeAmount(searchParams.get("amount")),
      searchParams.get("description") || "Metodo de pago POS Zxor",
    ),
  );
  const selectedPlan = plans.find((plan) => plan.code === selectedPlanCode) || null;

  useEffect(() => {
    let isMounted = true;

    const loadSubscriptionContext = async () => {
      try {
        setIsLoadingPlans(true);
        const [plansResponse, subscriptionResponse, meResponse] = await Promise.all([
          getSubscriptionPlans(),
          getTenantSubscription(),
          getMe(),
        ]);

        if (!isMounted) {
          return;
        }

        const activePlans = plansResponse.plans.filter((plan) => plan.isActive && plan.code !== "FREE");
        const currentPlanCode = subscriptionResponse.subscription?.planCode || activePlans[0]?.code || "";
        const currentPlan = activePlans.find((plan) => plan.code === currentPlanCode) || activePlans[0] || null;
        const meEmail = getEmailFromMeResponse(meResponse);

        setPlans(activePlans);
        setSelectedPlanCode(currentPlan?.code || "");
        setLoggedUserEmail(meEmail);
        setCheckoutForm((prev) => ({
          ...prev,
          email: meEmail || prev.email,
          transactionAmount: currentPlan && currentPlan.priceMxn > 0 ? currentPlan.priceMxn.toFixed(2) : normalizeAmount(searchParams.get("amount")),
          description: currentPlan ? `Suscripcion ${currentPlan.name}` : searchParams.get("description") || "Metodo de pago POS Zxor",
        }));
        setPlansErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPlans([]);
        setSelectedPlanCode("");
        setPlansErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los planes.");
      } finally {
        if (isMounted) {
          setIsLoadingPlans(false);
        }
      }
    };

    void loadSubscriptionContext();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    setCheckoutForm((prev) => ({
      ...prev,
      transactionAmount: selectedPlan.priceMxn > 0 ? selectedPlan.priceMxn.toFixed(2) : normalizeAmount(searchParams.get("amount")),
      description: `Suscripcion ${selectedPlan.name}`,
    }));
    setTokenizedPayment(null);
  }, [searchParams, selectedPlan]);

  const handleSignOut = () => {
    localStorage.removeItem("authToken");
    document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
    router.replace("/signin");
  };

  const handleTokenizedPayment = async (payload: MercadoPagoTokenizedPayload) => {
    if (!selectedPlan) {
      setPaymentErrorMessage("Selecciona un plan antes de procesar el pago.");
      return;
    }

    if (!payload.paymentMethodId) {
      setPaymentErrorMessage("Mercado Pago no devolvio paymentMethodId.");
      return;
    }

    let payerEmail = String(payload.payerEmail || checkoutForm.email || loggedUserEmail || "").trim();
    if (!payerEmail.trim()) {
      try {
        const meResponse = await getMe();
        const meEmail = getEmailFromMeResponse(meResponse);
        if (meEmail) {
          payerEmail = meEmail;
          setLoggedUserEmail(meEmail);
          setCheckoutForm((prev) => ({ ...prev, email: meEmail }));
        }
      } catch {
        payerEmail = "";
      }
    }

    if (!payerEmail) {
      setPaymentErrorMessage("No se encontro el email del pagador en /me.");
      return;
    }

    if (!Number.isFinite(payload.transactionAmount) || payload.transactionAmount <= 0) {
      setPaymentErrorMessage("El monto del plan seleccionado no es valido.");
      return;
    }

    try {
      setIsChargingPayment(true);
      setPaymentErrorMessage(null);
      setTokenizedPayment(payload);

      const preapprovalResponse = await createMercadoPagoPreapproval({
        preapproval_plan_id: selectedPlan.mercadoPagoPreapprovalPlanId || undefined,
        reason: payload.description || `Suscripcion ${selectedPlan.name}`,
        external_reference: `subscription:${selectedPlan.code}`,
        payer_email: payerEmail,
        card_token_id: payload.token,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: payload.transactionAmount,
          currency_id: "MXN",
        },
        back_url: `${window.location.origin}/subscription-checkout`,
        status: "authorized",
      });

      const preapprovalStatus = getMercadoPagoPreapprovalStatus(preapprovalResponse);
      if (preapprovalStatus && preapprovalStatus !== "authorized") {
        throw new Error(`La suscripcion no fue autorizada. Estado: ${preapprovalStatus}.`);
      }

      const currentPeriodStart = serverNow();
      const currentPeriodEnd = addMonths(currentPeriodStart, 1);
      const preapprovalId = preapprovalResponse.preapproval?.id
        ? String(preapprovalResponse.preapproval.id)
        : null;

      await updateTenantSubscription({
        planCode: selectedPlan.code,
        status: "active",
        autoRenew: true,
        paymentProvider: "mercado-pago",
        paymentCustomerRef: preapprovalId || payload.payerEmail || null,
        paymentMethodToken: payload.token,
        paymentMethodBrand: payload.paymentMethodId,
        paymentMethodStatus: "ready",
        trialEndsAt: null,
        currentPeriodStart: currentPeriodStart.toISOString(),
        currentPeriodEnd: currentPeriodEnd.toISOString(),
      });

      toast.success("Suscripcion autorizada", {
        description: "Tu suscripcion fue reactivada correctamente con Mercado Pago.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      router.replace("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la suscripcion.";
      setPaymentErrorMessage(message);
      toast.danger("No se pudo crear suscripcion", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsChargingPayment(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">POS Zxor</p>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">Metodo de pago</h1>
          </div>
          <Button
            onPress={handleSignOut}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cerrar sesion
          </Button>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-65px)] max-w-6xl items-center px-4 py-6 sm:px-6">
        <div className="grid w-full gap-5 xl:grid-cols-[minmax(280px,0.55fr)_minmax(0,1fr)] xl:items-start">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planes</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Selecciona tu plan</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              El plan actual del tenant se selecciona automaticamente.
            </p>

            {isLoadingPlans ? <p className="mt-4 text-sm text-slate-600">Cargando planes...</p> : null}
            {plansErrorMessage ? <p className="mt-4 text-sm text-red-600">{plansErrorMessage}</p> : null}

            <div className="mt-4 grid gap-3">
              {plans.map((plan) => {
                const isSelected = selectedPlanCode === plan.code;
                return (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => setSelectedPlanCode(plan.code)}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-sky-500 bg-sky-50 text-sky-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{plan.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
                      </div>
                      <span className="shrink-0 text-sm font-bold">
                        ${Number(plan.priceMxn || 0).toFixed(2)}
                      </span>
                    </div>
                    {plan.badge ? (
                      <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                        {plan.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="w-full">
            {selectedPlan && selectedPlan.priceMxn <= 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                Selecciona un plan de pago para capturar el metodo de pago.
              </div>
            ) : (
              <div className="space-y-3">
                {paymentErrorMessage ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {paymentErrorMessage}
                  </div>
                ) : null}
                <MercadoPagoCheckoutForm
                  key={`fullscreen-subscription-checkout-${selectedPlanCode}`}
                  checkoutForm={checkoutForm}
                  setCheckoutForm={setCheckoutForm}
                  formIdPrefix={`fullscreen-subscription-checkout-${selectedPlanCode || "plan"}`}
                  isDisabled={isChargingPayment}
                  submitLabel={isChargingPayment ? "Creando suscripcion..." : "Crear suscripcion y reactivar cuenta"}
                  payerEmail={loggedUserEmail}
                  showPayerEmail
                  paymentResponseMessage={
                    paymentErrorMessage ||
                    (tokenizedPayment
                      ? "Metodo de pago tokenizado. Creando suscripcion con Mercado Pago..."
                      : null)
                  }
                  paymentResponseTone={
                    paymentErrorMessage
                      ? "error"
                      : tokenizedPayment
                        ? "info"
                        : "success"
                  }
                  onTokenized={(payload) => {
                    void handleTokenizedPayment(payload);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
