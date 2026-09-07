export type Customer = {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  creditLimit: number;
  creditBalance: number;
  discount: number;
  isActive: boolean;
  createdAt: string;
};

export type GetCustomersSuccessResponse = {
  message: string;
  customers: Customer[];
};

export type CreateCustomerRequest = {
  fullName: string;
  phone?: string;
  email?: string;
  notes?: string;
  creditLimit?: number;
  creditBalance?: number;
  discount?: number;
  isActive?: boolean;
};

export type SearchCustomersRequest = {
  id?: string;
  name?: string;
  phone?: string;
};

export type UpdateCustomerRequest = {
  id: string;
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  creditLimit?: number;
  creditBalance?: number;
  discount?: number;
  isActive?: boolean;
};

export type CustomerSingleSuccessResponse = {
  message: string;
  customer: Customer;
};

export type CustomersErrorResponse = {
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

export async function getCustomers(token?: string): Promise<GetCustomersSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/customers`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as CustomersErrorResponse;
    throw new Error(errorData.message || "Error al obtener clientes");
  }

  return data as GetCustomersSuccessResponse;
}

export async function searchCustomers(
  params: SearchCustomersRequest,
  token?: string,
): Promise<GetCustomersSuccessResponse> {
  const queryParams = new URLSearchParams();

  if (params.id?.trim()) {
    queryParams.set("id", params.id.trim());
  }
  if (params.name?.trim()) {
    queryParams.set("name", params.name.trim());
  }
  if (params.phone?.trim()) {
    queryParams.set("phone", params.phone.trim());
  }

  const query = queryParams.toString();
  const response = await fetch(`${API_BASE_URL}/api/customers/search${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as CustomersErrorResponse;
    throw new Error(errorData.message || "Error al buscar clientes");
  }

  return data as GetCustomersSuccessResponse;
}

export async function createCustomer(
  body: CreateCustomerRequest,
  token?: string,
): Promise<CustomerSingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/customers`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as CustomersErrorResponse;
    throw new Error(errorData.message || "Error al crear cliente");
  }

  return data as CustomerSingleSuccessResponse;
}

export async function updateCustomer(
  body: UpdateCustomerRequest,
  token?: string,
): Promise<CustomerSingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/customers/${encodeURIComponent(body.id)}`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      fullName: body.fullName,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
      creditLimit: body.creditLimit,
      creditBalance: body.creditBalance,
      discount: body.discount,
      isActive: body.isActive,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as CustomersErrorResponse;
    throw new Error(errorData.message || "Error al actualizar cliente");
  }

  return data as CustomerSingleSuccessResponse;
}
