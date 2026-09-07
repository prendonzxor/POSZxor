export type MeUser = {
  id: number;
  tenantId: string;
  email: string | null;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
};

export type MeRole = {
  id: string;
  name: string;
  tenantId: string;
};

export type MeTenantCatalog = {
  id: string;
  catalogKey: string;
  isEnabled: boolean;
  sortOrder: number;
};

export type MeTenant = {
  id: string;
  legalName: string;
  email?: string | null;
  posType: "FERRETERIA" | "RESTAURANTE" | "RETAIL" | "SERVICIOS";
  catalogMode: "STANDARD" | "VARIANTS" | "RECIPES";
  uiPreset: "DEFAULT" | "COMPACT" | "TOUCH";
  onboardingStep: number;
  onboardingCompleted: boolean;
  catalogs: MeTenantCatalog[];
};

export type MeSubscriptionStatus =
  | "trialing"
  | "trial_ended"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled";

export type MeSubscription = {
  id: string;
  tenantId: string;
  planCode: string;
  status: MeSubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  autoRenew: boolean;
};

export type MeSuccessResponse = {
  message: string;
  user: MeUser;
  tenant: MeTenant | null;
  subscriptionStatus: MeSubscriptionStatus | null;
  subscription: MeSubscription | null;
  role: string | null;
  roles: MeRole[];
  catalogs: MeTenantCatalog[];
};

export type MeErrorResponse = {
  message: string;
  error?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function getMe(token?: string): Promise<MeSuccessResponse> {
  const authToken =
    token || (typeof window !== "undefined" ? localStorage.getItem("authToken") || "" : "");

  if (!authToken) {
    throw new Error("No se encontro token de autenticacion");
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as MeErrorResponse;
    throw new Error(errorData.message || "Error al obtener datos del usuario");
  }

  return data as MeSuccessResponse;
}
