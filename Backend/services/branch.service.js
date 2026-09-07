const prisma = require("../lib/prisma");

async function getBranchesByTenant(tenantId) {
  return prisma.branch.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

async function createBranch({
  tenantId,
  name,
  phone = null,
  addressLine1 = null,
  city = null,
  state = null,
  isActive = true,
}) {
  return prisma.branch.create({
    data: {
      tenantId,
      name,
      phone,
      addressLine1,
      city,
      state,
      isActive,
    },
  });
}

async function updateBranch({ id, tenantId, data }) {
  const existing = await prisma.branch.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });

  if (!existing) {
    const error = new Error("branch not found");
    error.code = "P2025";
    throw error;
  }

  return prisma.branch.update({
    where: { id },
    data,
  });
}

async function getBranchById({ id, tenantId }) {
  return prisma.branch.findFirst({
    where: { id, tenantId },
  });
}

module.exports = {
  getBranchesByTenant,
  createBranch,
  updateBranch,
  getBranchById,
};
