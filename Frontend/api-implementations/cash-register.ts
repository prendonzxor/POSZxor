export type RegisterSession = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  saleCount: number;
};
export type RegisterState = { active: RegisterSession | null; lastClosed: RegisterSession | null };
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
async function request<T>(path: string, body?: object): Promise<T> {
  const token = localStorage.getItem("authToken");
  if (!token) throw new Error("No se encontro token de autenticacion");
  const response = await fetch(`${API_BASE_URL}/api/cash-register${path}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudo consultar la caja.");
  return data;
}
export const getCashRegister = (branchId: string) => request<RegisterState>(`?branchId=${encodeURIComponent(branchId)}`);
export const openCashRegister = (branchId: string, openingBalance: number) => request("/open", { branchId, openingBalance });
export const closeCashRegister = (branchId: string, sessionId: string, countedCash: number) => request(`/${encodeURIComponent(sessionId)}/close`, { branchId, countedCash });

export type CashReport = {
  timezone: string;
  daily: { date: string; sessionId: string; branchName: string; openedAt: string; openingCash: number; cashSales: number; cashOrders: number; expectedCash: number; countedCash: number | null; difference: number | null; status: string }[];
  movements: { id: string; sessionId: string; branchName: string; at: string; type: "opening" | "sale" | "closing"; amount: number; reference: string; status: string }[];
  page: number; pageSize: number; totalMovements: number;
};
export const getCashReport = (params: { from: string; to: string; page: number; branchId?: string }) =>
  request<CashReport>(`/report?${new URLSearchParams({ from: params.from, to: params.to, page: String(params.page), ...(params.branchId ? { branchId: params.branchId } : {}) })}`);
