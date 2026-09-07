export type RecoveryPasswordRequest = {
  phoneNumber: string;
};

export type RecoveryPasswordSuccessResponse = {
  message: string;
  expiresAt?: string;
  resetToken?: string;
};

export type RecoveryPasswordErrorResponse = {
  message: string;
  error?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function recoveryPassword(
  body: RecoveryPasswordRequest,
): Promise<RecoveryPasswordSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/recovery-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as RecoveryPasswordErrorResponse;
    throw new Error(errorData.message || "Recovery password request failed");
  }

  return data as RecoveryPasswordSuccessResponse;
}
