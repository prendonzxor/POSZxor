const prisma = require("../lib/prisma");

async function getCategoriesByTenant(tenantId) {
  return prisma.category.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

async function createCategory({ tenantId, name, estatus = true }) {
  return prisma.category.create({
    data: {
      tenantId,
      name,
      estatus,
    },
  });
}

async function updateCategory({ id, tenantId, name, estatus }) {
  const data = {
    tenantId,
    name,
  };

  if (typeof estatus === "boolean") {
    data.estatus = estatus;
  }

  return prisma.category.update({
    where: { id },
    data,
  });
}

module.exports = {
  getCategoriesByTenant,
  createCategory,
  updateCategory,
};
