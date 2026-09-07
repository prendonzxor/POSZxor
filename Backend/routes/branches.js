const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  getBranchesByTenant,
  createBranch,
  updateBranch,
  getBranchById,
} = require("../services/branch.service");

const router = express.Router();

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

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

/**
 * @swagger
 * components:
 *   schemas:
 *     Branch:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 51e7f5ca-f2de-4b3e-9df4-f718b291756d
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         name:
 *           type: string
 *           example: Sucursal Centro
 *         phone:
 *           type: string
 *           nullable: true
 *           example: 5551234567
 *         addressLine1:
 *           type: string
 *           nullable: true
 *           example: Av. Reforma 100
 *         city:
 *           type: string
 *           nullable: true
 *           example: Ciudad de Mexico
 *         state:
 *           type: string
 *           nullable: true
 *           example: CDMX
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *     BranchCreateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         phone:
 *           type: string
 *           nullable: true
 *         addressLine1:
 *           type: string
 *           nullable: true
 *         city:
 *           type: string
 *           nullable: true
 *         state:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *           example: true
 *     BranchUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         phone:
 *           type: string
 *           nullable: true
 *         addressLine1:
 *           type: string
 *           nullable: true
 *         city:
 *           type: string
 *           nullable: true
 *         state:
 *           type: string
 *           nullable: true
 *         isActive:
 *           type: boolean
 *           example: false
 *     BranchSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: sucursal creada
 *         branch:
 *           $ref: '#/components/schemas/Branch'
 *     BranchesListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: sucursales obtenidas
 *         branches:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Branch'
 */

/**
 * @swagger
 * /api/branches:
 *   get:
 *     tags:
 *       - Branches
 *     summary: Obtener sucursales del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sucursales obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BranchesListResponse'
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

    const branches = await getBranchesByTenant(authContext.tenantId);
    return res.status(200).json({
      message: "sucursales obtenidas",
      branches,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener sucursales", error: error.message });
  }
});

/**
 * @swagger
 * /api/branches:
 *   post:
 *     tags:
 *       - Branches
 *     summary: Crear sucursal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BranchCreateRequest'
 *     responses:
 *       201:
 *         description: Sucursal creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BranchSingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Sucursal duplicada en el tenant
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
    const name = String(req.body?.name || "").trim();
    const phone = String(req.body?.phone || "").trim() || null;
    const addressLine1 = String(req.body?.addressLine1 || "").trim() || null;
    const city = String(req.body?.city || "").trim() || null;
    const state = String(req.body?.state || "").trim() || null;
    const isActive = parseBoolean(req.body?.isActive, true);

    if (!name) {
      return res.status(400).json({ message: "name es requerido" });
    }

    const branch = await createBranch({
      tenantId,
      name,
      phone,
      addressLine1,
      city,
      state,
      isActive,
    });

    return res.status(201).json({
      message: "sucursal creada",
      branch,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "la sucursal ya existe para este tenant" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId invalido" });
    }

    return res.status(500).json({ message: "error al crear sucursal", error: error.message });
  }
});

/**
 * @swagger
 * /api/branches/{id}:
 *   put:
 *     tags:
 *       - Branches
 *     summary: Actualizar sucursal
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la sucursal
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BranchUpdateRequest'
 *     responses:
 *       200:
 *         description: Sucursal actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BranchSingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Sucursal no encontrada
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
    const tenantId = authContext.tenantId;

    if (!id) {
      return res.status(400).json({ message: "id es requerido" });
    }

    const existingBranch = await getBranchById({ id, tenantId });
    if (!existingBranch) {
      return res.status(404).json({ message: "sucursal no encontrada" });
    }

    const data = {};
    if (req.body?.name !== undefined) data.name = String(req.body.name || "").trim();
    if (req.body?.phone !== undefined) data.phone = String(req.body.phone || "").trim() || null;
    if (req.body?.addressLine1 !== undefined) data.addressLine1 = String(req.body.addressLine1 || "").trim() || null;
    if (req.body?.city !== undefined) data.city = String(req.body.city || "").trim() || null;
    if (req.body?.state !== undefined) data.state = String(req.body.state || "").trim() || null;
    if (req.body?.isActive !== undefined) data.isActive = parseBoolean(req.body.isActive, true);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "no hay campos para actualizar" });
    }

    if (data.name !== undefined && !data.name) {
      return res.status(400).json({ message: "name no puede estar vacio" });
    }

    const branch = await updateBranch({ id, tenantId, data });
    return res.status(200).json({
      message: "sucursal actualizada",
      branch,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "sucursal no encontrada" });
    }

    if (error.code === "P2002") {
      return res.status(409).json({ message: "la sucursal ya existe para este tenant" });
    }

    return res.status(500).json({ message: "error al actualizar sucursal", error: error.message });
  }
});

module.exports = router;
