import { buildMercadoPagoDeviceHeaders } from "./mercado-pago-device-id";

export type SignUpRequest = {
  fullName: string;
  phoneNumber: string;
  email?: string;
  password: string;
  confirmPassword: string;
  planCode?: string;
  paymentProvider?: "mercado-pago" | string | null;
  paymentMethodToken?: string | null;
  paymentCustomerRef?: string | null;
  paymentMethodBrand?: string | null;
  paymentMethodStatus?: "pending" | "ready" | "expired" | "revoked" | null;
  paymentIdentificationType?: string | null;
  paymentIdentificationNumber?: string | null;
};

export type SignUpUser = {
  id: string;
  tenantId: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
};

export type SignUpSuccessResponse = {
  message: string;
  user: SignUpUser;
};

export type SignUpErrorResponse = {
  message: string;
  error?: string;
};

export type SignupMercadoPagoPreapprovalResponse = {
  message: string;
  provider: string;
  endpoint: string;
  request: {
    preapproval_plan_id?: string;
    reason: string;
    external_reference?: string;
    payer_email: string;
    card_token_id: string;
    auto_recurring: {
      frequency: number;
      frequency_type: "days" | "months";
      transaction_amount: number;
      currency_id: string;
    };
    back_url: string;
    status?: string;
  };
  preapproval: {
    id?: string | number;
    status?: string;
    reason?: string;
    external_reference?: string;
    preapproval_plan_id?: string;
    payer_email?: string;
    [key: string]: unknown;
  };
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function signUp(body: SignUpRequest): Promise<SignUpSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as SignUpErrorResponse;
    throw new Error(errorData.message || "Signup request failed");
  }

  return data as SignUpSuccessResponse;
}

export async function createSignupMercadoPagoPreapproval(body: {
  preapproval_plan_id?: string;
  reason: string;
  external_reference?: string;
  payer_email: string;
  card_token_id: string;
  auto_recurring: {
    frequency: number;
    frequency_type: "days" | "months";
    transaction_amount: number;
    currency_id: string;
  };
  back_url: string;
  status?: string;
}): Promise<SignupMercadoPagoPreapprovalResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup/preapproval`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildMercadoPagoDeviceHeaders(),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as SignUpErrorResponse;
    throw new Error(errorData.message || "No se pudo crear el preapproval en Mercado Pago");
  }

  return data as SignupMercadoPagoPreapprovalResponse;
}

export const SIGNUP_EXAMPLE_BODY: SignUpRequest = {
  fullName: "Mariana Soto",
  phoneNumber: "5551234567",
  password: "StrongPass123",
  confirmPassword: "StrongPass123",
};
