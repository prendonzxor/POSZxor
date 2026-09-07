export type NotificationType = "info" | "success" | "warning" | "error";
export type NotificationStatus = "unread" | "read" | "archived";

export type Notification = {
  id: string;
  tenantId: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GetNotificationsSuccessResponse = {
  message: string;
  notifications: Notification[];
};

export type NotificationsErrorResponse = {
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

export async function getNotifications(
  params: { status?: NotificationStatus; limit?: number } = {},
  token?: string,
): Promise<GetNotificationsSuccessResponse> {
  const queryParams = new URLSearchParams();

  if (params.status) {
    queryParams.set("status", params.status);
  }

  if (params.limit) {
    queryParams.set("limit", String(params.limit));
  }

  const query = queryParams.toString();
  const response = await fetch(`${API_BASE_URL}/api/notifications${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as NotificationsErrorResponse;
    throw new Error(errorData.message || "Error al obtener notificaciones");
  }

  return data as GetNotificationsSuccessResponse;
}
