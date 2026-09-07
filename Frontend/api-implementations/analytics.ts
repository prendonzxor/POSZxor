export type AnalyticsSummary = {
  totalSells: number;
  totalOrders: number;
  totalCustomers: number;
};

export type AnalyticsSaleByDay = {
  date: string;
  totalSells: number;
  totalOrders: number;
};

export type AnalyticsOrdersByType = {
  orderType: string;
  totalOrders: number;
  totalSells: number;
};

export type AnalyticsOverviewResponse = {
  message: string;
  summary: AnalyticsSummary;
  salesByDay: AnalyticsSaleByDay[];
  ordersByType: AnalyticsOrdersByType[];
};

export type AnalyticsErrorResponse = {
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

export async function getAnalyticsOverview(days = 7, token?: string): Promise<AnalyticsOverviewResponse> {
  const safeDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.trunc(days))) : 7;
  const response = await fetch(`${API_BASE_URL}/api/analytics/overview?days=${safeDays}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as AnalyticsErrorResponse;
    throw new Error(errorData.message || "Error al obtener metricas");
  }

  return data as AnalyticsOverviewResponse;
}

