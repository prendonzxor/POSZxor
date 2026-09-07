export type TenantUser = {
  id: number;
  tenantId: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
  role: string | null;
  roles: string[];
};

export type GetUsersSuccessResponse = {
  message: string;
  tenantId: string;
  users: TenantUser[];
};

export type CreateUserRequest = {
  fullName: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  roleId?: string;
};

export type CreateUserSuccessResponse = {
  message: string;
  user: TenantUser;
};

export type UsersErrorResponse = {
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

export async function getUsers(token?: string): Promise<GetUsersSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as UsersErrorResponse;
    throw new Error(errorData.message || "Error al obtener usuarios");
  }

  return data as GetUsersSuccessResponse;
}

export async function createUser(body: CreateUserRequest, token?: string): Promise<CreateUserSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as UsersErrorResponse;
    throw new Error(errorData.message || "Error al crear usuario");
  }

  return data as CreateUserSuccessResponse;
}
