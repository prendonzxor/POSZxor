export type CheckoutItemRequest = {
  productId: string;
  qty: number;
  unitPrice?: number;
  discountAmount?: number;
  taxAmount?: number;
};

export type CheckoutRequest = {
  branchId: string;
  customerId?: string | null;
  orderType: "pos" | "delivery" | "pickup";
  paymentType: "cash" | "card" | "transfer" | "mixed" | "credit";
  discountAmount?: number;
  taxAmount?: number;
  notes?: string;
  items: CheckoutItemRequest[];
};

export type CheckoutItemResponse = {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  subtotal: number;
  total: number;
};

export type OrderCustomer = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};

export type CheckoutOrderResponse = {
  id: string;
  numOrder: string | null;
  tenantId: string;
  branchId: string;
  customerId: string | null;
  customer: OrderCustomer | null;
  orderType: "pos" | "delivery" | "pickup";
  paymentType: "cash" | "card" | "transfer" | "mixed" | "credit";
  status: "created" | "paid" | "cancelled";
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  cost?: number;
  profit?: number;
  notes: string | null;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string | null;
  items: CheckoutItemResponse[];
};

export type CheckoutSuccessResponse = {
  message: string;
  order: CheckoutOrderResponse;
};

export type OrderSummary = Omit<CheckoutOrderResponse, "items">;

export type GetOrdersRequest = {
  branchId?: string;
  status?: "created" | "paid" | "cancelled";
  orderType?: "pos" | "delivery" | "pickup";
  paymentType?: "cash" | "card" | "transfer" | "mixed" | "credit";
  limit?: number;
};

export type GetOrdersSuccessResponse = {
  message: string;
  orders: OrderSummary[];
};

export type GetOrderDetailsSuccessResponse = {
  message: string;
  order: CheckoutOrderResponse;
};

export type UpdateOrderRequest = {
  id: string;
  customerId?: string | null;
  orderType?: "pos" | "delivery" | "pickup";
  paymentType?: "cash" | "card" | "transfer" | "mixed" | "credit";
  status?: "created" | "paid" | "cancelled";
  discountAmount?: number;
  taxAmount?: number;
  notes?: string | null;
};

export type UpdateOrderSuccessResponse = {
  message: string;
  order: CheckoutOrderResponse;
};

export type CancelOrderSuccessResponse = {
  message: string;
  restoredItemCount: number;
  order: CheckoutOrderResponse;
};

export type OrdersErrorResponse = {
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

export async function createCheckoutOrder(
  body: CheckoutRequest,
  token?: string,
): Promise<CheckoutSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/checkout`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OrdersErrorResponse;
    throw new Error(errorData.message || "Error al crear checkout");
  }

  return data as CheckoutSuccessResponse;
}

export async function getOrders(
  params: GetOrdersRequest = {},
  token?: string,
): Promise<GetOrdersSuccessResponse> {
  const queryParams = new URLSearchParams();
  if (params.branchId?.trim()) queryParams.set("branchId", params.branchId.trim());
  if (params.status) queryParams.set("status", params.status);
  if (params.orderType) queryParams.set("orderType", params.orderType);
  if (params.paymentType) queryParams.set("paymentType", params.paymentType);
  if (params.limit !== undefined && Number.isFinite(params.limit)) {
    queryParams.set("limit", String(Math.max(1, Math.min(500, Math.trunc(params.limit)))));
  }

  const query = queryParams.toString();
  const response = await fetch(`${API_BASE_URL}/api/orders${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OrdersErrorResponse;
    throw new Error(errorData.message || "Error al obtener ordenes");
  }

  return data as GetOrdersSuccessResponse;
}

export async function getOrderDetails(
  orderId: string,
  token?: string,
): Promise<GetOrderDetailsSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OrdersErrorResponse;
    throw new Error(errorData.message || "Error al obtener detalle de orden");
  }

  return data as GetOrderDetailsSuccessResponse;
}

export async function updateOrder(
  body: UpdateOrderRequest,
  token?: string,
): Promise<UpdateOrderSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(body.id)}`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      customerId: body.customerId,
      orderType: body.orderType,
      paymentType: body.paymentType,
      status: body.status,
      discountAmount: body.discountAmount,
      taxAmount: body.taxAmount,
      notes: body.notes,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OrdersErrorResponse;
    throw new Error(errorData.message || "Error al actualizar orden");
  }

  return data as UpdateOrderSuccessResponse;
}

export async function cancelOrder(
  orderId: string,
  token?: string,
): Promise<CancelOrderSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OrdersErrorResponse;
    throw new Error(errorData.message || "Error al cancelar orden");
  }

  return data as CancelOrderSuccessResponse;
}
