import { buildMercadoPagoDeviceHeaders } from "./mercado-pago-device-id";

export type Tenant = {
  id: string;
  legalName: string;
  commercialName: string | null;
  rfc: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  posType: string | null;
  catalogMode: string | null;
  uiPreset: string | null;
  onboardingStep: number | null;
  onboardingCompleted: boolean | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GetTenantMeSuccessResponse = {
  message: string;
  tenant: Tenant;
};

export type UpdateTenantMeRequest = {
  legalName?: string;
  commercialName?: string | null;
  rfc?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  timezone?: string | null;
  posType?: string | null;
  catalogMode?: string | null;
  uiPreset?: string | null;
  onboardingStep?: number | null;
  onboardingCompleted?: boolean | null;
};

export type UpdateTenantMeSuccessResponse = {
  message: string;
  tenant: Tenant;
};

export type SubscriptionPlanCode =
  | "FREE"
  | "STARTER"
  | "PRO"
  | "ENTERPRISE"
  | "BASIC"
  | "PREMIUM";

export type TenantSubscription = {
  id: string;
  tenantId: string;
  planCode: SubscriptionPlanCode;
  status: "trialing" | "trial_ended" | "active" | "past_due" | "suspended" | "canceled";
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
  paymentProvider: string | null;
  paymentCustomerRef: string | null;
  paymentMethodToken: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  paymentMethodStatus: "pending" | "ready" | "expired" | "revoked" | null;
  limitsUsers: number;
  limitsBranches: number;
  limitsProducts: number;
  limitsOrdersPerMonth: number;
  limitsCustomers: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GetTenantSubscriptionResponse = {
  message: string;
  status: TenantSubscription["status"] | null;
  subscription: TenantSubscription;
};

export type UpdateTenantSubscriptionRequest = {
  planCode?: SubscriptionPlanCode;
  status?: "trialing" | "trial_ended" | "active" | "past_due" | "suspended" | "canceled";
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  autoRenew?: boolean;
  paymentProvider?: string | null;
  paymentCustomerRef?: string | null;
  paymentMethodToken?: string | null;
  paymentMethodBrand?: string | null;
  paymentMethodLast4?: string | null;
  paymentMethodStatus?: "pending" | "ready" | "expired" | "revoked" | null;
  limitsUsers?: number;
  limitsBranches?: number;
  limitsProducts?: number;
  limitsOrdersPerMonth?: number;
  limitsCustomers?: number;
};

export type UpdateTenantSubscriptionResponse = {
  message: string;
  subscription: TenantSubscription;
};

export type MercadoPagoPaymentRequest = {
  transaction_amount: number;
  token: string;
  description?: string;
  installments?: number;
  payment_method_id: string;
  issuer_id?: number;
  external_reference?: string;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
};

export type MercadoPagoPaymentResponse = {
  message: string;
  detail?: string | null;
  status?: string | null;
  id?: string | number | null;
  provider: string;
  endpoint: string;
  request: MercadoPagoPaymentRequest;
  payment: {
    id?: string | number;
    status?: string;
    status_detail?: string;
    payment_method_id?: string;
    payment_type_id?: string;
    [key: string]: unknown;
  };
};

export type MercadoPagoPreapprovalRequest = {
  preapproval_plan_id?: string;
  preapprovalPlanId?: string;
  reason: string;
  external_reference?: string;
  externalReference?: string;
  payer_email?: string;
  payerEmail?: string;
  card_token_id?: string;
  cardTokenId?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: "days" | "months";
    transaction_amount: number;
    currency_id: string;
    start_date?: string;
    end_date?: string;
  };
  autoRecurring?: {
    frequency: number;
    frequencyType: "days" | "months";
    transactionAmount: number;
    currencyId: string;
    startDate?: string;
    endDate?: string;
  };
  back_url?: string;
  backUrl?: string;
  status?: string;
};

export type MercadoPagoPreapprovalResponse = {
  message: string;
  provider: string;
  endpoint: string;
  request: MercadoPagoPreapprovalRequest;
  preapproval: {
    id?: string | number;
    status?: string;
    reason?: string;
    external_reference?: string;
    preapproval_plan_id?: string;
    payer_id?: string | number;
    payer_email?: string;
    [key: string]: unknown;
  };
};

export type TenantsErrorResponse = {
  message: string;
  error?: string;
  details?: unknown;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

function buildAuthHeaders(token?: string): HeadersInit {
  const authToken =
    token || (typeof window !== "undefined" ? localStorage.getItem("authToken") || "" : "");

  if (!authToken) {
    throw new Error("No se encontro token de autenticacion");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };
}

export async function getTenantMe(token?: string): Promise<GetTenantMeSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tenants/me`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as TenantsErrorResponse;
    throw new Error(errorData.message || "Error al obtener tenant");
  }

  return data as GetTenantMeSuccessResponse;
}

export async function updateTenantMe(
  body: UpdateTenantMeRequest,
  token?: string,
): Promise<UpdateTenantMeSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tenants/me`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as TenantsErrorResponse;
    throw new Error(errorData.message || "Error al actualizar tenant");
  }

  return data as UpdateTenantMeSuccessResponse;
}

export async function getTenantSubscription(token?: string): Promise<GetTenantSubscriptionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tenants/subscription`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as TenantsErrorResponse;
    throw new Error(errorData.message || "Error al obtener suscripcion");
  }

  return data as GetTenantSubscriptionResponse;
}

export async function updateTenantSubscription(
  body: UpdateTenantSubscriptionRequest,
  token?: string,
): Promise<UpdateTenantSubscriptionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tenants/subscription`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as TenantsErrorResponse;
    throw new Error(errorData.message || "Error al actualizar suscripcion");
  }

  return data as UpdateTenantSubscriptionResponse;
}

export async function createMercadoPagoPayment(
  body: MercadoPagoPaymentRequest,
  token?: string,
): Promise<MercadoPagoPaymentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tenants/subscription/providers/mercado-pago/payments`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(token),
      "X-Idempotency-Key": crypto.randomUUID(),
      ...buildMercadoPagoDeviceHeaders(),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as TenantsErrorResponse;
    throw new Error(errorData.message || "Error al crear pago en Mercado Pago");
  }

  return data as MercadoPagoPaymentResponse;
}

export async function createMercadoPagoPreapproval(
  body: MercadoPagoPreapprovalRequest,
  token?: string,
): Promise<MercadoPagoPreapprovalResponse> {
  const response = await fetch(`${API_BASE_URL}/api/tenants/subscription/providers/mercado-pago/preapproval`, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(token),
      ...buildMercadoPagoDeviceHeaders(),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as TenantsErrorResponse;
    throw new Error(errorData.message || "Error al crear preapproval en Mercado Pago");
  }

  return data as MercadoPagoPreapprovalResponse;
}
