export type Branch = {
  id: string;
  tenantId: string;
  name: string;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  isActive: boolean;
  createdAt: string;
};

export type GetBranchesSuccessResponse = {
  message: string;
  branches: Branch[];
};

export type GetPrimaryBranchSuccessResponse = {
  message: string;
  branch: Branch | null;
};

export type CreateBranchRequest = {
  name: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  isActive?: boolean;
};

export type UpdateBranchRequest = {
  id: string;
  name?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  isActive?: boolean;
};

export type BranchSingleSuccessResponse = {
  message: string;
  branch: Branch;
};

export type BranchesErrorResponse = {
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

export async function getBranches(token?: string): Promise<GetBranchesSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/branches`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as BranchesErrorResponse;
    throw new Error(errorData.message || "Error al obtener sucursales");
  }

  return data as GetBranchesSuccessResponse;
}

export async function getPrimaryBranch(token?: string): Promise<GetPrimaryBranchSuccessResponse> {
  const response = await getBranches(token);
  const primaryBranch = response.branches.find((branch) => branch.isActive) || response.branches[0] || null;

  return {
    message: primaryBranch ? "sucursal obtenida" : "sin sucursal",
    branch: primaryBranch,
  };
}

export async function createBranch(
  body: CreateBranchRequest,
  token?: string,
): Promise<BranchSingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/branches`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as BranchesErrorResponse;
    throw new Error(errorData.message || "Error al crear sucursal");
  }

  return data as BranchSingleSuccessResponse;
}

export async function updateBranch(
  body: UpdateBranchRequest,
  token?: string,
): Promise<BranchSingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/branches/${encodeURIComponent(body.id)}`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      name: body.name,
      phone: body.phone,
      addressLine1: body.addressLine1,
      city: body.city,
      state: body.state,
      isActive: body.isActive,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as BranchesErrorResponse;
    throw new Error(errorData.message || "Error al actualizar sucursal");
  }

  return data as BranchSingleSuccessResponse;
}
