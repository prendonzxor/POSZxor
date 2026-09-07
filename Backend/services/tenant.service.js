const prisma = require("../lib/prisma");

async function getTenantById(tenantId) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
  });
}

async function updateTenantById({ tenantId, data }) {
  const existing = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!existing) {
    const error = new Error("tenant not found");
    error.code = "P2025";
    throw error;
  }

  return prisma.tenant.update({
    where: { id: tenantId },
    data,
  });
}

module.exports = {
  getTenantById,
  updateTenantById,
};
