"use client";

import { FieldError, Input, Label, TextField, toast } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  getSubscriptionPricingPreview,
  getSubscriptionPlans,
  type SubscriptionPricingPreview,
  type SubscriptionPlan,
} from "@/api-implementations/subscription-plans";
import {
  createSignupMercadoPagoPreapproval,
  signUp,
} from "@/api-implementations/signup";
import {
  createMercadoPagoCheckoutInitialState,
  MercadoPagoCheckoutForm,
  type MercadoPagoTokenizedPayload,
} from "@/app/components/mercado-pago-checkout-form";

type SignupStep = "plan" | "payment" | "account";
type PaymentTokenData = MercadoPagoTokenizedPayload & { provider: "mercado-pago" };
type AccountValidationErrors = Partial<Record<"fullName" | "phoneNumber" | "email" | "password" | "confirmPassword", string>>;

function formatPlanPrice(plan: SubscriptionPlan) {
  if (plan.priceMxn <= 0) {
    return plan.billingPeriod === "trial" ? "15 dias gratis" : "Gratis";
  }

  return `$${plan.priceMxn} MXN`;
}

function formatPlanBilling(plan: SubscriptionPlan) {
  if (plan.priceMxn <= 0) {
    return plan.billingPeriod === "trial" ? "Sin cobro inicial" : "Sin costo";
  }

  return plan.billingPeriod === "month" ? "por mes" : `por ${plan.billingPeriod}`;
}

function getPreapprovalStatus(preapprovalResponse: Awaited<ReturnType<typeof createSignupMercadoPagoPreapproval>>) {
  return String(preapprovalResponse.preapproval?.status || "").trim().toLowerCase();
}

function getPreapprovalId(preapprovalResponse: Awaited<ReturnType<typeof createSignupMercadoPagoPreapproval>>) {
  return preapprovalResponse.preapproval?.id ? String(preapprovalResponse.preapproval.id) : null;
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
    >
      <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignupAccordionSection({
  step,
  title,
  description,
  statusLabel,
  isOpen,
  isLocked = false,
  onToggle,
  children,
}: {
  step: string;
  title: string;
  description: string;
  statusLabel: string;
  isOpen: boolean;
  isLocked?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/92 shadow-[0_18px_55px_-35px_rgba(15,23,42,0.35)]">
      <button
        type="button"
        onClick={onToggle}
        disabled={isLocked}
        className={`flex w-full items-center justify-between gap-4 rounded-[28px] px-5 py-4 text-left sm:px-6 sm:py-5 ${
          isLocked ? "cursor-not-allowed opacity-70" : ""
        }`}
      >
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-semibold text-emerald-800">
            {step}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen ? <div className="border-t border-slate-200 px-5 py-5 sm:px-6 sm:py-6">{children}</div> : null}
    </section>
  );
}

export default function SignUp() {
  const router = useRouter();
  const paymentStepRef = useRef<HTMLDivElement | null>(null);
  const accountStepRef = useRef<HTMLDivElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>("PRO");
  const [activeStep, setActiveStep] = useState<SignupStep>("plan");
  const [paymentFormResetKey, setPaymentFormResetKey] = useState(0);
  const [paymentTokenData, setPaymentTokenData] = useState<PaymentTokenData | null>(null);
  const [pricingPreview, setPricingPreview] = useState<SubscriptionPricingPreview | null>(null);
  const [isPlanHelpOpen, setIsPlanHelpOpen] = useState(false);
  const [scrollTargetStep, setScrollTargetStep] = useState<SignupStep | null>(null);
  const [paymentResponseMessage, setPaymentResponseMessage] = useState<string | null>(null);
  const [paymentResponseTone, setPaymentResponseTone] = useState<"success" | "error" | "info">("info");
  const [accountValidationErrors, setAccountValidationErrors] = useState<AccountValidationErrors>({});
  const [checkoutForm, setCheckoutForm] = useState(() =>
    createMercadoPagoCheckoutInitialState("0", "Suscripcion POS Zxor"),
  );

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === selectedPlanCode) || null,
    [plans, selectedPlanCode],
  );
  const requiresPayment = Boolean(selectedPlan && selectedPlan.priceMxn > 0);
  const canOpenPayment = Boolean(selectedPlan);
  const canOpenAccount = Boolean(selectedPlan) && (!requiresPayment || Boolean(paymentTokenData?.token));

  useEffect(() => {
    let isMounted = true;

    const loadPlans = async () => {
      try {
        const response = await getSubscriptionPlans();
        if (!isMounted) return;

        setPlans(response.plans);
        const defaultPlan =
          response.plans.find((plan) => plan.badge)?.code ||
          response.plans.find((plan) => plan.code === "PRO")?.code ||
          response.plans[0]?.code ||
          "PRO";
        setSelectedPlanCode(defaultPlan);
        setPlansError(null);
      } catch (error) {
        if (!isMounted) return;
        setPlans([]);
        setPlansError(error instanceof Error ? error.message : "No se pudieron cargar los planes.");
      }
    };

    void loadPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    const basePreview = {
      originalAmount: Number(selectedPlan.priceMxn || 0),
      discountAmount: 0,
      finalAmount: Number(selectedPlan.priceMxn || 0),
      couponCode: null,
      isDiscountApplied: false,
      reason: null,
    };
    setPricingPreview(basePreview);
    setCheckoutForm((prev) => ({
      ...prev,
      transactionAmount: String(basePreview.finalAmount),
      description: `Suscripcion ${selectedPlan.name}`,
    }));

    if (selectedPlan.priceMxn <= 0) {
      setPaymentTokenData(null);
      if (activeStep === "payment") {
        setActiveStep("account");
        setScrollTargetStep("account");
      }
    }
  }, [activeStep, selectedPlan]);

  useEffect(() => {
    if (!scrollTargetStep || activeStep !== scrollTargetStep) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const targetRef = scrollTargetStep === "payment" ? paymentStepRef : accountStepRef;
      targetRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
      setScrollTargetStep(null);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [activeStep, scrollTargetStep]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    const baseAmount = Number(selectedPlan.priceMxn || 0);
    if (baseAmount <= 0) {
      setPricingPreview({
        originalAmount: 0,
        discountAmount: 0,
        finalAmount: 0,
        couponCode: null,
        isDiscountApplied: false,
        reason: null,
      });
      return;
    }

    const couponCode = checkoutForm.couponCode.trim();
    if (!couponCode) {
      setPricingPreview({
        originalAmount: baseAmount,
        discountAmount: 0,
        finalAmount: baseAmount,
        couponCode: null,
        isDiscountApplied: false,
        reason: null,
      });
      setCheckoutForm((prev) => ({ ...prev, transactionAmount: String(baseAmount) }));
      return;
    }

    let isMounted = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await getSubscriptionPricingPreview({
          planCode: selectedPlan.code,
          couponCode,
        });
        if (!isMounted) {
          return;
        }

        setPricingPreview(response.pricing);
        setCheckoutForm((prev) => ({
          ...prev,
          transactionAmount: String(response.pricing.finalAmount),
        }));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setPricingPreview({
          originalAmount: baseAmount,
          discountAmount: 0,
          finalAmount: baseAmount,
          couponCode: null,
          isDiscountApplied: false,
          reason: error instanceof Error ? error.message : "No se pudo validar el cupon.",
        });
        setCheckoutForm((prev) => ({ ...prev, transactionAmount: String(baseAmount) }));
      }
    }, 350);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [checkoutForm.couponCode, selectedPlan]);

  const handlePlanSelection = (planCode: string) => {
    setSelectedPlanCode(planCode);
    setPaymentTokenData(null);
    setPaymentResponseMessage(null);
    const plan = plans.find((item) => item.code === planCode);
    const nextStep = plan && plan.priceMxn > 0 ? "payment" : "account";
    setActiveStep(nextStep);
    setScrollTargetStep(nextStep);
  };

  const sendBackToPaymentStep = (message: string) => {
    setPaymentTokenData(null);
    setPaymentFormResetKey((currentKey) => currentKey + 1);
    setPaymentResponseTone("error");
    setPaymentResponseMessage(message);
    setActiveStep("payment");
    setScrollTargetStep("payment");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const fullName = String(formData.get("fullName") || "").trim();
    const phoneNumber = String(formData.get("phoneNumber") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    const nextValidationErrors: AccountValidationErrors = {};
    if (!fullName) nextValidationErrors.fullName = "Ingresa tu nombre completo.";
    if (!phoneNumber) nextValidationErrors.phoneNumber = "Ingresa tu telefono.";
    if (!email) nextValidationErrors.email = "Ingresa tu email.";
    if (!password) nextValidationErrors.password = "Ingresa tu contrasena.";
    if (!confirmPassword) nextValidationErrors.confirmPassword = "Confirma tu contrasena.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextValidationErrors.email = "Ingresa un email valido.";
    }
    if (password && confirmPassword && password !== confirmPassword) {
      nextValidationErrors.confirmPassword = "La confirmacion no coincide.";
    }

    setAccountValidationErrors(nextValidationErrors);

    if (Object.keys(nextValidationErrors).length > 0) {
      toast.danger("Error en el formulario", {
        description: Object.values(nextValidationErrors)[0] || "Revisa los campos marcados.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    if (requiresPayment && !paymentTokenData?.token) {
      setActiveStep("payment");
      setScrollTargetStep("payment");
      toast.danger("Falta el metodo de pago", {
        description: "Tokeniza la tarjeta antes de crear la cuenta en un plan de pago.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const checkoutData = paymentTokenData;
      let preapprovalId: string | null = null;

      if (requiresPayment && checkoutData) {
        setPaymentResponseMessage("Autorizando suscripcion...");
        setPaymentResponseTone("info");

        let preapprovalResponse: Awaited<ReturnType<typeof createSignupMercadoPagoPreapproval>>;
        try {
          preapprovalResponse = await createSignupMercadoPagoPreapproval({
            preapproval_plan_id: selectedPlan?.mercadoPagoPreapprovalPlanId || undefined,
            reason: checkoutData.description || `Suscripcion ${selectedPlan?.name || selectedPlanCode}`,
            external_reference: `signup:${selectedPlanCode}`,
            payer_email: email,
            card_token_id: checkoutData.token,
            auto_recurring: {
              frequency: 1,
              frequency_type: "months",
              transaction_amount: checkoutData.transactionAmount,
              currency_id: "MXN",
            },
            back_url: `${window.location.origin}/signup`,
            status: "authorized",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "No se pudo autorizar la suscripcion en Mercado Pago.";
          sendBackToPaymentStep(message);
          throw error;
        }

        const preapprovalStatus = getPreapprovalStatus(preapprovalResponse);
        if (preapprovalStatus && preapprovalStatus !== "authorized") {
          const message = `Mercado Pago devolvio estado: ${preapprovalStatus || "desconocido"}.`;
          sendBackToPaymentStep(message);
          throw new Error(message);
        }
        preapprovalId = getPreapprovalId(preapprovalResponse);

        setPaymentResponseTone("success");
        setPaymentResponseMessage("Suscripcion autorizada. Creando cuenta...");
      }
      const paymentMethodBrand =
        checkoutData && "brand" in checkoutData && checkoutData.brand
          ? checkoutData.brand
          : checkoutData && "paymentMethodId" in checkoutData
              ? checkoutData.paymentMethodId
              : null;

      const response = await signUp({
        fullName,
        phoneNumber,
        email,
        password,
        confirmPassword,
        planCode: selectedPlanCode,
        paymentProvider: checkoutData?.provider || null,
        paymentMethodToken: checkoutData?.token || null,
        paymentCustomerRef: preapprovalId || checkoutData?.payerEmail || email || null,
        paymentMethodBrand,
        paymentMethodStatus: preapprovalId ? "ready" : null,
      });

      if (typeof window !== "undefined") {
        localStorage.removeItem("pendingSelectedPlanCode");
        localStorage.removeItem("pendingSubscriptionCheckout");
      }

      toast.success("Registro exitoso", {
        description: response.message || "Cuenta creada correctamente.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });

      form.reset();
      setTimeout(() => {
        router.push("/signin");
      }, 800);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la cuenta.";
      toast.danger("No se pudo crear la cuenta", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full px-3 py-4 text-gray-900 sm:px-5 sm:py-6 lg:px-8">
      <section className="mx-auto max-w-7xl rounded-[28px] border border-slate-200/90 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] p-4 shadow-[0_30px_80px_-36px_rgba(15,23,42,0.35)] sm:rounded-[32px] sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-[2.15rem]">
                Selecciona plan, agrega pago si aplica y crea tu cuenta
              </h1>
            </div>
            <div className="grid gap-2 sm:min-w-[280px]">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Plan elegido</span>
                <span className="mt-1 block font-semibold">
                  {selectedPlan?.name || selectedPlanCode || "Sin seleccionar"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {plansError ? <p className="mt-5 text-sm text-red-600">{plansError}</p> : null}

        <div className="mt-6 space-y-4">
          <SignupAccordionSection
            step="01"
            title="Selecciona tu plan"
            description="Compara capacidad, precio y recomendacion."
            statusLabel={selectedPlan ? selectedPlan.name : "Pendiente"}
            isOpen={activeStep === "plan"}
            onToggle={() => setActiveStep("plan")}
          >

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {plans.map((plan) => {
                const isSelected = selectedPlanCode === plan.code;
                const isPopular = Boolean(plan.badge);

                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => handlePlanSelection(plan.code)}
                    className={`group relative flex h-full cursor-pointer flex-col rounded-[24px] border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-30px_rgba(15,23,42,0.45)] sm:p-5 ${
                      isSelected
                        ? "border-emerald-400 bg-emerald-50 shadow-[0_24px_50px_-30px_rgba(5,150,105,0.55)] hover:border-emerald-500 hover:bg-emerald-100"
                        : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900 sm:text-lg">{plan.name}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{plan.description}</p>
                      </div>
                      {isPopular ? (
                        <span className="shrink-0 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                          {plan.badge}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5">
                      <div className="flex flex-wrap items-end gap-2">
                        <p className="text-3xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
                          {formatPlanPrice(plan)}
                        </p>
                        <p className="pb-1 text-sm text-slate-500">{formatPlanBilling(plan)}</p>
                      </div>
                    </div>

                    <div className="mt-5 flex-1 space-y-2">
                      {plan.features.slice(0, 4).map((feature) => (
                        <div key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between text-sm">
                      <span className={isSelected ? "text-emerald-700" : "text-slate-500"}>
                        {isSelected ? "Plan seleccionado" : "Seleccionar plan"}
                      </span>
                      <span
                        className={`h-5 w-5 rounded-full border ${
                          isSelected ? "border-emerald-600 bg-emerald-600 ring-4 ring-emerald-100" : "border-slate-300"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </SignupAccordionSection>

          {requiresPayment ? (
            <div ref={paymentStepRef} id="signup-payment-step" className="scroll-mt-6">
            <SignupAccordionSection
              step="02"
              title="Metodo de pago"
              description="Tu plan tiene costo mensual."
              statusLabel={paymentTokenData?.token ? "Listo" : "Requerido"}
              isOpen={activeStep === "payment"}
              isLocked={!canOpenPayment}
              onToggle={() => {
                if (canOpenPayment) {
                  setActiveStep("payment");
                  setScrollTargetStep("payment");
                }
              }}
            >
              <style jsx>{`
                [id$="-form"] {
                  display: flex;
                  flex-direction: column;
                  gap: 16px;
                }

                .mp-checkout-container {
                  display: block;
                  width: 100%;
                  border: 1px solid rgba(148, 163, 184, 0.55);
                  border-radius: 18px;
                  padding: 12px 14px;
                  background: rgba(255, 255, 255, 0.96);
                  min-height: 54px;
                  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
                }
              `}</style>

              <MercadoPagoCheckoutForm
                key={`mercado-pago-${paymentFormResetKey}`}
                checkoutForm={checkoutForm}
                setCheckoutForm={setCheckoutForm}
                formIdPrefix={`signup-checkout-${paymentFormResetKey}`}
                isDisabled={isSubmitting}
                submitLabel="Guardar tarjeta y continuar"
                pricingBreakdown={pricingPreview}
                paymentResponseMessage={paymentResponseMessage}
                paymentResponseTone={paymentResponseTone}
                onTokenized={async (payload) => {
                  setPaymentTokenData({ ...payload, provider: "mercado-pago" });
                  setPaymentResponseMessage("Metodo de pago tokenizado. La suscripcion queda en prueba por 15 dias.");
                  setPaymentResponseTone("success");
                  setActiveStep("account");
                  setScrollTargetStep("account");

                  toast.success("Metodo de pago listo", {
                    description: "No se hizo ningun cobro. Tu prueba inicia al crear la cuenta.",
                    actionProps: {
                      children: "OK",
                      onPress: () => toast.clear(),
                      variant: "tertiary",
                    },
                  });
                }}
              />

              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                El registro no guarda los datos completos de la tarjeta. El plan queda en prueba por 15 dias.
              </div>
            </SignupAccordionSection>
            </div>
          ) : null}

          <div ref={accountStepRef} id="signup-account-step" className="scroll-mt-6">
            <SignupAccordionSection
              step={requiresPayment ? "03" : "02"}
              title="Datos de acceso"
              description={
                requiresPayment
                  ? "Completa la informacion del propietario de la cuenta despues de dejar listo el metodo de pago."
                  : "Como elegiste un plan sin costo inicial, puedes crear la cuenta de inmediato."
              }
              statusLabel={canOpenAccount ? "Disponible" : "Bloqueado"}
              isOpen={activeStep === "account"}
              isLocked={!canOpenAccount}
              onToggle={() => {
                if (canOpenAccount) {
                  setActiveStep("account");
                  setScrollTargetStep("account");
                }
              }}
            >
            <form
              onSubmit={handleSubmit}
              className="rounded-[24px] border border-slate-200 bg-white/92 p-4 shadow-[0_16px_60px_-24px_rgba(15,23,42,0.22)] sm:rounded-[28px] sm:p-5"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Crear cuenta</h3>
                  <p className="mt-1 text-sm text-slate-600">Completa tus datos para empezar a usar POS Zxor.</p>
                </div>
                <div className="grid gap-2 lg:min-w-[260px]">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Plan elegido</span>
                    <span className="mt-1 block text-sm font-semibold text-emerald-950">
                      {selectedPlan?.name || selectedPlanCode || "Sin seleccionar"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <TextField>
                  <Label className="text-sm font-medium text-slate-800">Nombre completo</Label>
                  <Input
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    aria-invalid={Boolean(accountValidationErrors.fullName)}
                    className={`w-full rounded-xl ${accountValidationErrors.fullName ? "border-red-300" : "border-slate-300/80"}`}
                    placeholder="Ej. Mariana Soto"
                    onChange={() =>
                      setAccountValidationErrors((prev) => ({ ...prev, fullName: undefined }))
                    }
                  />
                  {accountValidationErrors.fullName ? (
                    <p className="text-xs font-medium text-red-600">{accountValidationErrors.fullName}</p>
                  ) : null}
                  <FieldError className="text-xs" />
                </TextField>

                <TextField>
                  <Label className="text-sm font-medium text-slate-800">Telefono</Label>
                  <Input
                    name="phoneNumber"
                    type="tel"
                    autoComplete="tel"
                    required
                    aria-invalid={Boolean(accountValidationErrors.phoneNumber)}
                    className={`w-full rounded-xl ${accountValidationErrors.phoneNumber ? "border-red-300" : "border-slate-300/80"}`}
                    placeholder="Ej. 5551234567"
                    onChange={() =>
                      setAccountValidationErrors((prev) => ({ ...prev, phoneNumber: undefined }))
                    }
                  />
                  {accountValidationErrors.phoneNumber ? (
                    <p className="text-xs font-medium text-red-600">{accountValidationErrors.phoneNumber}</p>
                  ) : null}
                  <FieldError className="text-xs" />
                </TextField>

                <TextField className="lg:col-span-2">
                  <Label className="text-sm font-medium text-slate-800">Email</Label>
                  <Input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    aria-invalid={Boolean(accountValidationErrors.email)}
                    className={`w-full rounded-xl ${accountValidationErrors.email ? "border-red-300" : "border-slate-300/80"}`}
                    placeholder="Ej. mariana@correo.com"
                    onChange={() =>
                      setAccountValidationErrors((prev) => ({ ...prev, email: undefined }))
                    }
                  />
                  {accountValidationErrors.email ? (
                    <p className="text-xs font-medium text-red-600">{accountValidationErrors.email}</p>
                  ) : null}
                  <FieldError className="text-xs" />
                </TextField>

                <TextField>
                  <Label className="text-sm font-medium text-slate-800">Contrasena</Label>
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    aria-invalid={Boolean(accountValidationErrors.password)}
                    className={`w-full rounded-xl ${accountValidationErrors.password ? "border-red-300" : "border-slate-300/80"}`}
                    placeholder="Ingresa tu contrasena"
                    onChange={() =>
                      setAccountValidationErrors((prev) => ({ ...prev, password: undefined }))
                    }
                  />
                  {accountValidationErrors.password ? (
                    <p className="text-xs font-medium text-red-600">{accountValidationErrors.password}</p>
                  ) : null}
                  <FieldError className="text-xs" />
                </TextField>

                <TextField>
                  <Label className="text-sm font-medium text-slate-800">Confirmar contrasena</Label>
                  <Input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    aria-invalid={Boolean(accountValidationErrors.confirmPassword)}
                    className={`w-full rounded-xl ${accountValidationErrors.confirmPassword ? "border-red-300" : "border-slate-300/80"}`}
                    placeholder="Confirma tu contrasena"
                    onChange={() =>
                      setAccountValidationErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                    }
                  />
                  {accountValidationErrors.confirmPassword ? (
                    <p className="text-xs font-medium text-red-600">{accountValidationErrors.confirmPassword}</p>
                  ) : null}
                  <FieldError className="text-xs" />
                </TextField>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:min-w-[420px]">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
                  </button>

                  <Link
                    href="/signin"
                    className="flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Ya tienes cuenta? Iniciar sesion
                  </Link>
                </div>
              </div>
            </form>
            </SignupAccordionSection>
          </div>
        </div>
      </section>

      <div
        className={`fixed inset-0 z-50 bg-slate-950/35 transition-opacity ${
          isPlanHelpOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsPlanHelpOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-plan-help-title"
        className={`fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_30px_90px_-35px_rgba(15,23,42,0.55)] transition-all sm:p-6 ${
          isPlanHelpOpen
            ? "-translate-y-1/2 scale-100 opacity-100"
            : "pointer-events-none -translate-y-[45%] scale-95 opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Guia rapida</p>
            <h2 id="signup-plan-help-title" className="mt-1 text-xl font-bold text-slate-900">
              Como completar el registro
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar ayuda"
            onClick={() => setIsPlanHelpOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
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
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Paso 1</p>
            <p className="mt-1 text-sm font-medium text-slate-900">Elige capacidad real</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Selecciona el plan que se acerque a tu volumen, usuarios y sucursales.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Paso 2</p>
            <p className="mt-1 text-sm font-medium text-slate-900">Confirma si lleva cobro</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Los planes pagados activan el paso de Mercado Pago antes del registro.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Paso 3</p>
            <p className="mt-1 text-sm font-medium text-slate-900">Continua con tu cuenta</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Cuando el plan este claro, avanzas al pago o directo al alta de usuario.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
