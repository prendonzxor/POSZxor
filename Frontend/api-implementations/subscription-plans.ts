export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  priceMxn: number;
  mercadoPagoPreapprovalPlanId: string | null;
  billingPeriod: string;
  description: string;
  badge: string | null;
  recommendation: string | null;
  sortOrder: number;
  limitsUsers: number | null;
  limitsBranches: number | null;
  limitsOrdersPerMonth: number | null;
  limitsProducts: number | null;
  isUnlimitedUsers: boolean;
  isUnlimitedBranches: boolean;
  isUnlimitedOrders: boolean;
  isUnlimitedProducts: boolean;
  features: string[];
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SubscriptionPricingPreview = {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode: string | null;
  isDiscountApplied: boolean;
  reason: string | null;
};

export type GetSubscriptionPlansResponse = {
  message: string;
  plans: SubscriptionPlan[];
};

export type SubscriptionPricingPreviewResponse = {
  message: string;
  plan: SubscriptionPlan;
  pricing: SubscriptionPricingPreview;
};

export type SubscriptionPlansErrorResponse = {
  message: string;
  error?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function getSubscriptionPlans(): Promise<GetSubscriptionPlansResponse> {
  const response = await fetch(`${API_BASE_URL}/api/subscription-plans`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as SubscriptionPlansErrorResponse;
    throw new Error(errorData.message || "Error al obtener planes de suscripcion");
  }

  return data as GetSubscriptionPlansResponse;
}

export async function getSubscriptionPricingPreview(body: {
  planCode: string;
  couponCode?: string | null;
}): Promise<SubscriptionPricingPreviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/subscription-plans/pricing-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as SubscriptionPlansErrorResponse;
    throw new Error(errorData.message || "Error al obtener preview de suscripcion");
  }

  return data as SubscriptionPricingPreviewResponse;
}
