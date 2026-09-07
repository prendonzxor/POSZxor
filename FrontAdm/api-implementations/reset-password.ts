export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
};

export type ResetPasswordSuccessResponse = {
  message: string;
};

export type ResetPasswordErrorResponse = {
  message: string;
  error?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function resetPassword(
  body: ResetPasswordRequest,
): Promise<ResetPasswordSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ResetPasswordErrorResponse;
    throw new Error(errorData.message || "Reset password request failed");
  }

  return data as ResetPasswordSuccessResponse;
}
