const prisma = require("../lib/prisma");

async function getInventoryMovements({ tenantId, branchId, productId }) {
  const where = { tenantId };

  if (branchId) {
    where.branchId = branchId;
  }

  if (productId) {
    where.productId = productId;
  }

  return prisma.inventoryMovement.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

async function createInventoryMovement(data) {
  return prisma.inventoryMovement.create({ data });
}

async function updateInventoryMovement({ id, data }) {
  return prisma.inventoryMovement.update({
    where: { id },
    data,
  });
}

async function getInventoryMovementById(id) {
  return prisma.inventoryMovement.findUnique({
    where: { id },
  });
}

module.exports = {
  getInventoryMovements,
  createInventoryMovement,
  updateInventoryMovement,
  getInventoryMovementById,
};
