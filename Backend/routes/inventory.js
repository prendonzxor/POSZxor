const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  getInventory,
  getInventoryByTenantBranchAndProduct,
  createInventory,
  updateInventory,
  createBulkInventoryEntry,
} = require("../services/inventory.service");
const { createNotification } = require("../services/notification.service");
const { getProductById } = require("../services/product.service");
const {
  createNewStockValidationSession,
  completeStockValidationSession,
  ensureStockValidationSession,
  getStockValidationSession,
  markStockValidationItemAdjusted,
  upsertStockValidationItem,
} = require("../services/stock-validation.service");

const router = express.Router();

async function resolveTenantIdFromToken(req) {
  const authHeader = String(req.headers.authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return { error: "token de autorizacion requerido" };
  }

  const session = parseSessionToken(token);
  if (!session) {
    return { error: "token invalido o expirado" };
  }

  if (session.tenantId) {
    return {
      tenantId: String(session.tenantId).trim(),
      userId: Number(session.userId) || null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return { error: "usuario autenticado no encontrado" };
  }

  return {
    tenantId: String(user.tenantId).trim(),
    userId: Number(session.userId) || null,
  };
}

function parseNumber(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function createStockChangedNotification({
  tenantId,
  branchId,
  productId,
  previousQtyOnHand,
  nextQtyOnHand,
  action,
}) {
  try {
    const product = await getProductById({ id: productId, tenantId });
    const productName = product?.name || productId;
    const previousText = previousQtyOnHand === null || previousQtyOnHand === undefined ? "sin registro" : previousQtyOnHand;

    await createNotification({
      tenantId,
      title: "Stock actualizado",
      message: `El stock de "${productName}" cambio de ${previousText} a ${nextQtyOnHand}.`,
      type: "warning",
      metadata: {
        entity: "inventory",
        action,
        branchId,
        productId,
        productName,
        previousQtyOnHand,
        nextQtyOnHand,
      },
    });
  } catch (notificationError) {
    console.error("No se pudo crear notificacion de inventario:", notificationError);
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Inventory:
 *       type: object
 *       properties:
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         branchId:
 *           type: string
 *           example: b77a97b6-6d1f-40fe-aeb2-aef29f2c13d2
 *         productId:
 *           type: string
 *           example: 4aef4f6c-8de4-4ea9-8f73-4f4717a2d112
 *         qtyOnHand:
 *           type: number
 *           format: decimal
 *           example: 25.5
 *         qtyReserved:
 *           type: number
 *           format: decimal
 *           example: 3
 *         reorderLevel:
 *           type: number
 *           format: decimal
 *           example: 10
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     InventoryCreateRequest:
 *       type: object
 *       required:
 *         - branchId
 *         - productId
 *       properties:
 *         branchId:
 *           type: string
 *           example: b77a97b6-6d1f-40fe-aeb2-aef29f2c13d2
 *         productId:
 *           type: string
 *           example: 4aef4f6c-8de4-4ea9-8f73-4f4717a2d112
 *         qtyOnHand:
 *           type: number
 *           example: 25.5
 *         reorderLevel:
 *           type: number
 *           example: 10
 *     InventoryUpdateRequest:
 *       type: object
 *       required:
 *         - branchId
 *         - productId
 *       properties:
 *         branchId:
 *           type: string
 *           example: b77a97b6-6d1f-40fe-aeb2-aef29f2c13d2
 *         productId:
 *           type: string
 *           example: 4aef4f6c-8de4-4ea9-8f73-4f4717a2d112
 *         qtyOnHand:
 *           type: number
 *           example: 20
 *         reorderLevel:
 *           type: number
 *           example: 8
 *     InventorySingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: inventario creado
 *         inventory:
 *           $ref: '#/components/schemas/Inventory'
 *     InventoryListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: inventario obtenido
 *         inventory:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Inventory'
 *     InventoryBulkEntryItemRequest:
 *       type: object
 *       required:
 *         - productId
 *         - qtyDelta
 *       properties:
 *         productId:
 *           type: string
 *           example: 4aef4f6c-8de4-4ea9-8f73-4f4717a2d112
 *         qtyDelta:
 *           type: number
 *           example: 12
 *         unitCost:
 *           type: number
 *           nullable: true
 *           example: 49.9
 *     InventoryBulkEntryRequest:
 *       type: object
 *       required:
 *         - branchId
 *         - type
 *         - items
 *       properties:
 *         branchId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [purchase, adjustment, return, transfer_in]
 *           example: purchase
 *         note:
 *           type: string
 *           nullable: true
 *           example: Factura 1234
 *         items:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/InventoryBulkEntryItemRequest'
 *     InventoryBulkEntryResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: entrada masiva aplicada
 *         referenceId:
 *           type: string
 *         itemCount:
 *           type: number
 *         totalQty:
 *           type: number
 *         inventory:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Inventory'
 */

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Obtener inventario del tenant autenticado (y opcionalmente por branch)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         required: false
 *         schema:
 *           type: string
 *         description: ID de la sucursal
 *     responses:
 *       200:
 *         description: Inventario obtenido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryListResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const tenantId = authContext.tenantId;
    const branchId = String(req.query.branchId || "").trim() || undefined;

    const inventory = await getInventory({ tenantId, branchId });
    return res.status(200).json({
      message: "inventario obtenido",
      inventory,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener inventario", error: error.message });
  }
});

router.get("/stock-validations/current", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const branchId = String(req.query.branchId || "").trim();
    const periodKey = String(req.query.periodKey || req.query.period || "").trim();

    if (!branchId) {
      return res.status(400).json({ message: "branchId es requerido" });
    }

    const result = await getStockValidationSession({
      tenantId: authContext.tenantId,
      branchId,
      periodKey,
    });

    return res.status(200).json({
      message: result ? "validacion de stock obtenida" : "sin validacion de stock",
      session: result?.session || null,
      items: result?.items || [],
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener validacion de stock", error: error.message });
  }
});

router.post("/stock-validations", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const branchId = String(req.body?.branchId || "").trim();
    const periodKey = String(req.body?.periodKey || req.body?.period || "").trim();
    const notes = String(req.body?.notes || "").trim() || null;

    if (!branchId) {
      return res.status(400).json({ message: "branchId es requerido" });
    }

    const result = await ensureStockValidationSession({
      tenantId: authContext.tenantId,
      branchId,
      periodKey,
      notes,
      createdBy: authContext.userId,
    });

    return res.status(200).json({
      message: "validacion de stock lista",
      session: result.session,
      items: result.items,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al crear validacion de stock", error: error.message });
  }
});

router.post("/stock-validations/new", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) return res.status(401).json({ message: authContext.error });
    const branchId = String(req.body?.branchId || "").trim();
    const periodKey = String(req.body?.periodKey || "").trim();
    if (!branchId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) return res.status(400).json({ message: "Sucursal y periodo valido son requeridos" });
    const result = await createNewStockValidationSession({ tenantId: authContext.tenantId, createdBy: authContext.userId, branchId, periodKey });
    return res.status(201).json({ message: "nueva validacion creada", ...result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message || "error al crear validacion" });
  }
});

router.get("/stock-validations/reports", async (req, res) => {
  try {
    const auth = await resolveTenantIdFromToken(req);
    if (auth.error) return res.status(401).json({ message: auth.error });
    const { listStockValidationReports } = require("../services/stock-validation-report.service");
    res.json(await listStockValidationReports({ tenantId: auth.tenantId, page: req.query.page === undefined ? 1 : Number(req.query.page) }));
  } catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
});
router.get("/stock-validations/:sessionId/report", async (req, res) => {
  try {
    const auth = await resolveTenantIdFromToken(req);
    if (auth.error) return res.status(401).json({ message: auth.error });
    const { getStockValidationReport } = require("../services/stock-validation-report.service");
    res.json({ report: await getStockValidationReport({ tenantId: auth.tenantId, sessionId: req.params.sessionId }) });
  } catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
});
router.post("/stock-validations/:sessionId/apply", async (req, res) => {
  try {
    const auth = await resolveTenantIdFromToken(req);
    if (auth.error) return res.status(401).json({ message: auth.error });
    const { applyFullStockValidation } = require("../services/stock-validation-report.service");
    const report = await applyFullStockValidation({ tenantId: auth.tenantId, createdBy: auth.userId, sessionId: req.params.sessionId,
      items: req.body?.items, scopeProductIds: req.body?.scopeProductIds });
    res.json({ report });
  } catch (error) { res.status(error.statusCode || 500).json({ message: error.message }); }
});

router.put("/stock-validations/:sessionId/items", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const sessionId = String(req.params.sessionId || "").trim();
    const productId = String(req.body?.productId || "").trim();
    const virtualQty = parseNumber(req.body?.virtualQty, 0);
    const reservedQty = parseNumber(req.body?.reservedQty, 0);
    const realQty = parseNumber(req.body?.realQty, null);

    if (!sessionId || !productId) {
      return res.status(400).json({ message: "sessionId y productId son requeridos" });
    }

    if (virtualQty === null || reservedQty === null || realQty === null) {
      return res.status(400).json({ message: "virtualQty, reservedQty y realQty deben ser numericos" });
    }

    const item = await upsertStockValidationItem({
      tenantId: authContext.tenantId,
      sessionId,
      productId,
      virtualQty,
      reservedQty,
      realQty,
    });

    return res.status(200).json({
      message: "conteo guardado",
      item,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({ message: error.message || "error al guardar conteo" });
  }
});

router.put("/stock-validations/:sessionId/items/:productId/adjusted", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const sessionId = String(req.params.sessionId || "").trim();
    const productId = String(req.params.productId || "").trim();

    if (!sessionId || !productId) {
      return res.status(400).json({ message: "sessionId y productId son requeridos" });
    }

    await markStockValidationItemAdjusted({
      tenantId: authContext.tenantId,
      sessionId,
      productId,
      adjustedBy: authContext.userId,
    });

    return res.status(200).json({ message: "conteo marcado como ajustado" });
  } catch (error) {
    return res.status(500).json({ message: "error al marcar ajuste", error: error.message });
  }
});

router.put("/stock-validations/:sessionId/complete", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const sessionId = String(req.params.sessionId || "").trim();
    if (!sessionId) {
      return res.status(400).json({ message: "sessionId es requerido" });
    }

    const result = await completeStockValidationSession({
      tenantId: authContext.tenantId,
      sessionId,
    });

    return res.status(200).json({
      message: "validacion de stock completada",
      session: result.session,
      items: result.items,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al completar validacion", error: error.message });
  }
});

/**
 * @swagger
 * /api/inventory/{branchId}/{productId}:
 *   get:
 *     tags:
 *       - Inventory
 *     summary: Obtener inventario por tenant autenticado, sucursal y producto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la sucursal
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Inventario obtenido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventorySingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Registro no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:branchId/:productId", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const tenantId = authContext.tenantId;
    const branchId = String(req.params.branchId || "").trim();
    const productId = String(req.params.productId || "").trim();

    if (!branchId || !productId) {
      return res.status(400).json({ message: "branchId y productId son requeridos" });
    }

    const inventory = await getInventoryByTenantBranchAndProduct({
      tenantId,
      branchId,
      productId,
    });

    if (!inventory) {
      return res.status(404).json({ message: "registro de inventario no encontrado" });
    }

    return res.status(200).json({
      message: "inventario obtenido",
      inventory,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener inventario", error: error.message });
  }
});

/**
 * @swagger
 * /api/inventory/bulk-entry:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Aplicar entrada masiva de inventario y crear movimientos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryBulkEntryRequest'
 *     responses:
 *       200:
 *         description: Entrada masiva aplicada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryBulkEntryResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/bulk-entry", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const tenantId = authContext.tenantId;
    const branchId = String(req.body?.branchId || "").trim();
    const type = String(req.body?.type || "purchase").trim();
    const note = String(req.body?.note || "").trim() || null;

    if (!branchId || !Array.isArray(req.body?.items)) {
      return res.status(400).json({ message: "branchId e items son requeridos" });
    }

    if (!["purchase", "adjustment", "return", "transfer_in"].includes(type)) {
      return res.status(400).json({ message: "type invalido" });
    }

    const result = await createBulkInventoryEntry({
      tenantId,
      branchId,
      type,
      note,
      items: req.body.items,
      createdBy: authContext.userId,
    });

    await createNotification({
      tenantId,
      title: "Entrada masiva aplicada",
      message: `Se agregaron ${result.totalQty.toFixed(3)} unidades en ${result.itemCount} productos.`,
      type: "success",
      metadata: {
        entity: "inventory",
        action: "bulk_entry",
        branchId,
        referenceId: result.referenceId,
        itemCount: result.itemCount,
        totalQty: result.totalQty,
      },
    });

    return res.status(200).json({
      message: "entrada masiva aplicada",
      ...result,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "error al aplicar entrada masiva" });
  }
});

/**
 * @swagger
 * /api/inventory:
 *   post:
 *     tags:
 *       - Inventory
 *     summary: Crear registro de inventario
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryCreateRequest'
 *     responses:
 *       201:
 *         description: Inventario creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventorySingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Registro de inventario duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const tenantId = authContext.tenantId;
    const branchId = String(req.body?.branchId || "").trim();
    const productId = String(req.body?.productId || "").trim();
    const qtyOnHand = parseNumber(req.body?.qtyOnHand, 0);
    const reorderLevel = parseNumber(req.body?.reorderLevel, 0);

    if (!branchId || !productId) {
      return res.status(400).json({ message: "branchId y productId son requeridos" });
    }

    if (qtyOnHand === null || reorderLevel === null) {
      return res.status(400).json({ message: "qtyOnHand y reorderLevel deben ser numericos" });
    }

    const inventory = await createInventory({
      tenantId,
      branchId,
      productId,
      qtyOnHand,
      reorderLevel,
    });

    await createStockChangedNotification({
      tenantId,
      branchId,
      productId,
      previousQtyOnHand: null,
      nextQtyOnHand: qtyOnHand,
      action: "created",
    });

    return res.status(201).json({
      message: "inventario creado",
      inventory,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "el registro de inventario ya existe" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId, branchId o productId invalido" });
    }

    return res.status(500).json({ message: "error al crear inventario", error: error.message });
  }
});

/**
 * @swagger
 * /api/inventory:
 *   put:
 *     tags:
 *       - Inventory
 *     summary: Actualizar registro de inventario
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryUpdateRequest'
 *     responses:
 *       200:
 *         description: Inventario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventorySingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Registro no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token invalido o faltante
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const tenantId = authContext.tenantId;
    const branchId = String(req.body?.branchId || "").trim();
    const productId = String(req.body?.productId || "").trim();
    const hasQtyOnHand = req.body?.qtyOnHand !== undefined;
    const hasReorderLevel = req.body?.reorderLevel !== undefined;
    const qtyOnHand = parseNumber(req.body?.qtyOnHand, undefined);
    const reorderLevel = parseNumber(req.body?.reorderLevel, undefined);

    if (!branchId || !productId) {
      return res.status(400).json({ message: "branchId y productId son requeridos" });
    }

    if (!hasQtyOnHand && !hasReorderLevel) {
      return res.status(400).json({ message: "debes enviar qtyOnHand o reorderLevel para actualizar" });
    }

    if ((hasQtyOnHand && qtyOnHand === null) || (hasReorderLevel && reorderLevel === null)) {
      return res.status(400).json({ message: "qtyOnHand y reorderLevel deben ser numericos" });
    }

    const existingInventory = await getInventoryByTenantBranchAndProduct({
      tenantId,
      branchId,
      productId,
    });

    const inventory = await updateInventory({
      tenantId,
      branchId,
      productId,
      qtyOnHand,
      reorderLevel,
    });

    const previousQtyOnHand = Number(existingInventory?.qtyOnHand ?? 0);
    const nextQtyOnHand = Number(inventory.qtyOnHand ?? qtyOnHand ?? previousQtyOnHand);

    if (hasQtyOnHand && Number.isFinite(nextQtyOnHand) && previousQtyOnHand !== nextQtyOnHand) {
      await createStockChangedNotification({
        tenantId,
        branchId,
        productId,
        previousQtyOnHand,
        nextQtyOnHand,
        action: "updated",
      });
    }

    return res.status(200).json({
      message: "inventario actualizado",
      inventory,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "registro de inventario no encontrado" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId, branchId o productId invalido" });
    }

    return res.status(500).json({ message: "error al actualizar inventario", error: error.message });
  }
});

module.exports = router;
