const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  getRolesByTenant,
  createRole,
  updateRole,
} = require("../services/role.service");

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
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 2d8fb6de-0c1b-4460-bc8a-c9329e5755ef
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         name:
 *           type: string
 *           example: Administrador
 *         createdAt:
 *           type: string
 *           format: date-time
 *     RoleCreateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: Administrador
 *     RoleUpdateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: Supervisor
 *     RoleSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: rol creado
 *         role:
 *           $ref: '#/components/schemas/Role'
 *     RolesListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: roles obtenidos
 *         roles:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Role'
 */

/**
 * @swagger
 * /api/roles:
 *   get:
 *     tags:
 *       - Roles
 *     summary: Obtener roles del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Roles obtenidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RolesListResponse'
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

    const roles = await getRolesByTenant(authContext.tenantId);
    return res.status(200).json({
      message: "roles obtenidos",
      roles,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener roles", error: error.message });
  }
});

/**
 * @swagger
 * /api/roles:
 *   post:
 *     tags:
 *       - Roles
 *     summary: Crear rol
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleCreateRequest'
 *     responses:
 *       201:
 *         description: Rol creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleSingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Rol duplicado en el tenant
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

    if (!name) {
      return res.status(400).json({ message: "name es requerido" });
    }

    const role = await createRole({ tenantId, name });
    return res.status(201).json({
      message: "rol creado",
      role,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "el rol ya existe para este tenant" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId invalido" });
    }

    return res.status(500).json({ message: "error al crear rol", error: error.message });
  }
});

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     tags:
 *       - Roles
 *     summary: Actualizar rol
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del rol
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleUpdateRequest'
 *     responses:
 *       200:
 *         description: Rol actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleSingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Rol no encontrado
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
    const name = String(req.body?.name || "").trim();

    if (!id || !name) {
      return res.status(400).json({ message: "id y name son requeridos" });
    }

    const role = await updateRole({ id, tenantId, name });
    return res.status(200).json({
      message: "rol actualizado",
      role,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "rol no encontrado" });
    }

    if (error.code === "P2002") {
      return res.status(409).json({ message: "el rol ya existe para este tenant" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId invalido" });
    }

    return res.status(500).json({ message: "error al actualizar rol", error: error.message });
  }
});

module.exports = router;
