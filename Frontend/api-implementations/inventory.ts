export type InventoryItem = {
  tenantId: string;
  branchId: string;
  productId: string;
  qtyOnHand: number;
  qtyReserved?: number;
  reorderLevel: number;
  updatedAt: string;
};

export type InventoryMovement = {
  id: string;
  tenantId: string;
  branchId: string;
  productId: string;
  type: "purchase" | "sale" | "adjustment" | "return" | "transfer_in" | "transfer_out";
  qtyDelta: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdBy: number | null;
  createdAt: string;
};

export type GetInventorySuccessResponse = {
  message: string;
  inventory: InventoryItem[];
};

export type GetInventoryMovementsRequest = {
  branchId?: string;
  productId?: string;
};

export type GetInventoryMovementsSuccessResponse = {
  message: string;
  movements: InventoryMovement[];
};

export type CreateInventoryRequest = {
  branchId: string;
  productId: string;
  qtyOnHand?: number;
  reorderLevel?: number;
};

export type UpdateInventoryRequest = {
  branchId: string;
  productId: string;
  qtyOnHand?: number;
  reorderLevel?: number;
};

export type BulkInventoryEntryItemRequest = {
  productId: string;
  qtyDelta: number;
  unitCost?: number | null;
};

export type BulkInventoryEntryRequest = {
  branchId: string;
  type: "purchase" | "adjustment" | "return" | "transfer_in";
  note?: string | null;
  items: BulkInventoryEntryItemRequest[];
};

export type InventorySingleSuccessResponse = {
  message: string;
  inventory: InventoryItem;
};

export type BulkInventoryEntrySuccessResponse = {
  message: string;
  referenceId: string;
  itemCount: number;
  totalQty: number;
  inventory: InventoryItem[];
};

export type StockValidationSession = {
  id: string;
  tenantId: string;
  branchId: string;
  periodKey: string;
  status: "draft" | "completed" | string;
  notes: string | null;
  createdBy: number | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type StockValidationItem = {
  id: string;
  sessionId: string;
  tenantId: string;
  branchId: string;
  productId: string;
  virtualQty: number;
  reservedQty: number;
  realQty: number | null;
  differenceQty: number | null;
  status: "pending" | "matched" | "surplus" | "shortage" | string;
  adjustedAt: string | null;
  adjustedBy: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type StockValidationSessionResponse = {
  message: string;
  session: StockValidationSession | null;
  items: StockValidationItem[];
};

export type StockValidationItemResponse = {
  message: string;
  item: StockValidationItem;
};

export type InventoryErrorResponse = {
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

export async function getInventory(branchId?: string, token?: string): Promise<GetInventorySuccessResponse> {
  const params = new URLSearchParams();
  if (branchId) {
    params.set("branchId", branchId);
  }

  const query = params.toString();
  const url = `${API_BASE_URL}/api/inventory${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al obtener inventario");
  }

  return data as GetInventorySuccessResponse;
}

export async function getInventoryMovements(
  params: GetInventoryMovementsRequest = {},
  token?: string,
): Promise<GetInventoryMovementsSuccessResponse> {
  const queryParams = new URLSearchParams();
  if (params.branchId?.trim()) {
    queryParams.set("branchId", params.branchId.trim());
  }
  if (params.productId?.trim()) {
    queryParams.set("productId", params.productId.trim());
  }

  const query = queryParams.toString();
  const response = await fetch(`${API_BASE_URL}/api/inventory-movements${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al obtener movimientos de inventario");
  }

  return data as GetInventoryMovementsSuccessResponse;
}

export async function getInventoryByBranchAndProduct(
  branchId: string,
  productId: string,
  token?: string,
): Promise<InventorySingleSuccessResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/inventory/${encodeURIComponent(branchId)}/${encodeURIComponent(productId)}`,
    {
      method: "GET",
      headers: buildAuthHeaders(token),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al obtener inventario");
  }

  return data as InventorySingleSuccessResponse;
}

export async function createInventory(
  body: CreateInventoryRequest,
  token?: string,
): Promise<InventorySingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inventory`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al crear inventario");
  }

  return data as InventorySingleSuccessResponse;
}

export async function updateInventory(
  body: UpdateInventoryRequest,
  token?: string,
): Promise<InventorySingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inventory`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al actualizar inventario");
  }

  return data as InventorySingleSuccessResponse;
}

export async function createBulkInventoryEntry(
  body: BulkInventoryEntryRequest,
  token?: string,
): Promise<BulkInventoryEntrySuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/bulk-entry`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al aplicar entrada masiva");
  }

  return data as BulkInventoryEntrySuccessResponse;
}

export async function getCurrentStockValidationSession(
  params: { branchId: string; periodKey: string },
  token?: string,
): Promise<StockValidationSessionResponse> {
  const queryParams = new URLSearchParams({
    branchId: params.branchId,
    periodKey: params.periodKey,
  });
  const response = await fetch(`${API_BASE_URL}/api/inventory/stock-validations/current?${queryParams}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al obtener validacion de stock");
  }

  return data as StockValidationSessionResponse;
}

export async function ensureStockValidationSession(
  body: { branchId: string; periodKey: string; notes?: string | null },
  token?: string,
): Promise<StockValidationSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/stock-validations`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al crear validacion de stock");
  }

  return data as StockValidationSessionResponse;
}

export async function saveStockValidationItem(
  sessionId: string,
  body: {
    productId: string;
    virtualQty: number;
    reservedQty: number;
    realQty: number;
  },
  token?: string,
): Promise<StockValidationItemResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/stock-validations/${encodeURIComponent(sessionId)}/items`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al guardar conteo de stock");
  }

  return data as StockValidationItemResponse;
}

export async function markStockValidationItemAdjusted(
  sessionId: string,
  productId: string,
  token?: string,
): Promise<{ message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/api/inventory/stock-validations/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(productId)}/adjusted`,
    {
      method: "PUT",
      headers: buildAuthHeaders(token),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al marcar conteo ajustado");
  }

  return data as { message: string };
}

export async function completeStockValidationSession(
  sessionId: string,
  token?: string,
): Promise<StockValidationSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/stock-validations/${encodeURIComponent(sessionId)}/complete`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as InventoryErrorResponse;
    throw new Error(errorData.message || "Error al completar validacion de stock");
  }

  return data as StockValidationSessionResponse;
}

export async function createNewStockValidationSession(body: { branchId: string; periodKey: string }): Promise<StockValidationSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/stock-validations/new`, {
    method: "POST", headers: buildAuthHeaders(), body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo crear una nueva validacion.");
  return data as StockValidationSessionResponse;
}

export type StockValidationReport = {
  id: string; sessionId: string; branchId: string; createdAt: string;
  snapshot: { branchName: string; periodKey: string; items: {
    productId: string; name: string; sku: string; barcode: string;
    previousQty: number; realQty: number; differenceQty: number; omitted: boolean;
  }[] };
};
export async function getStockValidationReport(sessionId: string): Promise<{ report: StockValidationReport | null }> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/stock-validations/${encodeURIComponent(sessionId)}/report`, { headers: buildAuthHeaders(), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo cargar el reporte.");
  return data;
}
export async function applyFullStockValidation(sessionId: string, body: { scopeProductIds: string[]; items: { productId: string; realQty: number }[] }): Promise<{ report: StockValidationReport }> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/stock-validations/${encodeURIComponent(sessionId)}/apply`, { method: "POST", headers: buildAuthHeaders(), body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo aplicar el conteo.");
  return data;
}

export async function listStockValidationReports(page = 1): Promise<{ reports: StockValidationReport[]; total: number; page: number; pageSize: number }> {
  const response = await fetch(`${API_BASE_URL}/api/inventory/stock-validations/reports?page=${page}`, { headers: buildAuthHeaders(), cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar los reportes de stock.");
  return data;
}
