export type Coupon = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  scope: "order" | "product" | "category" | "customer" | "subscription" | "subscription_plan";
  targetRef: string | null;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CouponCreateRequest = {
  code: string;
  name: string;
  description?: string | null;
  scope: Coupon["scope"];
  targetRef?: string | null;
  discountType: Coupon["discountType"];
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  usageLimit?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
};

export type CouponUpdateRequest = Partial<CouponCreateRequest>;

export type CouponValidationResult = {
  isValid: boolean;
  reason: string | null;
  discountAmount: number;
  finalSubtotal: number;
  coupon: Coupon | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3010";

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Error en promociones");
  }

  return data as T;
}

export async function getCoupons(token: string): Promise<Coupon[]> {
  const data = await request<{ message: string; coupons: Coupon[] }>("/api/promotions/coupons", token, {
    method: "GET",
  });
  return data.coupons;
}

export async function createCoupon(token: string, body: CouponCreateRequest): Promise<Coupon> {
  const data = await request<{ message: string; coupon: Coupon }>("/api/promotions/coupons", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.coupon;
}

export async function updateCoupon(token: string, id: string, body: CouponUpdateRequest): Promise<Coupon> {
  const data = await request<{ message: string; coupon: Coupon }>(`/api/promotions/coupons/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return data.coupon;
}

export async function validateCoupon(
  token: string,
  body: { code: string; subtotal: number },
): Promise<CouponValidationResult> {
  const data = await request<{ message: string; result: CouponValidationResult }>(
    "/api/promotions/coupons/validate",
    token,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  return data.result;
}
