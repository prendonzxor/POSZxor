const prisma = require("../lib/prisma");

async function getRolesByTenant(tenantId) {
  return prisma.role.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

async function createRole({ tenantId, name }) {
  return prisma.role.create({
    data: {
      tenantId,
      name,
    },
  });
}

async function updateRole({ id, tenantId, name }) {
  return prisma.role.update({
    where: { id },
    data: {
      tenantId,
      name,
    },
  });
}

module.exports = {
  getRolesByTenant,
  createRole,
  updateRole,
};
