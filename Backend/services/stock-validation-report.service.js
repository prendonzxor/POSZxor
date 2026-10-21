const prisma = require("../lib/prisma");
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const qty = (value) => Math.round(Number(value) * 1000) / 1000;
async function getStockValidationReport({ tenantId, sessionId }) {
  return prisma.stockValidationReport.findFirst({ where: { tenantId, sessionId } });
}
async function listStockValidationReports({ tenantId, page = 1 }) {
  if (!Number.isInteger(page) || page < 1) throw fail("Pagina invalida.");
  return prisma.$transaction(async (tx) => {
    const where = { tenantId };
    const reports = await tx.stockValidationReport.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 5, take: 5 });
    const total = await tx.stockValidationReport.count({ where });
    return { reports, total, page, pageSize: 5 };
  });
}
async function applyFullStockValidation({ tenantId, sessionId, createdBy, items, scopeProductIds }) {
  if (!Array.isArray(items) || !items.length || !Array.isArray(scopeProductIds)) throw fail("Confirma los productos del conteo y su alcance.");
  const counts = new Map();
  for (const item of items) {
    if (!item || typeof item.productId !== "string" || counts.has(item.productId) || typeof item.realQty !== "number" || !Number.isFinite(item.realQty) || item.realQty < 0 || item.realQty > 999999999.999 || Math.abs(item.realQty * 1000 - Math.round(item.realQty * 1000)) > 0.00001) throw fail("Conteo invalido o producto duplicado.");
    counts.set(item.productId, qty(item.realQty));
  }
  return prisma.$transaction(async (tx) => {
    const initial = await tx.stockValidationSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!initial) throw fail("Validacion no encontrada.", 404);
    await tx.$queryRaw`SELECT id FROM branches WHERE id = ${initial.branchId} AND tenant_id = ${tenantId} FOR UPDATE`;
    const [session] = await tx.$queryRaw`SELECT status FROM stock_validation_sessions WHERE id = ${sessionId} AND tenant_id = ${tenantId} FOR UPDATE`;
    const existing = await tx.stockValidationReport.findFirst({ where: { tenantId, sessionId } });
    if (existing) return existing; // Safe retry after a successful commit whose response was lost.
    if (session.status !== "draft") throw fail("La validacion ya esta completada.", 409);
    const products = await tx.$queryRaw`
      SELECT p.id, p.name, p.sku, p.barcode, COALESCE(i.qty_on_hand, 0) AS previousQty, COALESCE(i.qty_reserved, 0) AS reservedQty
      FROM products p LEFT JOIN inventory i ON i.product_id = p.id AND i.tenant_id = p.tenant_id AND i.branch_id = ${initial.branchId}
      WHERE p.tenant_id = ${tenantId} AND p.is_active = TRUE AND p.unit <> 'service'
      ORDER BY p.id FOR UPDATE
    `;
    const scope = new Set(scopeProductIds);
    const available = new Set(products.map((product) => product.id));
    if (scope.size !== scopeProductIds.length || scope.size !== available.size || products.some((product) => !scope.has(product.id)) || [...counts.keys()].some((id) => !available.has(id))) {
      throw fail("El catalogo cambio. Actualiza la pagina y revisa los productos antes de confirmar.", 409);
    }
    const branch = await tx.branch.findFirst({ where: { id: initial.branchId, tenantId }, select: { name: true } });
    const now = new Date();
    const snapshotItems = [];
    for (const product of products) {
      const realQty = counts.get(product.id) ?? 0;
      const previousQty = qty(product.previousQty);
      const differenceQty = qty(realQty - previousQty);
      const omitted = !counts.has(product.id);
      await tx.stockValidationItem.upsert({
        where: { sessionId_productId: { sessionId, productId: product.id } },
        create: { tenantId, branchId: initial.branchId, sessionId, productId: product.id, virtualQty: previousQty, reservedQty: product.reservedQty, realQty, differenceQty, status: differenceQty === 0 ? "matched" : differenceQty > 0 ? "surplus" : "shortage", adjustedAt: now, adjustedBy: createdBy },
        update: { virtualQty: previousQty, reservedQty: product.reservedQty, realQty, differenceQty, status: differenceQty === 0 ? "matched" : differenceQty > 0 ? "surplus" : "shortage", adjustedAt: now, adjustedBy: createdBy },
      });
      await tx.inventory.upsert({ where: { tenantId_branchId_productId: { tenantId, branchId: initial.branchId, productId: product.id } },
        create: { tenantId, branchId: initial.branchId, productId: product.id, qtyOnHand: realQty }, update: { qtyOnHand: realQty } });
      if (differenceQty !== 0) await tx.inventoryMovement.create({ data: {
        tenantId, branchId: initial.branchId, productId: product.id, type: "adjustment", qtyDelta: differenceQty,
        referenceType: "stock_validation", referenceId: sessionId, note: omitted ? "Producto fuera del conteo: stock a cero" : "Conteo fisico aplicado", createdBy,
      } });
      snapshotItems.push({ productId: product.id, name: product.name, sku: product.sku || "", barcode: product.barcode || "", previousQty, realQty, differenceQty, omitted });
    }
    await tx.stockValidationSession.update({ where: { id: sessionId }, data: { status: "completed", completedAt: now } });
    return tx.stockValidationReport.create({ data: { tenantId, branchId: initial.branchId, sessionId, createdBy,
      snapshot: { branchName: branch.name, periodKey: initial.periodKey, items: snapshotItems } } });
  }, { timeout: 30000 });
}
module.exports = { applyFullStockValidation, getStockValidationReport, listStockValidationReports };
