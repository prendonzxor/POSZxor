export type Category = {
  id: string;
  tenantId: string;
  name: string;
  estatus: boolean;
  createdAt: string;
};

export type GetCategoriesSuccessResponse = {
  message: string;
  tenantId?: string;
  categories: Category[];
};

export type CreateCategoryRequest = {
  name: string;
  estatus?: boolean;
};

export type UpdateCategoryRequest = {
  id: string;
  name: string;
  estatus?: boolean;
};

export type CategorySingleSuccessResponse = {
  message: string;
  category: Category;
};

export type CategoriesErrorResponse = {
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

export async function getCategories(token?: string): Promise<GetCategoriesSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: "GET",
    headers: buildAuthHeaders(token),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as CategoriesErrorResponse;
    throw new Error(errorData.message || "Error al obtener categorias");
  }

  return data as GetCategoriesSuccessResponse;
}

export async function createCategory(
  body: CreateCategoryRequest,
  token?: string,
): Promise<CategorySingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as CategoriesErrorResponse;
    throw new Error(errorData.message || "Error al crear categoria");
  }

  return data as CategorySingleSuccessResponse;
}

export async function updateCategory(
  body: UpdateCategoryRequest,
  token?: string,
): Promise<CategorySingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/categories/${encodeURIComponent(body.id)}`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify({
      name: body.name,
      estatus: body.estatus,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as CategoriesErrorResponse;
    throw new Error(errorData.message || "Error al actualizar categoria");
  }

  return data as CategorySingleSuccessResponse;
}
