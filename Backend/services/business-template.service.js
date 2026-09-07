const prisma = require("../lib/prisma");

function hasPresetModels() {
  return Boolean(prisma?.businessTypeTemplate && prisma?.businessTypeTemplateCatalog && prisma?.businessTypeTemplateCategory);
}

async function getBusinessTemplates() {
  if (hasPresetModels()) {
    return prisma.businessTypeTemplate.findMany({
      where: { isActive: true },
      include: {
        catalogs: {
          where: { isEnabled: true },
          orderBy: { sortOrder: "asc" },
        },
        categories: {
          where: { estatus: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { label: "asc" },
    });
  }

  const templates = await prisma.$queryRaw`
    SELECT id, \
           \`key\` AS template_key, \
           label, \
           pos_type, \
           is_active
    FROM business_type_templates
    WHERE is_active = 1
    ORDER BY label ASC
  `;

  if (!templates.length) {
    return [];
  }

  const catalogs = await prisma.$queryRaw`
    SELECT template_id, catalog_key, is_enabled, sort_order
    FROM business_type_template_catalogs
    WHERE is_enabled = 1
    ORDER BY sort_order ASC
  `;

  const categories = await prisma.$queryRaw`
    SELECT template_id, name, estatus, sort_order
    FROM business_type_template_categories
    WHERE estatus = 1
    ORDER BY sort_order ASC
  `;

  return templates.map((template) => ({
    id: template.id,
    key: template.template_key,
    label: template.label,
    posType: template.pos_type,
    isActive: Boolean(template.is_active),
    catalogs: catalogs
      .filter((catalog) => catalog.template_id === template.id)
      .map((catalog) => ({
        catalogKey: catalog.catalog_key,
        isEnabled: Boolean(catalog.is_enabled),
        sortOrder: Number(catalog.sort_order || 0),
      })),
    categories: categories
      .filter((category) => category.template_id === template.id)
      .map((category) => ({
        name: category.name,
        estatus: Boolean(category.estatus),
        sortOrder: Number(category.sort_order || 0),
      })),
  }));
}

async function getBusinessTemplateByKey(businessTypeKey) {
  const normalizedKey = String(businessTypeKey || "").trim().toUpperCase();
  if (!normalizedKey) {
    return null;
  }

  if (hasPresetModels()) {
    return prisma.businessTypeTemplate.findFirst({
      where: {
        key: normalizedKey,
        isActive: true,
      },
      include: {
        catalogs: {
          where: { isEnabled: true },
          orderBy: { sortOrder: "asc" },
        },
        categories: {
          where: { estatus: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  const templates = await prisma.$queryRaw`
    SELECT id, \
           \`key\` AS template_key, \
           label, \
           pos_type, \
           is_active
    FROM business_type_templates
    WHERE \`key\` = ${normalizedKey}
      AND is_active = 1
    LIMIT 1
  `;

  if (!templates.length) {
    return null;
  }

  const template = templates[0];

  const catalogs = await prisma.$queryRaw`
    SELECT catalog_key, is_enabled, sort_order
    FROM business_type_template_catalogs
    WHERE template_id = ${template.id}
      AND is_enabled = 1
    ORDER BY sort_order ASC
  `;

  const categories = await prisma.$queryRaw`
    SELECT name, estatus, sort_order
    FROM business_type_template_categories
    WHERE template_id = ${template.id}
      AND estatus = 1
    ORDER BY sort_order ASC
  `;

  return {
    id: template.id,
    key: template.template_key,
    label: template.label,
    posType: template.pos_type,
    isActive: Boolean(template.is_active),
    catalogs: catalogs.map((catalog) => ({
      catalogKey: catalog.catalog_key,
      isEnabled: Boolean(catalog.is_enabled),
      sortOrder: Number(catalog.sort_order || 0),
    })),
    categories: categories.map((category) => ({
      name: category.name,
      estatus: Boolean(category.estatus),
      sortOrder: Number(category.sort_order || 0),
    })),
  };
}

async function getDefaultCategoriesByBusinessType(businessTypeKey) {
  const template = await getBusinessTemplateByKey(businessTypeKey);
  if (!template) {
    return null;
  }

  return template.categories
    .filter((category) => Boolean(category.estatus))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((category) => category.name);
}

async function applyBusinessTemplateToTenant({ tenantId, businessTypeKey }) {
  const template = await getBusinessTemplateByKey(businessTypeKey);
  if (!template) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        posType: template.posType,
      },
    });

    if (tx.tenantBusinessTypeProfile?.upsert) {
      await tx.tenantBusinessTypeProfile.upsert({
        where: { tenantId },
        update: { businessType: template.key },
        create: {
          tenantId,
          businessType: template.key,
        },
      });
    } else {
      await tx.$executeRaw`
        INSERT INTO tenant_business_type_profiles (tenant_id, business_type, created_at, updated_at)
        VALUES (${tenantId}, ${template.key}, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
        ON DUPLICATE KEY UPDATE
          business_type = VALUES(business_type),
          updated_at = CURRENT_TIMESTAMP(3)
      `;
    }

    if (template.catalogs.length > 0) {
      if (tx.tenantCatalog?.createMany) {
        await tx.tenantCatalog.createMany({
          data: template.catalogs.map((catalog) => ({
            tenantId,
            catalogKey: catalog.catalogKey,
            isEnabled: Boolean(catalog.isEnabled),
            sortOrder: Number(catalog.sortOrder || 0),
          })),
          skipDuplicates: true,
        });
      } else {
        for (const catalog of template.catalogs) {
          await tx.$executeRaw`
            INSERT INTO tenant_catalogs (id, tenant_id, catalog_key, is_enabled, sort_order, created_at, updated_at)
            VALUES (
              UUID(),
              ${tenantId},
              ${catalog.catalogKey},
              ${catalog.isEnabled ? 1 : 0},
              ${Number(catalog.sortOrder || 0)},
              CURRENT_TIMESTAMP(3),
              CURRENT_TIMESTAMP(3)
            )
            ON DUPLICATE KEY UPDATE
              is_enabled = VALUES(is_enabled),
              sort_order = VALUES(sort_order),
              updated_at = CURRENT_TIMESTAMP(3)
          `;
        }
      }
    }

    let createdCategories = 0;

    if (template.categories.length > 0) {
      if (tx.category?.createMany) {
        const created = await tx.category.createMany({
          data: template.categories.map((category) => ({
            tenantId,
            name: category.name,
            estatus: Boolean(category.estatus),
          })),
          skipDuplicates: true,
        });
        createdCategories = Number(created?.count || 0);
      } else {
        for (const category of template.categories) {
          await tx.$executeRaw`
            INSERT INTO categories (id, tenant_id, name, estatus, created_at)
            VALUES (UUID(), ${tenantId}, ${category.name}, ${category.estatus ? 1 : 0}, CURRENT_TIMESTAMP(3))
            ON DUPLICATE KEY UPDATE estatus = VALUES(estatus)
          `;
          createdCategories += 1;
        }
      }
    }

    return {
      templateKey: template.key,
      templateLabel: template.label,
      catalogsApplied: template.catalogs.length,
      categoriesApplied: createdCategories,
    };
  });
}

module.exports = {
  getBusinessTemplates,
  getBusinessTemplateByKey,
  getDefaultCategoriesByBusinessType,
  applyBusinessTemplateToTenant,
};
