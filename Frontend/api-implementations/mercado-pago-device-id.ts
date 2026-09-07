declare global {
  interface Window {
    MP_DEVICE_SESSION_ID?: string;
    deviceId?: string;
  }
}

export function getMercadoPagoDeviceSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const globalDeviceId = String(window.MP_DEVICE_SESSION_ID || window.deviceId || "").trim();
  if (globalDeviceId) {
    return globalDeviceId;
  }

  const inputDeviceId = document.getElementById("deviceId") as HTMLInputElement | null;
  return String(inputDeviceId?.value || "").trim();
}

export function buildMercadoPagoDeviceHeaders(): HeadersInit {
  const deviceSessionId = getMercadoPagoDeviceSessionId();

  return deviceSessionId ? { "X-meli-session-id": deviceSessionId } : {};
}
