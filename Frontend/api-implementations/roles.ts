export type Role = {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
};

export type GetRolesSuccessResponse = {
  message: string;
  roles: Role[];
};

export type CreateRoleRequest = {
  name: string;
};

export type CreateRoleSuccessResponse = {
  message: string;
  role: Role;
};

export type UpdateRoleRequest = {
  id: string;
  name: string;
};

export type UpdateRoleSuccessResponse = {
  message: string;
  role: Role;
};

export type RolesErrorResponse = {
  message: string;
  error?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

function buildHeaders(token?: string): HeadersInit {
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

export async function getRoles(token?: string): Promise<GetRolesSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/roles`, {
    method: "GET",
    headers: buildHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as RolesErrorResponse;
    throw new Error(errorData.message || "Error al obtener roles");
  }

  return data as GetRolesSuccessResponse;
}

export async function createRole(body: CreateRoleRequest, token?: string): Promise<CreateRoleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/roles`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as RolesErrorResponse;
    throw new Error(errorData.message || "Error al crear rol");
  }

  return data as CreateRoleSuccessResponse;
}

export async function updateRole(body: UpdateRoleRequest, token?: string): Promise<UpdateRoleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/roles/${encodeURIComponent(body.id)}`, {
    method: "PUT",
    headers: buildHeaders(token),
    body: JSON.stringify({
      name: body.name,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as RolesErrorResponse;
    throw new Error(errorData.message || "Error al actualizar rol");
  }

  return data as UpdateRoleSuccessResponse;
}
