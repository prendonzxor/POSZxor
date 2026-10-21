require("dotenv").config();
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const prisma = require("../lib/prisma");
const { createNewStockValidationSession } = require("../services/stock-validation.service");
test("new validation retains previous counts and creates an empty session in the same month", async () => {
  const transaction = prisma.$transaction.bind(prisma);
  const rollback = new Error("rollback fixtures");
  try {
    await assert.rejects(transaction(async (tx) => {
      prisma.$transaction = (callback) => callback(tx);
      const tenant = await tx.tenant.create({ data: { legalName: "Stock validation integration test" } });
      const user = await tx.user.create({ data: { tenantId: tenant.id, fullName: "Test", phoneNumber: randomUUID(), passwordHash: "test-only" } });
      const branch = await tx.branch.create({ data: { tenantId: tenant.id, name: "Test" } });
      const product = await tx.product.create({ data: { tenantId: tenant.id, name: "Test" } });
      const previous = await tx.stockValidationSession.create({ data: { tenantId: tenant.id, branchId: branch.id, periodKey: "2026-10", createdBy: user.id } });
      await tx.stockValidationItem.create({ data: { tenantId: tenant.id, branchId: branch.id, sessionId: previous.id, productId: product.id, virtualQty: 5, realQty: 7 } });
      const context = { tenantId: tenant.id, branchId: branch.id, periodKey: "2026-10", createdBy: user.id };
      const result = await createNewStockValidationSession(context);
      assert.notEqual(result.session.id, previous.id);
      assert.equal(result.session.status, "draft");
      assert.deepEqual(result.items, []);
      assert.equal((await tx.stockValidationSession.findUnique({ where: { id: previous.id } })).status, "completed");
      assert.equal(Number((await tx.stockValidationItem.findFirst({ where: { sessionId: previous.id } })).realQty), 7);
      assert.equal(await tx.stockValidationItem.count({ where: { sessionId: result.session.id } }), 0);
      assert.equal((await tx.stockValidationSession.findFirst({ where: { tenantId: tenant.id, branchId: branch.id }, orderBy: { createdAt: "desc" } })).id, result.session.id);
      const second = await createNewStockValidationSession(context);
      assert.notEqual(second.session.id, result.session.id);
      assert.equal(await tx.stockValidationSession.count({ where: { tenantId: tenant.id, status: "draft" } }), 1);
      await assert.rejects(createNewStockValidationSession({ ...context, tenantId: randomUUID() }), (error) => error.statusCode === 404);
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
  } finally { prisma.$transaction = transaction; await prisma.$disconnect(); }
});
