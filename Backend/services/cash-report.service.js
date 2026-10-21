const prisma = require("../lib/prisma");
const money = (value) => Math.round(Number(value) * 100) / 100;
function dateKey(value, timezone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
function validateRange(from, to) {
  const valid = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(from) || !valid(to) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 89) {
    throw Object.assign(new Error("Selecciona un periodo valido de hasta 90 dias."), { status: 400 });
  }
}
function buildCashReport({ sessions, orders, from, to, timezone }) {
  const daily = [];
  const movements = [];
  const ordersBySession = new Map();
  for (const order of orders) {
    if (!ordersBySession.has(order.sessionId)) ordersBySession.set(order.sessionId, []);
    ordersBySession.get(order.sessionId).push(order);
  }
  for (const session of sessions) {
    const openedDay = dateKey(session.openedAt, timezone);
    const closedDay = session.closedAt ? dateKey(session.closedAt, timezone) : null;
    const sessionOrders = ordersBySession.get(session.id) || [];
    const salesByDay = new Map();
    for (const order of sessionOrders) {
      if (order.status !== "paid") continue;
      const day = dateKey(order.createdAt, timezone);
      const totals = salesByDay.get(day) || { cash: 0, count: 0 };
      totals.cash += Number(order.total); totals.count += 1;
      salesByDay.set(day, totals);
    }
    const inRange = (day) => day >= from && day <= to;
    const movement = (id, at, type, amount, reference, status) => {
      if (inRange(dateKey(at, timezone))) movements.push({ id, sessionId: session.id, branchName: session.branch.name, at, type, amount, reference, status });
    };
    movement(`open:${session.id}`, session.openedAt, "opening", Number(session.openingBalance), session.opener.fullName, "open");
    for (const order of sessionOrders) {
      // Only currently paid cash orders contribute to register reconciliation.
      movement(`sale:${order.id}`, order.createdAt, "sale", order.status === "paid" ? Number(order.total) : 0, order.numOrder || order.id, order.status);
    }
    const lastDay = closedDay || dateKey(new Date(), timezone);
    let balance = Number(session.openingBalance);
    for (const [day, totals] of salesByDay) if (day < from) balance += totals.cash;
    for (const day = new Date(`${openedDay > from ? openedDay : from}T00:00:00Z`); day.toISOString().slice(0, 10) <= to; day.setUTCDate(day.getUTCDate() + 1)) {
      const key = day.toISOString().slice(0, 10);
      if (key > lastDay) break;
      const totals = salesByDay.get(key) || { cash: 0, count: 0 };
      const cashSales = money(totals.cash);
      const openingCash = balance;
      balance = money(balance + cashSales);
      if (!inRange(key)) continue;
      const closedToday = closedDay === key;
      daily.push({ date: key, sessionId: session.id, branchName: session.branch.name, openedAt: session.openedAt,
        openingCash: money(openingCash), cashSales, cashOrders: totals.count,
        expectedCash: closedToday ? Number(session.expectedCash) : balance,
        countedCash: closedToday ? Number(session.countedCash) : null,
        difference: closedToday ? Number(session.difference) : null,
        status: closedToday ? "closed" : "open",
      });
    }
    if (session.closedAt) movement(`close:${session.id}`, session.closedAt, "closing", Number(session.countedCash), session.closer?.fullName || "", "closed");
  }
  daily.sort((a, b) => b.date.localeCompare(a.date) || a.branchName.localeCompare(b.branchName) || String(a.openedAt).localeCompare(String(b.openedAt)));
  movements.sort((a, b) => new Date(b.at) - new Date(a.at) || a.id.localeCompare(b.id));
  return { daily, movements };
}
async function getCashReport({ tenantId, branchId, from, to, page = 1 }) {
  validateRange(from, to);
  if (!Number.isInteger(page) || page < 1) throw Object.assign(new Error("Pagina invalida."), { status: 400 });
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    if (branchId && !await tx.branch.findFirst({ where: { id: branchId, tenantId } })) throw Object.assign(new Error("Sucursal no encontrada."), { status: 404 });
    const timezone = tenant?.timezone || "America/Mexico_City";
    // Broad UTC boundaries accommodate every IANA offset; local dates are filtered below.
    const start = new Date(Date.parse(from) - 86400000);
    const end = new Date(Date.parse(to) + 2 * 86400000);
    const sessions = await tx.cashRegisterSession.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}), openedAt: { lt: end }, OR: [{ closedAt: null }, { closedAt: { gte: start } }] },
      include: { branch: { select: { name: true } }, opener: { select: { fullName: true } }, closer: { select: { fullName: true } } },
    });
    const orders = await tx.$queryRaw`
      SELECT o.id, o.num_order AS numOrder, o.cash_register_session_id AS sessionId, o.total, o.status, o.created_at AS createdAt
      FROM orders o JOIN cash_register_sessions s ON s.id = o.cash_register_session_id AND s.tenant_id = o.tenant_id
      WHERE o.tenant_id = ${tenantId} AND (${branchId || null} IS NULL OR o.branch_id = ${branchId || null})
        AND o.payment_type = 'cash' AND o.created_at < ${end}
        AND (s.closed_at IS NULL OR s.closed_at >= ${start})
    `;
    const result = buildCashReport({ sessions, orders, from, to, timezone });
    const totalMovements = result.movements.length;
    return { daily: result.daily, movements: result.movements.slice((page - 1) * 25, page * 25), totalMovements, page, pageSize: 25, timezone };
  });
}
module.exports = { getCashReport, buildCashReport, validateRange };
