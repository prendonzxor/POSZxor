export type UpdateOnboardingRequest = {
  onboardingStep?: number;
  onboardingCompleted?: boolean;
};

export type UpdateOnboardingResponse = {
  message: string;
  tenant: {
    id: string;
    onboardingStep: number;
    onboardingCompleted: boolean;
  };
};

export type OnboardingErrorResponse = {
  message: string;
  error?: string;
};

export type OnboardingTemplate = {
  key: string;
  label: string;
  posType: string;
};

export type GetOnboardingTemplatesResponse = {
  message: string;
  templates: OnboardingTemplate[];
};

export type ApplyOnboardingTemplateRequest = {
  businessType: string;
};

export type ApplyOnboardingTemplateResponse = {
  message: string;
  result: {
    templateKey: string;
    templateLabel: string;
    catalogsApplied: number;
    categoriesApplied: number;
  };
};

export type GetOnboardingDefaultCategoriesResponse = {
  message: string;
  businessType: string;
  categories: string[];
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

export async function updateOnboarding(
  body: UpdateOnboardingRequest,
  token?: string,
): Promise<UpdateOnboardingResponse> {
  const response = await fetch(`${API_BASE_URL}/api/onboarding`, {
    method: "PATCH",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OnboardingErrorResponse;
    throw new Error(errorData.message || "Error al actualizar onboarding");
  }

  return data as UpdateOnboardingResponse;
}

export async function getOnboardingTemplates(token?: string): Promise<GetOnboardingTemplatesResponse> {
  const response = await fetch(`${API_BASE_URL}/api/onboarding/templates`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OnboardingErrorResponse;
    throw new Error(errorData.message || "Error al obtener plantillas de onboarding");
  }

  return data as GetOnboardingTemplatesResponse;
}

export async function applyOnboardingTemplate(
  body: ApplyOnboardingTemplateRequest,
  token?: string,
): Promise<ApplyOnboardingTemplateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/onboarding/templates/apply`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OnboardingErrorResponse;
    throw new Error(errorData.message || "Error al aplicar plantilla de onboarding");
  }

  return data as ApplyOnboardingTemplateResponse;
}

export async function getOnboardingDefaultCategories(
  businessType: string,
  token?: string,
): Promise<GetOnboardingDefaultCategoriesResponse> {
  const query = new URLSearchParams({ businessType: String(businessType || "").trim() }).toString();
  const response = await fetch(`${API_BASE_URL}/api/onboarding/templates/default-categories?${query}`, {
    method: "GET",
    headers: buildAuthHeaders(token),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as OnboardingErrorResponse;
    throw new Error(errorData.message || "Error al obtener categorias por defecto");
  }

  return data as GetOnboardingDefaultCategoriesResponse;
}
