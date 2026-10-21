const prisma = require("../lib/prisma");

function registerError(message, status = 409) {
  return Object.assign(new Error(message), { status });
}
function validateMoney(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 9999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
    throw registerError("Ingresa un monto valido con hasta dos decimales.", 400);
  }
  return value;
}
// All session changes, checkouts, and linked order edits lock the same branch first.
async function lockBranch(tx, tenantId, branchId) {
  const rows = await tx.$queryRaw`SELECT id FROM branches WHERE id = ${branchId} AND tenant_id = ${tenantId} FOR UPDATE`;
  if (!rows.length) throw registerError("Sucursal no encontrada.", 404);
}
async function requireOpenSession(tx, tenantId, branchId, requestedId) {
  await lockBranch(tx, tenantId, branchId);
  const session = await tx.cashRegisterSession.findFirst({ where: { tenantId, branchId, closedAt: null } });
  if (!session || (requestedId && session.id !== requestedId)) throw registerError("Abre la caja antes de crear una venta. Actualiza la pagina si la sesion cambio.");
  return session;
}
async function summarize(tx, session) {
  if (!session) return null;
  if (session.closedAt) return { ...session, openingBalance: Number(session.openingBalance), expectedCash: Number(session.expectedCash), countedCash: Number(session.countedCash), difference: Number(session.difference) };
  const [totals] = await tx.$queryRaw`
    SELECT COUNT(*) AS saleCount, COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total ELSE 0 END), 0) AS cash
    FROM orders WHERE tenant_id = ${session.tenantId} AND cash_register_session_id = ${session.id} AND status = 'paid'
  `;
  return { ...session, openingBalance: Number(session.openingBalance), expectedCash: Number((Number(session.openingBalance) + Number(totals.cash)).toFixed(2)), saleCount: Number(totals.saleCount) };
}
async function getRegister({ tenantId, branchId }) {
  return prisma.$transaction(async (tx) => {
    await lockBranch(tx, tenantId, branchId);
    const active = await tx.cashRegisterSession.findFirst({ where: { tenantId, branchId, closedAt: null } });
    const lastClosed = await tx.cashRegisterSession.findFirst({ where: { tenantId, branchId, closedAt: { not: null } }, orderBy: { closedAt: "desc" } });
    return { active: await summarize(tx, active), lastClosed: await summarize(tx, lastClosed) };
  });
}
async function openRegister({ tenantId, branchId, userId, openingBalance }) {
  validateMoney(openingBalance);
  return prisma.$transaction(async (tx) => {
    await lockBranch(tx, tenantId, branchId);
    if (await tx.cashRegisterSession.findFirst({ where: { tenantId, branchId, closedAt: null } })) throw registerError("La caja ya esta abierta.");
    return tx.cashRegisterSession.create({ data: { tenantId, branchId, openedBy: userId, openingBalance, activeBranchId: branchId } });
  });
}
async function closeRegister({ tenantId, branchId, userId, sessionId, countedCash }) {
  validateMoney(countedCash);
  return prisma.$transaction(async (tx) => {
    const session = await requireOpenSession(tx, tenantId, branchId, sessionId);
    const summary = await summarize(tx, session);
    return tx.cashRegisterSession.update({ where: { id: session.id }, data: {
      closedAt: new Date(), closedBy: userId, activeBranchId: null, countedCash,
      expectedCash: summary.expectedCash, difference: Number((countedCash - summary.expectedCash).toFixed(2)), saleCount: summary.saleCount,
    } });
  });
}
async function lockOrderRegister(tx, tenantId, orderId) {
  const rows = await tx.$queryRaw`SELECT branch_id AS branchId FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId}`;
  if (!rows.length) return;
  await lockBranch(tx, tenantId, rows[0].branchId);
  const linked = await tx.$queryRaw`SELECT s.closed_at AS closedAt FROM orders o JOIN cash_register_sessions s ON s.id = o.cash_register_session_id WHERE o.id = ${orderId} AND o.tenant_id = ${tenantId} FOR UPDATE`;
  if (linked[0]?.closedAt) throw registerError("La caja de esta orden ya fue cerrada. No se puede modificar ni cancelar la orden.");
}
module.exports = { validateMoney, getRegister, openRegister, closeRegister, requireOpenSession, lockOrderRegister };
