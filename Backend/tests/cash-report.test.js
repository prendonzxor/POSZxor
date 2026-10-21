const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildCashReport, validateRange } = require("../services/cash-report.service");
const session = (overrides = {}) => ({ id: "session", openedAt: "2026-10-19T05:30:00Z", closedAt: null, openingBalance: 100, branch: { name: "Centro" }, opener: { fullName: "Ana" }, ...overrides });
const order = (overrides = {}) => ({ id: "order", sessionId: "session", total: 25.5, status: "paid", createdAt: "2026-10-19T06:30:00Z", ...overrides });
const report = (sessions, orders, overrides = {}) => buildCashReport({ sessions, orders, from: "2026-10-18", to: "2026-10-20", timezone: "America/Mexico_City", ...overrides });
test("business timezone splits overnight sessions and carries cash across days", () => {
  const result = report([session()], [order()]);
  assert.deepEqual(result.daily.map(({ date, openingCash, cashSales, expectedCash }) => ({ date, openingCash, cashSales, expectedCash })), [
    { date: "2026-10-20", openingCash: 125.5, cashSales: 0, expectedCash: 125.5 },
    { date: "2026-10-19", openingCash: 100, cashSales: 25.5, expectedCash: 125.5 },
    { date: "2026-10-18", openingCash: 100, cashSales: 0, expectedCash: 100 },
  ]);
  const narrowed = report([session()], [order()], { from: "2026-10-20" });
  assert.equal(narrowed.daily[0].openingCash, 125.5);
  assert.equal(narrowed.movements.length, 0);
});
test("cancelled sales have zero net effect and closing uses stored reconciliation", () => {
  const result = report([session({ closedAt: "2026-10-20T02:00:00Z", expectedCash: 125.5, countedCash: 120, difference: -5.5, closer: { fullName: "Luis" } })], [order(), order({ id: "cancelled", status: "cancelled", total: 50 })]);
  assert.equal(result.daily.length, 2);
  assert.equal(result.daily[0].cashSales, 25.5);
  assert.equal(result.daily[0].difference, -5.5);
  assert.equal(result.daily[0].countedCash, 120);
  assert.equal(result.movements.find((item) => item.status === "cancelled").amount, 0);
  assert.equal(result.movements[0].type, "closing");
});
test("multiple sessions and branches keep their balances separate", () => {
  const result = report([session(), session({ id: "second", openingBalance: 200, branch: { name: "Norte" } })], [order()]);
  assert.equal(result.daily.length, 6);
  assert.equal(result.daily.find((row) => row.sessionId === "second").expectedCash, 200);
  assert.deepEqual(report([], []), { daily: [], movements: [] });
});
test("date ranges reject impossible dates, reversed periods, and more than 90 days", () => {
  for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-10-20", "2026-10-19"], ["2026-01-01", "2026-12-31"], [undefined, "2026-10-20"]]) assert.throws(() => validateRange(from, to), (error) => error.status === 400);
  assert.doesNotThrow(() => validateRange("2026-10-20", "2026-10-20"));
});
