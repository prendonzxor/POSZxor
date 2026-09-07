export type Product = {
  id: string;
  tenantId: string;
  categoryId: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  unit: "pc" | "kg" | "g" | "l" | "ml" | "box" | "pack" | "service";
  allowDecimalQty: boolean;
  cost: number;
  price: number;
  wholesalePrice: number;
  wholesale_price?: number;
  taxRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GetProductsSuccessResponse = {
  message: string;
  products: Product[];
};

export type ProductPayload = {
  categoryId?: string;
  sku?: string;
  barcode?: string;
  name: string;
  unit: "pc" | "kg" | "g" | "l" | "ml" | "box" | "pack" | "service";
  allowDecimalQty: boolean;
  cost: number;
  price: number;
  wholesalePrice?: number;
  taxRate: number;
  isActive: boolean;
};

export type SearchProductsRequest = {
  sku?: string;
  barcode?: string;
  name?: string;
};

export type ProductSingleSuccessResponse = {
  message: string;
  product: Product;
};

export type ProductsErrorResponse = {
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

export async function getProducts(token?: string): Promise<GetProductsSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ProductsErrorResponse;
    throw new Error(errorData.message || "Error al obtener productos");
  }

  return data as GetProductsSuccessResponse;
}

export async function searchProducts(
  params: SearchProductsRequest,
  token?: string,
): Promise<GetProductsSuccessResponse> {
  const queryParams = new URLSearchParams();

  if (params.sku?.trim()) {
    queryParams.set("sku", params.sku.trim());
  }
  if (params.barcode?.trim()) {
    queryParams.set("barcode", params.barcode.trim());
  }
  if (params.name?.trim()) {
    queryParams.set("name", params.name.trim());
  }

  const query = queryParams.toString();
  const response = await fetch(`${API_BASE_URL}/api/products/search${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ProductsErrorResponse;
    throw new Error(errorData.message || "Error al buscar productos");
  }

  return data as GetProductsSuccessResponse;
}

export async function getProductById(id: string, token?: string): Promise<ProductSingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ProductsErrorResponse;
    throw new Error(errorData.message || "Error al obtener producto");
  }

  return data as ProductSingleSuccessResponse;
}

export async function createProduct(body: ProductPayload, token?: string): Promise<ProductSingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/products`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ProductsErrorResponse;
    throw new Error(errorData.message || "Error al crear producto");
  }

  return data as ProductSingleSuccessResponse;
}

export async function updateProduct(
  id: string,
  body: ProductPayload,
  token?: string,
): Promise<ProductSingleSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ProductsErrorResponse;
    throw new Error(errorData.message || "Error al actualizar producto");
  }

  return data as ProductSingleSuccessResponse;
}
