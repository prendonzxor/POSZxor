// Run with: node --test tests/cash-register.integration.js (requires migrated MySQL).
require("dotenv").config();
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const prisma = require("../lib/prisma");
const register = require("../services/cash-register.service");
const orders = require("../services/orders.service");
const { getCashReport } = require("../services/cash-report.service");

test("MySQL: checkout links to register; cancellation reconciles; closed session rejects sales and edits", async () => {
  const transaction = prisma.$transaction.bind(prisma);
  const query = prisma.$queryRaw;
  const rollback = new Error("rollback integration fixtures");
  try {
    await assert.rejects(transaction(async (tx) => {
      // Route service transactions and detail queries through this rollback-only transaction.
      prisma.$transaction = (callback) => callback(tx);
      prisma.$queryRaw = tx.$queryRaw.bind(tx);
      const tenant = await tx.tenant.create({ data: { legalName: "Register integration test" } });
      const user = await tx.user.create({ data: { tenantId: tenant.id, fullName: "Test", phoneNumber: randomUUID(), passwordHash: "test-only" } });
      const branch = await tx.branch.create({ data: { tenantId: tenant.id, name: "Test" } });
      const product = await tx.product.create({ data: { tenantId: tenant.id, name: "Test", price: 25.5 } });
      await tx.inventory.create({ data: { tenantId: tenant.id, branchId: branch.id, productId: product.id, qtyOnHand: 10 } });
      const context = { tenantId: tenant.id, branchId: branch.id, userId: user.id };
      const checkout = { ...context, createdBy: user.id, orderType: "pos", paymentType: "cash", items: [{ productId: product.id, qty: 1 }] };
      await assert.rejects(orders.createCheckoutOrder(checkout), /Abre la caja/);
      const session = await register.openRegister({ ...context, openingBalance: 100 });
      await assert.rejects(register.openRegister({ ...context, openingBalance: 0 }), /ya esta abierta/);
      const weighted = await tx.product.create({ data: { tenantId: tenant.id, name: "Sugar", unit: "kg", price: 40 } });
      await tx.inventory.create({ data: { tenantId: tenant.id, branchId: branch.id, productId: weighted.id, qtyOnHand: 10 } });
      await assert.rejects(orders.createCheckoutOrder({ ...checkout, items: [{ productId: product.id, qty: 0.5 }] }), (error) => error.status === 400);
      const halfKilo = await orders.createCheckoutOrder({ ...checkout, items: [{ productId: weighted.id, qty: 0.5 }] });
      assert.equal(halfKilo.total, 20);
      assert.equal(Number((await tx.inventory.findFirst({ where: { branchId: branch.id, productId: weighted.id } })).qtyOnHand), 9.5);
      await orders.cancelOrderById({ tenantId: tenant.id, orderId: halfKilo.id, cancelledBy: user.id });
      assert.equal(Number((await tx.inventory.findFirst({ where: { branchId: branch.id, productId: weighted.id } })).qtyOnHand), 10);
      await assert.rejects(orders.createCheckoutOrder({ ...checkout, items: [{ productId: weighted.id, qty: 0.0001 }] }), (error) => error.status === 400);
      const sale = await orders.createCheckoutOrder({ ...checkout, cashRegisterSessionId: session.id });
      const [linked] = await tx.$queryRaw`SELECT cash_register_session_id AS sessionId FROM orders WHERE id = ${sale.id}`;
      assert.equal(linked.sessionId, session.id);
      assert.equal((await register.getRegister(context)).active.expectedCash, 125.5);
      await orders.cancelOrderById({ tenantId: tenant.id, orderId: sale.id, cancelledBy: user.id });
      assert.equal((await register.getRegister(context)).active.expectedCash, 100);
      const second = await orders.createCheckoutOrder(checkout);
      const closed = await register.closeRegister({ ...context, sessionId: session.id, countedCash: 120 });
      assert.equal(Number(closed.expectedCash), 125.5);
      assert.equal(Number(closed.difference), -5.5);
      await assert.rejects(orders.cancelOrderById({ tenantId: tenant.id, orderId: second.id, cancelledBy: user.id }), /ya fue cerrada/);
      await assert.rejects(orders.updateOrderById({ tenantId: tenant.id, orderId: second.id, paymentType: "card" }), /ya fue cerrada/);
      await assert.rejects(orders.createCheckoutOrder(checkout), /Abre la caja/);
      assert.equal((await register.getRegister(context)).lastClosed.expectedCash, 125.5);
      const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const to = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const cashReport = await getCashReport({ ...context, from, to });
      assert.equal(cashReport.totalMovements, 5);
      assert.equal(cashReport.daily.at(-1).cashSales, 25.5);
      assert.equal(cashReport.daily[0].expectedCash, 125.5);
      assert.equal(cashReport.daily[0].countedCash, 120);
      assert.equal(cashReport.movements.find((row) => row.status === "cancelled").amount, 0);
      const otherTenant = await getCashReport({ tenantId: randomUUID(), from, to });
      assert.deepEqual(otherTenant.daily, []);
      assert.equal(otherTenant.totalMovements, 0);
      await assert.rejects(getCashReport({ tenantId: randomUUID(), branchId: branch.id, from, to }), (error) => error.status === 404);
      const secondPage = await getCashReport({ ...context, from, to, page: 2 });
      assert.equal(secondPage.totalMovements, 5);
      assert.deepEqual(secondPage.movements, []);
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
  } finally {
    prisma.$transaction = transaction;
    prisma.$queryRaw = query;
    await prisma.$disconnect();
  }
});
