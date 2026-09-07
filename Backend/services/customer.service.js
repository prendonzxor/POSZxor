const prisma = require("../lib/prisma");

let customerStorageMode = null;

async function detectCustomerStorageMode() {
  if (customerStorageMode) {
    return customerStorageMode;
  }

  const columns = await prisma.$queryRaw`
    SELECT COLUMN_NAME AS columnName
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
  `;

  const columnNames = new Set(columns.map((column) => String(column.columnName || "").toLowerCase()));

  customerStorageMode = columnNames.has("tenant_id") ? "modern" : "legacy";
  return customerStorageMode;
}

function normalizeModernCustomer(customer) {
  return {
    id: String(customer.id),
    tenantId: String(customer.tenantId),
    fullName: String(customer.fullName),
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    notes: customer.notes ?? null,
    creditLimit: Number(customer.creditLimit || 0),
    creditBalance: Number(customer.creditBalance || 0),
    discount: Number(customer.discount || 0),
    isActive: Boolean(customer.isActive),
    createdAt: customer.createdAt,
  };
}

function normalizeLegacyCustomer(customer, tenantId) {
  return {
    id: String(customer.id),
    tenantId: String(tenantId),
    fullName: String(customer.fullName),
    phone: customer.phone ?? null,
    email: customer.email ?? null,
    notes: null,
    creditLimit: 0,
    creditBalance: 0,
    discount: 0,
    isActive: true,
    createdAt: customer.createdAt,
  };
}

async function getCustomersByTenant(tenantId) {
  const mode = await detectCustomerStorageMode();

  if (mode === "modern") {
    const rows = await prisma.$queryRaw`
      SELECT
        id AS id,
        tenant_id AS tenantId,
        full_name AS fullName,
        phone AS phone,
        email AS email,
        notes AS notes,
        credit_limit AS creditLimit,
        credit_balance AS creditBalance,
        discount AS discount,
        is_active AS isActive,
        created_at AS createdAt
      FROM customers
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;

    return rows.map(normalizeModernCustomer);
  }

  const legacyRows = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
  });

  return legacyRows.map((customer) => normalizeLegacyCustomer(customer, tenantId));
}

async function searchCustomersByTenant({ tenantId, id, name, phone }) {
  const mode = await detectCustomerStorageMode();

  if (mode === "modern") {
    const hasId = Boolean(id);
    const hasName = Boolean(name);
    const hasPhone = Boolean(phone);

    const rows = await prisma.$queryRaw`
      SELECT
        id AS id,
        tenant_id AS tenantId,
        full_name AS fullName,
        phone AS phone,
        email AS email,
        notes AS notes,
        credit_limit AS creditLimit,
        credit_balance AS creditBalance,
        discount AS discount,
        is_active AS isActive,
        created_at AS createdAt
      FROM customers
      WHERE tenant_id = ${tenantId}
        AND (
          IF(${hasId}, id LIKE CONCAT('%', ${id ?? ""}, '%'), FALSE)
          OR IF(${hasName}, full_name LIKE CONCAT('%', ${name ?? ""}, '%'), FALSE)
          OR IF(${hasPhone}, phone LIKE CONCAT('%', ${phone ?? ""}, '%'), FALSE)
        )
      ORDER BY created_at DESC
    `;

    return rows.map(normalizeModernCustomer);
  }

  const or = [];
  if (id !== undefined) {
    const legacyId = Number(id);
    if (Number.isInteger(legacyId)) {
      or.push({ id: legacyId });
    }
  }
  if (name !== undefined) {
    or.push({ fullName: { contains: name } });
  }
  if (phone !== undefined) {
    or.push({ phone: { contains: phone } });
  }

  if (or.length === 0) {
    return [];
  }

  const legacyRows = await prisma.customer.findMany({
    where: { OR: or },
    orderBy: { createdAt: "desc" },
  });

  return legacyRows.map((customer) => normalizeLegacyCustomer(customer, tenantId));
}

async function createCustomer({
  tenantId,
  fullName,
  phone,
  email,
  notes,
  creditLimit = 0,
  creditBalance = 0,
  discount = 0,
  isActive = true,
}) {
  const mode = await detectCustomerStorageMode();

  if (mode === "modern") {
    await prisma.$executeRaw`
      INSERT INTO customers (
        id,
        tenant_id,
        full_name,
        phone,
        email,
        notes,
        credit_limit,
        credit_balance,
        discount,
        is_active
      )
      VALUES (
        UUID(),
        ${tenantId},
        ${fullName},
        ${phone ?? null},
        ${email ?? null},
        ${notes ?? null},
        ${creditLimit},
        ${creditBalance},
        ${discount},
        ${isActive ? 1 : 0}
      )
    `;

    const rows = await prisma.$queryRaw`
      SELECT
        id AS id,
        tenant_id AS tenantId,
        full_name AS fullName,
        phone AS phone,
        email AS email,
        notes AS notes,
        credit_limit AS creditLimit,
        credit_balance AS creditBalance,
        discount AS discount,
        is_active AS isActive,
        created_at AS createdAt
      FROM customers
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return rows.length > 0 ? normalizeModernCustomer(rows[0]) : null;
  }

  const fallbackEmail = email ?? `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@local.invalid`;
  const customer = await prisma.customer.create({
    data: {
      fullName,
      email: fallbackEmail,
      phone: phone ?? null,
    },
  });

  return normalizeLegacyCustomer(customer, tenantId);
}

async function updateCustomer({
  id,
  tenantId,
  fullName,
  phone,
  email,
  notes,
  creditLimit,
  creditBalance,
  discount,
  isActive,
}) {
  const mode = await detectCustomerStorageMode();

  if (mode === "modern") {
    const hasFullName = fullName !== undefined;
    const hasPhone = phone !== undefined;
    const hasEmail = email !== undefined;
    const hasNotes = notes !== undefined;
    const hasCreditLimit = creditLimit !== undefined;
    const hasCreditBalance = creditBalance !== undefined;
    const hasDiscount = discount !== undefined;
    const hasIsActive = isActive !== undefined;

    await prisma.$executeRaw`
      UPDATE customers
      SET
        full_name = IF(${hasFullName}, ${fullName ?? null}, full_name),
        phone = IF(${hasPhone}, ${phone ?? null}, phone),
        email = IF(${hasEmail}, ${email ?? null}, email),
        notes = IF(${hasNotes}, ${notes ?? null}, notes),
        credit_limit = IF(${hasCreditLimit}, ${creditLimit ?? 0}, credit_limit),
        credit_balance = IF(${hasCreditBalance}, ${creditBalance ?? 0}, credit_balance),
        discount = IF(${hasDiscount}, ${discount ?? 0}, discount),
        is_active = IF(${hasIsActive}, ${isActive ? 1 : 0}, is_active)
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    const rows = await prisma.$queryRaw`
      SELECT
        id AS id,
        tenant_id AS tenantId,
        full_name AS fullName,
        phone AS phone,
        email AS email,
        notes AS notes,
        credit_limit AS creditLimit,
        credit_balance AS creditBalance,
        discount AS discount,
        is_active AS isActive,
        created_at AS createdAt
      FROM customers
      WHERE id = ${id} AND tenant_id = ${tenantId}
      LIMIT 1
    `;

    return rows.length > 0 ? normalizeModernCustomer(rows[0]) : null;
  }

  const legacyId = Number(id);
  if (!Number.isInteger(legacyId)) {
    return null;
  }

  const data = {};
  if (fullName !== undefined) data.fullName = fullName;
  if (phone !== undefined) data.phone = phone;
  if (email !== undefined) data.email = email;

  if (Object.keys(data).length === 0) {
    const customer = await prisma.customer.findUnique({
      where: { id: legacyId },
    });
    return customer ? normalizeLegacyCustomer(customer, tenantId) : null;
  }

  const customer = await prisma.customer.update({
    where: { id: legacyId },
    data,
  });

  return normalizeLegacyCustomer(customer, tenantId);
}

module.exports = {
  getCustomersByTenant,
  searchCustomersByTenant,
  createCustomer,
  updateCustomer,
};
