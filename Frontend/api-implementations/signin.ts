export type SignInRequest = {
  phoneNumber: string;
  password: string;
};

export type SignInUser = {
  id: number;
  fullName: string;
  phoneNumber: string;
};

export type SignInSuccessResponse = {
  message: string;
  sessionToken: string;
  user: SignInUser;
};

export type SignInErrorResponse = {
  message: string;
  error?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function signIn(body: SignInRequest): Promise<SignInSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as SignInErrorResponse;
    throw new Error(errorData.message || "Signin request failed");
  }

  return data as SignInSuccessResponse;
}

export const SIGNIN_EXAMPLE_BODY: SignInRequest = {
  phoneNumber: "5551234567",
  password: "StrongPass123",
};
