export type ServerTime = { serverTime: string; epochMilliseconds: number; timeZone: string; date: string };
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";
let anchor: { epoch: number; monotonic: number; timeZone: string } | null = null;
let pending: Promise<void> | null = null;
export async function fetchServerTime(): Promise<ServerTime> {
  const response = await fetch(`${API_BASE_URL}/api/time`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("No se pudo obtener la hora del servidor.");
  const data = await response.json() as ServerTime;
  if (!Number.isFinite(data.epochMilliseconds) || !data.serverTime || !data.timeZone || !Number.isFinite(Date.parse(data.serverTime))) throw new Error("Hora del servidor invalida.");
  new Intl.DateTimeFormat("en", { timeZone: data.timeZone }).format(new Date(data.epochMilliseconds));
  return data;
}
export function synchronizeServerTime(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    const start = performance.now();
    const data = await fetchServerTime();
    const end = performance.now();
    anchor = { epoch: data.epochMilliseconds + (end - start) / 2, monotonic: end, timeZone: data.timeZone };
  })().finally(() => { pending = null; });
  return pending;
}
export function serverNow(): Date {
  if (!anchor) throw new Error("La hora del servidor aun no esta sincronizada.");
  return new Date(anchor.epoch + Math.max(0, performance.now() - anchor.monotonic));
}
export function serverTimeZone(): string {
  if (!anchor) throw new Error("La hora del servidor aun no esta sincronizada.");
  return anchor.timeZone;
}
export function serverDateKey(value: Date | string = serverNow()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: serverTimeZone(), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function serverDateTimeInput(value: Date | string = serverNow()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: serverTimeZone(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
// Calendar arithmetic only; UTC avoids the browser's timezone changing the calendar day.
export function serverCalendarDate(): Date { return new Date(`${serverDateKey()}T00:00:00Z`); }

export function serverDateTimeToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error("Fecha y hora invalida.");
  const [, year, month, day, hour, minute, second = "0"] = match;
  const target = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  let candidate = target;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: serverTimeZone(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const fields = (epoch: number) => {
    const parts = formatter.formatToParts(new Date(epoch));
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
    return [part("year"), part("month"), part("day"), part("hour"), part("minute"), part("second")];
  };
  for (let i = 0; i < 3; i += 1) {
    const [y, m, d, h, min, sec] = fields(candidate);
    candidate += target - Date.UTC(y, m - 1, d, h, min, sec);
  }
  const expected = [+year, +month, +day, +hour, +minute, +second];
  if (fields(candidate).some((part, index) => part !== expected[index])) throw new Error("La fecha y hora no existe en la zona horaria del servidor.");
  return new Date(candidate).toISOString();
}
