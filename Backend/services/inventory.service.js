const { randomUUID } = require("crypto");
const prisma = require("../lib/prisma");

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round3(value) {
  return Math.round((toNumber(value, 0) + Number.EPSILON) * 1000) / 1000;
}

async function getInventory({ tenantId, branchId }) {
  const where = {
    tenantId,
  };

  if (branchId) {
    where.branchId = branchId;
  }

  return prisma.inventory.findMany({
    where,
    orderBy: [
      { branchId: "asc" },
      { productId: "asc" },
    ],
  });
}

async function getInventoryByTenantBranchAndProduct({ tenantId, branchId, productId }) {
  return prisma.inventory.findUnique({
    where: {
      tenantId_branchId_productId: {
        tenantId,
        branchId,
        productId,
      },
    },
  });
}

async function createInventory({ tenantId, branchId, productId, qtyOnHand = 0, reorderLevel = 0 }) {
  return prisma.inventory.create({
    data: {
      tenantId,
      branchId,
      productId,
      qtyOnHand,
      reorderLevel,
    },
  });
}

async function updateInventory({ tenantId, branchId, productId, qtyOnHand, reorderLevel }) {
  const data = {};

  if (typeof qtyOnHand === "number") {
    data.qtyOnHand = qtyOnHand;
  }

  if (typeof reorderLevel === "number") {
    data.reorderLevel = reorderLevel;
  }

  return prisma.inventory.update({
    where: {
      tenantId_branchId_productId: {
        tenantId,
        branchId,
        productId,
      },
    },
    data,
  });
}

async function createBulkInventoryEntry({
  tenantId,
  branchId,
  type = "purchase",
  note = null,
  items = [],
  createdBy = null,
}) {
  const referenceId = randomUUID();
  const normalizedItems = items
    .map((item) => ({
      productId: String(item.productId || "").trim(),
      qtyDelta: round3(item.qtyDelta),
      unitCost: item.unitCost === undefined || item.unitCost === null || item.unitCost === ""
        ? null
        : toNumber(item.unitCost, null),
    }))
    .filter((item) => item.productId && item.qtyDelta > 0);

  if (!normalizedItems.length) {
    throw new Error("items debe tener al menos un producto con qtyDelta mayor a 0");
  }

  await prisma.$transaction(async (tx) => {
    const [branch] = await tx.$queryRaw`
      SELECT id
      FROM branches
      WHERE tenant_id = ${tenantId}
        AND id = ${branchId}
        AND is_active = TRUE
      LIMIT 1
    `;

    if (!branch) {
      throw new Error("sucursal invalida o inactiva");
    }

    for (const item of normalizedItems) {
      const [product] = await tx.$queryRaw`
        SELECT id, name
        FROM products
        WHERE tenant_id = ${tenantId}
          AND id = ${item.productId}
          AND is_active = TRUE
          AND unit <> 'service'
        LIMIT 1
      `;

      if (!product) {
        throw new Error(`producto invalido o no inventariable: ${item.productId}`);
      }

      await tx.$executeRaw`
        INSERT INTO inventory (
          tenant_id, branch_id, product_id, qty_on_hand, qty_reserved, reorder_level, updated_at
        )
        VALUES (
          ${tenantId}, ${branchId}, ${item.productId}, ${item.qtyDelta}, 0, 0, CURRENT_TIMESTAMP(3)
        )
        ON DUPLICATE KEY UPDATE
          qty_on_hand = qty_on_hand + VALUES(qty_on_hand),
          updated_at = CURRENT_TIMESTAMP(3)
      `;

      await tx.$executeRaw`
        INSERT INTO inventory_movements (
          id, tenant_id, branch_id, product_id, type, qty_delta,
          unit_cost, reference_type, reference_id, note, created_by
        )
        VALUES (
          ${randomUUID()}, ${tenantId}, ${branchId}, ${item.productId}, ${type}, ${item.qtyDelta},
          ${item.unitCost}, 'bulk_entry', ${referenceId}, ${note}, ${createdBy}
        )
      `;
    }
  });

  const inventory = await getInventory({ tenantId, branchId });
  return {
    referenceId,
    inventory,
    itemCount: normalizedItems.length,
    totalQty: normalizedItems.reduce((acc, item) => acc + item.qtyDelta, 0),
  };
}

module.exports = {
  getInventory,
  getInventoryByTenantBranchAndProduct,
  createInventory,
  updateInventory,
  createBulkInventoryEntry,
};
