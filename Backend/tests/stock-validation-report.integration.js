require("dotenv").config();
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const prisma = require("../lib/prisma");
const { applyFullStockValidation, listStockValidationReports } = require("../services/stock-validation-report.service");
test("full count zeroes only omitted eligible items, persists report and movements, and supports safe retries", async () => {
  const transaction = prisma.$transaction.bind(prisma);
  const rollback = new Error("rollback fixtures");
  try {
    await assert.rejects(transaction(async (tx) => {
      prisma.$transaction = (callback) => callback(tx);
      const tenant = await tx.tenant.create({ data: { legalName: "Full stock count test" } });
      const user = await tx.user.create({ data: { tenantId: tenant.id, fullName: "Test", phoneNumber: randomUUID(), passwordHash: "test-only" } });
      const branch = await tx.branch.create({ data: { tenantId: tenant.id, name: "Count" } });
      const other = await tx.branch.create({ data: { tenantId: tenant.id, name: "Other" } });
      const counted = await tx.product.create({ data: { tenantId: tenant.id, name: "Counted" } });
      const missing = await tx.product.create({ data: { tenantId: tenant.id, name: "Missing" } });
      const empty = await tx.product.create({ data: { tenantId: tenant.id, name: "No inventory" } });
      const inactive = await tx.product.create({ data: { tenantId: tenant.id, name: "Inactive", isActive: false } });
      const service = await tx.product.create({ data: { tenantId: tenant.id, name: "Service", unit: "service" } });
      for (const product of [counted, missing, inactive, service]) await tx.inventory.create({ data: { tenantId: tenant.id, branchId: branch.id, productId: product.id, qtyOnHand: 10, qtyReserved: 2, reorderLevel: 3 } });
      await tx.inventory.create({ data: { tenantId: tenant.id, branchId: other.id, productId: missing.id, qtyOnHand: 20 } });
      const session = await tx.stockValidationSession.create({ data: { tenantId: tenant.id, branchId: branch.id, periodKey: "2026-10", createdBy: user.id } });
      const context = { tenantId: tenant.id, sessionId: session.id, createdBy: user.id, items: [{ productId: counted.id, realQty: 7 }], scopeProductIds: [counted.id, missing.id, empty.id] };
      await assert.rejects(applyFullStockValidation({ ...context, tenantId: randomUUID() }), (error) => error.statusCode === 404);
      await assert.rejects(applyFullStockValidation({ ...context, scopeProductIds: [counted.id] }), (error) => error.statusCode === 409);
      assert.equal(Number((await tx.inventory.findFirst({ where: { branchId: branch.id, productId: missing.id } })).qtyOnHand), 10);
      await assert.rejects(applyFullStockValidation({ ...context, items: [{ productId: counted.id, realQty: -1 }] }), /Conteo invalido/);
      const report = await applyFullStockValidation(context);
      assert.equal(report.snapshot.items.filter((item) => item.omitted).length, 2);
      const omitted = report.snapshot.items.find((item) => item.productId === missing.id);
      assert.equal(omitted.previousQty, 10); assert.equal(omitted.realQty, 0); assert.equal(omitted.differenceQty, -10);
      for (const [product, expected] of [[counted, 7], [missing, 0], [empty, 0], [inactive, 10], [service, 10]]) {
        assert.equal(Number((await tx.inventory.findFirst({ where: { branchId: branch.id, productId: product.id } })).qtyOnHand), expected);
      }
      const missingInventory = await tx.inventory.findFirst({ where: { branchId: branch.id, productId: missing.id } });
      assert.equal(Number(missingInventory.qtyReserved), 2); assert.equal(Number(missingInventory.reorderLevel), 3);
      assert.equal(Number((await tx.inventory.findFirst({ where: { branchId: other.id, productId: missing.id } })).qtyOnHand), 20);
      assert.equal((await tx.stockValidationSession.findUnique({ where: { id: session.id } })).status, "completed");
      assert.equal(await tx.inventoryMovement.count({ where: { referenceId: session.id } }), 2);
      assert.equal((await applyFullStockValidation(context)).id, report.id);
      assert.equal(await tx.inventoryMovement.count({ where: { referenceId: session.id } }), 2);
      assert.equal(await tx.stockValidationReport.count({ where: { sessionId: session.id } }), 1);
      const listed = await listStockValidationReports({ tenantId: tenant.id });
      assert.equal(listed.total, 1);
      assert.equal(listed.reports[0].id, report.id);
      assert.equal((await listStockValidationReports({ tenantId: randomUUID() })).total, 0);
      assert.deepEqual((await listStockValidationReports({ tenantId: tenant.id, page: 2 })).reports, []);
      await assert.rejects(listStockValidationReports({ tenantId: tenant.id, page: -1 }), (error) => error.statusCode === 400);
      throw rollback;
    }, { timeout: 30000 }), (error) => error === rollback);
  } finally { prisma.$transaction = transaction; await prisma.$disconnect(); }
});
