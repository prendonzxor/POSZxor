const { test } = require("node:test");
const assert = require("node:assert/strict");
const prismaPath = require.resolve("../lib/prisma");
let current;
const tx = {
  async $queryRaw(strings) {
    const sql = strings.join("?");
    if (sql.includes("FROM branches")) return [{ id: "branch" }];
    if (sql.includes("COUNT(*)")) return [{ saleCount: 2n, cash: "25.50" }];
    if (sql.includes("SELECT branch_id")) return [{ branchId: "branch" }];
    if (sql.includes("JOIN cash_register_sessions")) return current?.closedAt ? [{ closedAt: current.closedAt }] : [];
    throw new Error(`Unexpected query: ${sql}`);
  },
  cashRegisterSession: {
    async findFirst({ where }) { return where.closedAt === null && !current?.closedAt ? current : null; },
    async create({ data }) { current = { ...data, id: "session", openedAt: new Date(), closedAt: null }; return current; },
    async update({ data }) { current = { ...current, ...data }; return current; },
  },
};
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { $transaction: (callback) => callback(tx) } };
const service = require("../services/cash-register.service");
const context = { tenantId: "tenant", branchId: "branch", userId: 1 };

test("money validation rejects missing, negative, nonfinite, oversized and fractional-cent amounts", () => {
  for (const value of [undefined, null, "10", -1, NaN, Infinity, 0.001, 10000000000]) assert.throws(() => service.validateMoney(value));
  for (const value of [0, 0.29, 100.25]) assert.equal(service.validateMoney(value), value);
});
test("session lifecycle rejects duplicate opens, stale checkout IDs and closed-session edits", async () => {
  current = null;
  await assert.rejects(service.requireOpenSession(tx, "tenant", "branch"), /Abre la caja/);
  const opened = await service.openRegister({ ...context, openingBalance: 100 });
  assert.equal(opened.openedBy, 1);
  await assert.rejects(service.openRegister({ ...context, openingBalance: 0 }), /ya esta abierta/);
  await assert.rejects(service.requireOpenSession(tx, "tenant", "branch", "stale"), /Abre la caja/);
  const state = await service.getRegister(context);
  assert.equal(state.active.expectedCash, 125.5);
  assert.equal(state.active.saleCount, 2);
  const closed = await service.closeRegister({ ...context, sessionId: "session", countedCash: 120 });
  assert.equal(closed.expectedCash, 125.5);
  assert.equal(closed.difference, -5.5);
  assert.equal(closed.activeBranchId, null);
  assert.equal(closed.closedBy, 1);
  await assert.rejects(service.lockOrderRegister(tx, "tenant", "order"), /ya fue cerrada/);
  await assert.rejects(service.closeRegister({ ...context, sessionId: "session", countedCash: 120 }), /Abre la caja/);
});
test("branch lookup rejects another tenant or missing branch before accessing sessions", async () => {
  const foreignTx = { $queryRaw: async () => [] };
  await assert.rejects(service.requireOpenSession(foreignTx, "other", "branch"), (error) => error.status === 404);
});
