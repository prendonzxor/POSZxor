export type LayawayStatus = "active" | "partially_paid" | "completed" | "cancelled" | "expired";

export type LayawayCustomer = {
  id: string;
  fullName: string;
  phone: string | null;
  email?: string | null;
};

export type LayawayItem = {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  qty: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  createdAt?: string;
};

export type Layaway = {
  id: string;
  tenantId: string;
  branchId: string;
  branchName: string | null;
  customerId: string;
  customer: LayawayCustomer;
  status: LayawayStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  depositAmount: number;
  balanceDue: number;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items?: LayawayItem[];
};

export type LayawayItemRequest = {
  productId: string;
  qty: number;
  unitPrice?: number;
  discountAmount?: number;
  taxAmount?: number;
};

export type CreateLayawayRequest = {
  branchId: string;
  customerId: string;
  depositAmount?: number;
  discountAmount?: number;
  expiresAt?: string | null;
  notes?: string | null;
  items: LayawayItemRequest[];
};

export type GetLayawaysParams = {
  status?: LayawayStatus | "all";
  customerId?: string;
  branchId?: string;
  limit?: number;
};

export type LayawayListSuccessResponse = {
  message: string;
  layaways: Layaway[];
};

export type LayawaySingleSuccessResponse = {
  message: string;
  layaway: Layaway;
};

export type LayawayErrorResponse = {
  message: string;
  error?: string;
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

export async function getLayaways(
  params: GetLayawaysParams = {},
  token?: string,
): Promise<LayawayListSuccessResponse> {
  const queryParams = new URLSearchParams();
  if (params.status && params.status !== "all") {
    queryParams.set("status", params.status);
  }
  if (params.customerId?.trim()) {
    queryParams.set("customerId", params.customerId.trim());
  }
  if (params.branchId?.trim()) {
    queryParams.set("branchId", params.branchId.trim());
  }
  if (params.limit) {
    queryParams.set("limit", String(params.limit));
  }

  const query = queryParams.toString();
  const response = await fetch(`${API_BASE_URL}/api/layaways${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorData = data as LayawayErrorResponse;
    throw new Error(errorData.message || "Error al obtener apartados");
  }

  return data as LayawayListSuccessResponse;
}

export async function createLayaway(
  body: CreateLayawayRequest,
  token?: string,
): Promise<LayawaySingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/layaways`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorData = data as LayawayErrorResponse;
    throw new Error(errorData.message || "Error al crear apartado");
  }

  return data as LayawaySingleSuccessResponse;
}

export async function completeLayaway(id: string, token?: string): Promise<LayawaySingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/layaways/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorData = data as LayawayErrorResponse;
    throw new Error(errorData.message || "Error al completar apartado");
  }

  return data as LayawaySingleSuccessResponse;
}

export async function cancelLayaway(id: string, token?: string): Promise<LayawaySingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/layaways/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();
  if (!response.ok) {
    const errorData = data as LayawayErrorResponse;
    throw new Error(errorData.message || "Error al cancelar apartado");
  }

  return data as LayawaySingleSuccessResponse;
}
