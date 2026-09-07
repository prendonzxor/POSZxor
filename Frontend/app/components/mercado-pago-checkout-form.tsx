"use client";

import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { Input, Label } from "@heroui/react";

export type MercadoPagoCheckoutFormState = {
  cardholderName: string;
  email: string;
  couponCode: string;
  transactionAmount: string;
  description: string;
};

export type MercadoPagoTokenizedPayload = {
  token: string;
  paymentMethodId: string;
  issuer: string;
  installments: string;
  payerEmail: string;
  couponCode: string;
  transactionAmount: number;
  description: string;
  payment?: {
    id?: string | number;
    status?: string;
    status_detail?: string;
    [key: string]: unknown;
  };
};

type PricingBreakdown = {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode?: string | null;
  reason?: string | null;
};

type MercadoPagoCheckoutFormProps = {
  checkoutForm: MercadoPagoCheckoutFormState;
  setCheckoutForm: Dispatch<SetStateAction<MercadoPagoCheckoutFormState>>;
  formIdPrefix: string;
  isDisabled?: boolean;
  submitLabel?: string;
  pricingBreakdown?: PricingBreakdown | null;
  paymentResponseMessage?: string | null;
  paymentResponseTone?: "success" | "error" | "info";
  payerEmail?: string;
  showPayerEmail?: boolean;
  onTokenized?: (payload: MercadoPagoTokenizedPayload) => void;
};

declare global {
  interface Window {
    mp?: {
      cardForm?: (settings: Record<string, unknown>) => {
        getCardFormData: () => Record<string, unknown>;
        unmount?: () => void;
      };
    };
  }
}

export function createMercadoPagoCheckoutInitialState(
  transactionAmount = "100",
  description = "Suscripcion POS Zxor",
): MercadoPagoCheckoutFormState {
  return {
    cardholderName: "",
    email: "",
    couponCode: "",
    transactionAmount,
    description,
  };
}

function forceSingleInstallment(installmentsElementId: string) {
  const installmentsElement = document.getElementById(installmentsElementId) as HTMLSelectElement | null;
  if (!installmentsElement) {
    return;
  }

  const singleInstallmentOption = Array.from(installmentsElement.options || []).find(
    (option) => String(option.value) === "1",
  );

  if (!singleInstallmentOption) {
    return;
  }

  const shouldReduceOptions =
    installmentsElement.options.length !== 1 || String(installmentsElement.options[0].value) !== "1";
  const shouldChangeValue = String(installmentsElement.value) !== "1";

  if (!shouldReduceOptions && !shouldChangeValue) {
    return;
  }

  const option = singleInstallmentOption.cloneNode(true) as HTMLOptionElement;
  option.value = "1";
  option.textContent = singleInstallmentOption.textContent || "1 cuota";
  option.selected = true;
  if (shouldReduceOptions) {
    installmentsElement.replaceChildren(option);
  }
  installmentsElement.value = "1";
  installmentsElement.dispatchEvent(new Event("change", { bubbles: true }));
}

function createSingleInstallmentWatcher(installmentsElementId: string) {
  const installmentsElement = document.getElementById(installmentsElementId) as HTMLSelectElement | null;
  if (!installmentsElement || typeof MutationObserver !== "function") {
    return null;
  }

  const observer = new MutationObserver(() => {
    forceSingleInstallment(installmentsElementId);
  });

  observer.observe(installmentsElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["value", "selected"],
  });

  forceSingleInstallment(installmentsElementId);
  return observer;
}

function collectMercadoPagoErrorMessages(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectMercadoPagoErrorMessages);
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directMessages = [
    record.message,
    record.description,
    record.detail,
    record.error,
    record.code,
  ].flatMap(collectMercadoPagoErrorMessages);
  const nestedMessages = [
    record.cause,
    record.details,
    record.fieldErrors,
    record.errors,
    typeof record.error === "object" ? record.error : null,
  ].flatMap(collectMercadoPagoErrorMessages);

  return [...directMessages, ...nestedMessages];
}

function formatMercadoPagoError(value: unknown, fallbackMessage: string) {
  const messages = Array.from(new Set(collectMercadoPagoErrorMessages(value)));
  return messages.length > 0 ? messages.join(" ") : fallbackMessage;
}

export function MercadoPagoCheckoutForm({
  checkoutForm,
  setCheckoutForm,
  formIdPrefix,
  isDisabled = false,
  submitLabel = "Tokenizar y continuar",
  pricingBreakdown = null,
  paymentResponseMessage = null,
  paymentResponseTone = "info",
  payerEmail,
  showPayerEmail = false,
  onTokenized,
}: MercadoPagoCheckoutFormProps) {
  const ids = {
    form: `${formIdPrefix}-form`,
    cardNumber: `${formIdPrefix}__cardNumber`,
    expirationDate: `${formIdPrefix}__expirationDate`,
    securityCode: `${formIdPrefix}__securityCode`,
    cardholderName: `${formIdPrefix}__cardholderName`,
    issuer: `${formIdPrefix}__issuer`,
    installments: `${formIdPrefix}__installments`,
    cardholderEmail: `${formIdPrefix}__cardholderEmail`,
    submit: `${formIdPrefix}__submit`,
    progress: `${formIdPrefix}__progress`,
    loadingMessage: `${formIdPrefix}__loadingMessage`,
    amount: `${formIdPrefix}__amount`,
    description: `${formIdPrefix}__description`,
    validationErrors: `${formIdPrefix}__validationErrors`,
    errorMessage: `${formIdPrefix}__errorMessage`,
  };
  const amount = Number(checkoutForm.transactionAmount || 0);
  const resolvedPayerEmail = String(payerEmail || checkoutForm.email || "").trim();
  const latestCheckoutFormRef = useRef(checkoutForm);
  const latestPayerEmailRef = useRef(resolvedPayerEmail);
  const latestOnTokenizedRef = useRef(onTokenized);
  const latestCardTokenErrorRef = useRef("");
  const [cardFormErrorMessage, setCardFormErrorMessage] = useState("");

  useEffect(() => {
    latestCheckoutFormRef.current = checkoutForm;
    latestPayerEmailRef.current = resolvedPayerEmail;
    latestOnTokenizedRef.current = onTokenized;
  }, [checkoutForm, onTokenized, resolvedPayerEmail]);

  useEffect(() => {
    const emailInput = document.getElementById(ids.cardholderEmail) as HTMLInputElement | null;
    if (!emailInput || emailInput.value === resolvedPayerEmail) {
      return;
    }

    emailInput.value = resolvedPayerEmail;
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    emailInput.dispatchEvent(new Event("change", { bubbles: true }));
  }, [ids.cardholderEmail, resolvedPayerEmail]);

  useEffect(() => {
    let isDisposed = false;
    let cardForm: { getCardFormData: () => Record<string, unknown>; unmount?: () => void } | null = null;
    let installmentsObserver: MutationObserver | null = null;
    let isInitializing = false;
    let isInitialized = false;

    const initializeCardForm = () => {
      if (isDisposed || isInitializing || isInitialized) {
        return isInitialized;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        setCardFormErrorMessage("El monto debe ser mayor a 0 para cargar Mercado Pago.");
        return true;
      }

      if (!window.mp?.cardForm) {
        return false;
      }

      try {
        isInitializing = true;
        setCardFormErrorMessage("");
        latestCardTokenErrorRef.current = "";
        installmentsObserver?.disconnect();
        installmentsObserver = createSingleInstallmentWatcher(ids.installments);
        cardForm = window.mp.cardForm({
          amount: String(amount),
          iframe: true,
          form: {
            id: ids.form,
            cardNumber: {
              id: ids.cardNumber,
              placeholder: "Numero de tarjeta",
            },
            expirationDate: {
              id: ids.expirationDate,
              placeholder: "MM/YY",
            },
            securityCode: {
              id: ids.securityCode,
              placeholder: "Codigo de seguridad",
            },
            cardholderName: {
              id: ids.cardholderName,
              placeholder: "Titular de la tarjeta",
            },
            issuer: {
              id: ids.issuer,
              placeholder: "Banco emisor",
            },
            installments: {
              id: ids.installments,
              placeholder: "Cuotas",
            },
            cardholderEmail: {
              id: ids.cardholderEmail,
              placeholder: "E-mail",
            },
          },
          customization: {
            paymentMethods: {
              minInstallments: 1,
              maxInstallments: 1,
            },
          },
          callbacks: {
            onFormMounted: (error: unknown) => {
              if (error) {
                console.warn("Form Mounted handling error:", error);
                setCardFormErrorMessage("No se pudo montar el formulario de Mercado Pago.");
                return;
              }
              setCardFormErrorMessage("");
              installmentsObserver?.disconnect();
              installmentsObserver = createSingleInstallmentWatcher(ids.installments);
              forceSingleInstallment(ids.installments);
            },
            onSubmit: (event: Event) => {
              event.preventDefault();

              try {
                latestCardTokenErrorRef.current = "";
                setCardFormErrorMessage("");
                const cardFormData = cardForm?.getCardFormData() || {};
                const latestForm = latestCheckoutFormRef.current;
                const token = String(cardFormData.token || "");
                const paymentMethodId = String(cardFormData.paymentMethodId || cardFormData.payment_method_id || "");
                const issuer = String(cardFormData.issuerId || cardFormData.issuer_id || "");
                const installments = "1";
                const payerEmail = String(
                  cardFormData.cardholderEmail || latestPayerEmailRef.current || latestForm.email || "",
                ).trim();
                const cardholderName = String(
                  cardFormData.cardholderName ||
                    (document.getElementById(ids.cardholderName) as HTMLInputElement | null)?.value ||
                    "",
                ).trim();
                const validationMessages: string[] = [];

                if (!cardholderName) {
                  validationMessages.push("Ingresa el titular de la tarjeta.");
                }

                if (!paymentMethodId) {
                  validationMessages.push("Completa un numero de tarjeta valido.");
                }

                if (!token) {
                  setCardFormErrorMessage(
                    latestCardTokenErrorRef.current ||
                      validationMessages.join(" ") ||
                      "Completa todos los datos de la tarjeta para generar el token.",
                  );
                  return;
                }

                if (validationMessages.length > 0) {
                  setCardFormErrorMessage(validationMessages.join(" "));
                  return;
                }

                latestOnTokenizedRef.current?.({
                  token,
                  paymentMethodId,
                  issuer,
                  installments,
                  payerEmail,
                  couponCode: latestForm.couponCode.trim(),
                  transactionAmount: Number(cardFormData.amount || latestForm.transactionAmount || 0),
                  description: latestForm.description,
                });
              } catch (error) {
                console.error("error submitting Mercado Pago cardForm:", error);
                setCardFormErrorMessage("No se pudo tokenizar la tarjeta. Intenta nuevamente.");
              }
            },
            onFetching: () => {
              const progressBar = document.getElementById(ids.progress);
              const loadingMessage = document.getElementById(ids.loadingMessage);
              const submitButton = document.getElementById(ids.submit) as HTMLButtonElement | null;
              submitButton?.setAttribute("disabled", "true");
              loadingMessage?.removeAttribute("hidden");
              if (progressBar) {
                progressBar.removeAttribute("value");
              }

              return () => {
                submitButton?.removeAttribute("disabled");
                loadingMessage?.setAttribute("hidden", "true");
                progressBar?.setAttribute("value", "0");
                forceSingleInstallment(ids.installments);
              };
            },
            onCardTokenReceived: (errorData: unknown, token: unknown) => {
              if (errorData) {
                const message = formatMercadoPagoError(errorData, "Mercado Pago rechazo la tokenizacion de la tarjeta.");
                latestCardTokenErrorRef.current = message;
                setCardFormErrorMessage(message);
                console.warn("Mercado Pago CardToken error:", errorData);
              }

              return token;
            },
            onError: (error: unknown) => {
              console.error("Mercado Pago CardForm error:", error);
              if (!isDisposed) {
                setCardFormErrorMessage(
                  formatMercadoPagoError(error, "No se pudo cargar el formulario de Mercado Pago. Intenta nuevamente."),
                );
              }
            },
          },
        });
        isInitialized = true;
        return true;
      } catch (error) {
        if (!isDisposed) {
          console.error("No se pudo inicializar CardForm de Mercado Pago.", error);
          setCardFormErrorMessage("No se pudo inicializar Mercado Pago. Intenta nuevamente.");
        }
        return true;
      } finally {
        isInitializing = false;
      }
    };

    const intervalId = window.setInterval(() => {
      if (initializeCardForm()) {
        window.clearInterval(intervalId);
      }
    }, 100);
    if (initializeCardForm()) {
      window.clearInterval(intervalId);
    }

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      installmentsObserver?.disconnect();
      cardForm?.unmount?.();
    };
  }, [
    amount,
    ids.cardNumber,
    ids.cardholderEmail,
    ids.cardholderName,
    ids.expirationDate,
    ids.form,
    ids.installments,
    ids.issuer,
    ids.loadingMessage,
    ids.progress,
    ids.securityCode,
    ids.submit,
  ]);

  const inputClassName =
    "h-11 rounded-xl border border-slate-300/80 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
  const labelClassName = "text-[13px] font-semibold tracking-[0.01em] text-slate-700";
  const paymentResponseClassName =
    paymentResponseTone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : paymentResponseTone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-sky-200 bg-sky-50 text-sky-800";
  const formattedFinalAmount = Number(checkoutForm.transactionAmount || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
  const formattedOriginalAmount = Number(pricingBreakdown?.originalAmount || checkoutForm.transactionAmount || 0).toLocaleString(
    "es-MX",
    {
      style: "currency",
      currency: "MXN",
    },
  );
  const formattedDiscountAmount = Number(pricingBreakdown?.discountAmount || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });

  return (
    <div className="space-y-5">
      <style jsx>{`
        .mp-card-container {
          height: 44px;
          border: 1px solid rgba(203, 213, 225, 0.8);
          border-radius: 12px;
          background: white;
          padding: 10px 12px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
      `}</style>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Tarjeta</p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">Datos de pago</h3>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Seguro
              </span>
            </div>

            <form
              id={ids.form}
              key={`${ids.form}-${amount}`}
              className={`space-y-4 ${isDisabled ? "pointer-events-none opacity-60" : ""}`}
            >
              <input id={ids.amount} type="hidden" value={checkoutForm.transactionAmount} readOnly />
              <input id={ids.description} type="hidden" value={checkoutForm.description} readOnly />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.cardNumber} className={labelClassName}>
                    Numero de tarjeta
                  </Label>
                  <div id={ids.cardNumber} className="mp-card-container" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.expirationDate} className={labelClassName}>
                    Vencimiento
                  </Label>
                  <div id={ids.expirationDate} className="mp-card-container" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.securityCode} className={labelClassName}>
                    Codigo de seguridad
                  </Label>
                  <div id={ids.securityCode} className="mp-card-container" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.cardholderName} className={labelClassName}>
                    Titular
                  </Label>
                  <input
                    id={ids.cardholderName}
                    className={inputClassName}
                    disabled={isDisabled}
                    placeholder="Nombre como aparece en la tarjeta"
                    defaultValue={checkoutForm.cardholderName}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.issuer} className={labelClassName}>
                    Banco emisor
                  </Label>
                  <select id={ids.issuer} className={inputClassName} disabled={isDisabled} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={ids.installments} className={labelClassName}>
                    Cuotas
                  </Label>
                  <select
                    id={ids.installments}
                    className={inputClassName}
                    disabled={isDisabled}
                    onChange={() => window.setTimeout(() => forceSingleInstallment(ids.installments), 0)}
                  />
                </div>
                <div className={`flex flex-col gap-1.5 sm:col-span-2 ${showPayerEmail ? "" : "hidden"}`}>
                  <Label htmlFor={ids.cardholderEmail} className={labelClassName}>
                    Email del pagador
                  </Label>
                  <input
                    id={ids.cardholderEmail}
                    type="email"
                    className={inputClassName}
                    disabled={isDisabled}
                    placeholder="correo@ejemplo.com"
                    readOnly
                    value={resolvedPayerEmail}
                  />
                </div>
              </div>

              <div id={ids.validationErrors} className="space-y-1 text-xs text-red-700" />
              <button
                id={ids.submit}
                type="submit"
                disabled={isDisabled}
                className="h-11 w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>
              <progress id={ids.progress} value="0" className="progress-bar h-1 w-full overflow-hidden rounded-full" />
              <p id={ids.loadingMessage} hidden className="text-center text-xs text-slate-500">
                Loading, please wait...
              </p>
            </form>

            <div
              id={ids.errorMessage}
              hidden={!cardFormErrorMessage}
              aria-live="polite"
              className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {cardFormErrorMessage}
            </div>

            {paymentResponseMessage ? (
              <p className={`mt-4 rounded-xl border px-3 py-2 text-xs font-medium ${paymentResponseClassName}`}>
                {paymentResponseMessage}
              </p>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Resumen</p>
            <p className="mt-2 text-sm text-slate-600">{checkoutForm.description || "Suscripcion POS Zxor"}</p>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{formattedFinalAmount}</p>
            <div className="mt-4 space-y-2 border-t border-sky-100 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>Descripcion</span>
                <span className="max-w-[170px] truncate text-right font-medium text-slate-900">
                  {checkoutForm.description || "Suscripcion POS Zxor"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>Monto</span>
                <span className="font-medium text-slate-900">{formattedFinalAmount}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">{formattedOriginalAmount}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>Descuento</span>
                <span className="font-medium text-emerald-700">-{formattedDiscountAmount}</span>
              </div>
              {pricingBreakdown?.reason ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {pricingBreakdown.reason}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formIdPrefix}__couponCode`} className={labelClassName}>
                  Cupon o descuento
                </Label>
                <Input
                  id={`${formIdPrefix}__couponCode`}
                  className={inputClassName}
                  disabled={isDisabled}
                  placeholder="Ej. BIENVENIDA10"
                  value={checkoutForm.couponCode}
                  onChange={(event) =>
                    setCheckoutForm((prev) => ({ ...prev, couponCode: event.target.value.toUpperCase() }))
                  }
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
