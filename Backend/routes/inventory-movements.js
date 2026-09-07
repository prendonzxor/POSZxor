const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  getInventoryMovements,
  createInventoryMovement,
  updateInventoryMovement,
  getInventoryMovementById,
} = require("../services/inventory-movements.service");

const router = express.Router();

const MOVEMENT_TYPES = [
  "purchase",
  "sale",
  "adjustment",
  "return",
  "transfer_in",
  "transfer_out",
];

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
    return { tenantId: String(session.tenantId).trim() };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    return { error: "usuario autenticado no encontrado" };
  }

  return { tenantId: String(user.tenantId).trim() };
}

function parseNumber(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryMovement:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 8c4150a4-fbe1-4868-a3ed-a30a8a9d8697
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         branchId:
 *           type: string
 *           example: b77a97b6-6d1f-40fe-aeb2-aef29f2c13d2
 *         productId:
 *           type: string
 *           example: 4aef4f6c-8de4-4ea9-8f73-4f4717a2d112
 *         type:
 *           type: string
 *           enum: [purchase, sale, adjustment, return, transfer_in, transfer_out]
 *           example: purchase
 *         qtyDelta:
 *           type: number
 *           format: decimal
 *           example: 12.5
 *         unitCost:
 *           type: number
 *           format: decimal
 *           nullable: true
 *           example: 10.2
 *         referenceType:
 *           type: string
 *           nullable: true
 *           example: purchase
 *         referenceId:
 *           type: string
 *           nullable: true
 *           example: 7d8cc971-301f-482f-baf5-78eb9ec056e8
 *         note:
 *           type: string
 *           nullable: true
 *           example: ajuste de inventario inicial
 *         createdBy:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *     InventoryMovementCreateRequest:
 *       type: object
 *       required:
 *         - branchId
 *         - productId
 *         - type
 *         - qtyDelta
 *       properties:
 *         branchId:
 *           type: string
 *         productId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [purchase, sale, adjustment, return, transfer_in, transfer_out]
 *         qtyDelta:
 *           type: number
 *         unitCost:
 *           type: number
 *           nullable: true
 *         referenceType:
 *           type: string
 *           nullable: true
 *         referenceId:
 *           type: string
 *           nullable: true
 *         note:
 *           type: string
 *           nullable: true
 *         createdBy:
 *           type: integer
 *           nullable: true
 *     InventoryMovementUpdateRequest:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [purchase, sale, adjustment, return, transfer_in, transfer_out]
 *         qtyDelta:
 *           type: number
 *         unitCost:
 *           type: number
 *           nullable: true
 *         referenceType:
 *           type: string
 *           nullable: true
 *         referenceId:
 *           type: string
 *           nullable: true
 *         note:
 *           type: string
 *           nullable: true
 *         createdBy:
 *           type: integer
 *           nullable: true
 *     InventoryMovementSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: movimiento de inventario creado
 *         movement:
 *           $ref: '#/components/schemas/InventoryMovement'
 *     InventoryMovementsListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: movimientos de inventario obtenidos
 *         movements:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/InventoryMovement'
 */

/**
 * @swagger
 * /api/inventory-movements:
 *   get:
 *     tags:
 *       - Inventory Movements
 *     summary: Obtener movimientos de inventario del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: productId
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Movimientos obtenidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryMovementsListResponse'
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
    const productId = String(req.query.productId || "").trim() || undefined;

    const movements = await getInventoryMovements({ tenantId, branchId, productId });
    return res.status(200).json({
      message: "movimientos de inventario obtenidos",
      movements,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener movimientos de inventario", error: error.message });
  }
});

/**
 * @swagger
 * /api/inventory-movements:
 *   post:
 *     tags:
 *       - Inventory Movements
 *     summary: Crear movimiento de inventario
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryMovementCreateRequest'
 *     responses:
 *       201:
 *         description: Movimiento creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryMovementSingleResponse'
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
router.post("/", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const tenantId = authContext.tenantId;
    const branchId = String(req.body?.branchId || "").trim();
    const productId = String(req.body?.productId || "").trim();
    const type = String(req.body?.type || "").trim();
    const qtyDelta = parseNumber(req.body?.qtyDelta, null);
    const unitCost = parseNumber(req.body?.unitCost, undefined);
    const referenceType = String(req.body?.referenceType || "").trim() || null;
    const referenceId = String(req.body?.referenceId || "").trim() || null;
    const note = String(req.body?.note || "").trim() || null;
    const createdBy = parseNumber(req.body?.createdBy, undefined);

    if (!branchId || !productId || !type || qtyDelta === null) {
      return res.status(400).json({ message: "branchId, productId, type y qtyDelta son requeridos" });
    }

    if (!MOVEMENT_TYPES.includes(type)) {
      return res.status(400).json({ message: "type invalido" });
    }

    if (unitCost === null || createdBy === null) {
      return res.status(400).json({ message: "unitCost y createdBy deben ser numericos cuando se envian" });
    }

    const movement = await createInventoryMovement({
      tenantId,
      branchId,
      productId,
      type,
      qtyDelta,
      unitCost,
      referenceType,
      referenceId,
      note,
      createdBy,
    });

    return res.status(201).json({
      message: "movimiento de inventario creado",
      movement,
    });
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId, branchId, productId o createdBy invalido" });
    }

    return res.status(500).json({ message: "error al crear movimiento de inventario", error: error.message });
  }
});

/**
 * @swagger
 * /api/inventory-movements/{id}:
 *   put:
 *     tags:
 *       - Inventory Movements
 *     summary: Actualizar movimiento de inventario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del movimiento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryMovementUpdateRequest'
 *     responses:
 *       200:
 *         description: Movimiento actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryMovementSingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Movimiento no encontrado
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
router.put("/:id", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const id = String(req.params.id || "").trim();
    const data = {};

    if (!id) {
      return res.status(400).json({ message: "id es requerido" });
    }

    if (req.body?.type !== undefined) {
      const type = String(req.body.type || "").trim();
      if (!MOVEMENT_TYPES.includes(type)) {
        return res.status(400).json({ message: "type invalido" });
      }
      data.type = type;
    }

    if (req.body?.qtyDelta !== undefined) {
      const qtyDelta = parseNumber(req.body.qtyDelta, null);
      if (qtyDelta === null) {
        return res.status(400).json({ message: "qtyDelta debe ser numerico" });
      }
      data.qtyDelta = qtyDelta;
    }

    if (req.body?.unitCost !== undefined) {
      if (req.body.unitCost === null) {
        data.unitCost = null;
      } else {
      const unitCost = parseNumber(req.body.unitCost, null);
      if (unitCost === null) {
        return res.status(400).json({ message: "unitCost debe ser numerico" });
      }
      data.unitCost = unitCost;
      }
    }

    if (req.body?.referenceType !== undefined) {
      data.referenceType = String(req.body.referenceType || "").trim() || null;
    }

    if (req.body?.referenceId !== undefined) {
      data.referenceId = String(req.body.referenceId || "").trim() || null;
    }

    if (req.body?.note !== undefined) {
      data.note = String(req.body.note || "").trim() || null;
    }

    if (req.body?.createdBy !== undefined) {
      if (req.body.createdBy === null) {
        data.createdBy = null;
      } else {
        const createdBy = parseNumber(req.body.createdBy, null);
        if (createdBy === null) {
          return res.status(400).json({ message: "createdBy debe ser numerico" });
        }
        data.createdBy = createdBy;
      }
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "no hay campos para actualizar" });
    }

    const existingMovement = await getInventoryMovementById(id);
    if (!existingMovement) {
      return res.status(404).json({ message: "movimiento de inventario no encontrado" });
    }

    const movement = await updateInventoryMovement({ id, data });
    return res.status(200).json({
      message: "movimiento de inventario actualizado",
      movement,
    });
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).json({ message: "createdBy invalido" });
    }

    if (error.code === "P2025") {
      return res.status(404).json({ message: "movimiento de inventario no encontrado" });
    }

    return res.status(500).json({ message: "error al actualizar movimiento de inventario", error: error.message });
  }
});

module.exports = router;
