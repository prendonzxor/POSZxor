export type RecoveryPasswordRequest = {
  phoneNumber: string;
};

export type RecoveryPasswordSuccessResponse = {
  message: string;
  expiresAt?: string;
  recoveryCode?: string;
};

export type RecoveryPasswordErrorResponse = {
  message: string;
  error?: string;
};

export type ResetPasswordRequest = {
  phoneNumber?: string;
  code?: string;
  token?: string;
  newPassword: string;
};

export type ResetPasswordSuccessResponse = {
  message: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

export async function requestPasswordRecovery(
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
    throw new Error(errorData.message || "Recovery request failed");
  }

  return data as RecoveryPasswordSuccessResponse;
}

export async function resetPassword(body: ResetPasswordRequest): Promise<ResetPasswordSuccessResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as RecoveryPasswordErrorResponse;
    throw new Error(errorData.message || "Reset password request failed");
  }

  return data as ResetPasswordSuccessResponse;
}

export const RECOVERY_EXAMPLE_BODY: RecoveryPasswordRequest = {
  phoneNumber: "5551234567",
};
