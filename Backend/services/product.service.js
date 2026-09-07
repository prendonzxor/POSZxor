const prisma = require("../lib/prisma");

function hasProductModel() {
  // Product uses raw SQL because this service maps recently added DB columns
  // before every deployed environment has regenerated Prisma Client.
  return false;
}

function mapDbProductRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    categoryId: row.category_id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    unit: row.unit,
    allowDecimalQty: Boolean(row.allow_decimal_qty),
    cost: row.cost,
    price: row.price,
    wholesalePrice: row.wholesale_price ?? row.price,
    taxRate: row.tax_rate,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function withWholesalePrice(data) {
  return {
    ...data,
    wholesalePrice: data.wholesalePrice ?? data.price,
  };
}

async function getProductsByTenant(tenantId) {
  if (hasProductModel()) {
    return prisma.product.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      tenant_id,
      category_id,
      sku,
      barcode,
      name,
      unit,
      allow_decimal_qty,
      cost,
      price,
      wholesale_price,
      tax_rate,
      is_active,
      created_at,
      updated_at
    FROM products
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `;

  return rows.map(mapDbProductRow);
}

async function searchProductsByTenant({ tenantId, sku, barcode, name }) {
  if (hasProductModel()) {
    const or = [];

    if (sku) {
      or.push({ sku: { contains: sku } });
    }
    if (barcode) {
      or.push({ barcode: { contains: barcode } });
    }
    if (name) {
      or.push({ name: { contains: name } });
    }

    if (or.length === 0) {
      return [];
    }

    return prisma.product.findMany({
      where: {
        tenantId,
        OR: or,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  const hasSku = Boolean(sku);
  const hasBarcode = Boolean(barcode);
  const hasName = Boolean(name);

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      tenant_id,
      category_id,
      sku,
      barcode,
      name,
      unit,
      allow_decimal_qty,
      cost,
      price,
      wholesale_price,
      tax_rate,
      is_active,
      created_at,
      updated_at
    FROM products
    WHERE tenant_id = ${tenantId}
      AND (
        IF(${hasSku}, sku LIKE CONCAT('%', ${sku ?? ""}, '%'), FALSE)
        OR IF(${hasBarcode}, barcode LIKE CONCAT('%', ${barcode ?? ""}, '%'), FALSE)
        OR IF(${hasName}, name LIKE CONCAT('%', ${name ?? ""}, '%'), FALSE)
      )
    ORDER BY created_at DESC
  `;

  return rows.map(mapDbProductRow);
}

async function getProductById({ id, tenantId }) {
  if (hasProductModel()) {
    return prisma.product.findFirst({
      where: {
        id,
        tenantId,
      },
    });
  }

  const rows = await prisma.$queryRaw`
    SELECT
      id,
      tenant_id,
      category_id,
      sku,
      barcode,
      name,
      unit,
      allow_decimal_qty,
      cost,
      price,
      wholesale_price,
      tax_rate,
      is_active,
      created_at,
      updated_at
    FROM products
    WHERE id = ${id}
      AND tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (!rows.length) {
    return null;
  }

  return mapDbProductRow(rows[0]);
}

async function createProduct(data) {
  const normalizedData = withWholesalePrice(data);

  if (hasProductModel()) {
    return prisma.product.create({ data: normalizedData });
  }

  const productId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : null;
  const id = productId || `prd-${Date.now()}`;

  await prisma.$executeRaw`
    INSERT INTO products (
      id,
      tenant_id,
      category_id,
      sku,
      barcode,
      name,
      unit,
      allow_decimal_qty,
      cost,
      price,
      wholesale_price,
      tax_rate,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      ${id},
      ${normalizedData.tenantId},
      ${normalizedData.categoryId},
      ${normalizedData.sku},
      ${normalizedData.barcode},
      ${normalizedData.name},
      ${normalizedData.unit},
      ${normalizedData.allowDecimalQty ? 1 : 0},
      ${normalizedData.cost},
      ${normalizedData.price},
      ${normalizedData.wholesalePrice},
      ${normalizedData.taxRate},
      ${normalizedData.isActive ? 1 : 0},
      NOW(3),
      NOW(3)
    )
  `;

  const created = await getProductById({ id, tenantId: normalizedData.tenantId });
  return created;
}

async function updateProduct({ id, data }) {
  const normalizedData = withWholesalePrice(data);

  if (hasProductModel()) {
    return prisma.product.update({
      where: { id },
      data: normalizedData,
    });
  }

  await prisma.$executeRaw`
    UPDATE products
    SET
      tenant_id = ${normalizedData.tenantId},
      category_id = ${normalizedData.categoryId},
      sku = ${normalizedData.sku},
      barcode = ${normalizedData.barcode},
      name = ${normalizedData.name},
      unit = ${normalizedData.unit},
      allow_decimal_qty = ${normalizedData.allowDecimalQty ? 1 : 0},
      cost = ${normalizedData.cost},
      price = ${normalizedData.price},
      wholesale_price = ${normalizedData.wholesalePrice},
      tax_rate = ${normalizedData.taxRate},
      is_active = ${normalizedData.isActive ? 1 : 0},
      updated_at = NOW(3)
    WHERE id = ${id}
  `;

  const updated = await getProductById({ id, tenantId: normalizedData.tenantId });
  return updated;
}

module.exports = {
  getProductsByTenant,
  searchProductsByTenant,
  getProductById,
  createProduct,
  updateProduct,
};
