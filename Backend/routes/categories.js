const express = require("express");
const {
  getCategoriesByTenant,
  createCategory,
  updateCategory,
} = require("../services/category.service");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");

const router = express.Router();

function normalizeCategory(category) {
  return {
    ...category,
    estatus: typeof category?.estatus === "boolean" ? category.estatus : true,
  };
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
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 4aef4f6c-8de4-4ea9-8f73-4f4717a2d112
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         name:
 *           type: string
 *           example: Bebidas
 *         estatus:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *     CategoryCreateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: Bebidas
 *         estatus:
 *           type: boolean
 *           example: true
 *     CategoryUpdateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           example: Snacks
 *         estatus:
 *           type: boolean
 *           example: false
 *     CategorySingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: categoria creada
 *         category:
 *           $ref: '#/components/schemas/Category'
 *     CategoriesListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: categorias obtenidas
 *         categories:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Category'
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     tags:
 *       - Categories
 *     summary: Obtener categorias del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categorias obtenidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriesListResponse'
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

    const categories = await getCategoriesByTenant(authContext.tenantId);
    return res.status(200).json({
      message: "categorias obtenidas",
      tenantId: authContext.tenantId,
      categories: categories.map(normalizeCategory),
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener categorias", error: error.message });
  }
});

/**
 * @swagger
 * /api/categories:
 *   post:
 *     tags:
 *       - Categories
 *     summary: Crear categoria
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryCreateRequest'
 *     responses:
 *       201:
 *         description: Categoria creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategorySingleResponse'
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
 *         description: Usuario autenticado no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Categoria duplicada en el tenant
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

    const name = String(req.body?.name || "").trim();
    const estatus = req.body?.estatus;

    if (!name) {
      return res.status(400).json({ message: "name es requerido" });
    }

    if (estatus !== undefined && typeof estatus !== "boolean") {
      return res.status(400).json({ message: "estatus debe ser booleano" });
    }

    const tenantId = authContext.tenantId;
    const category = await createCategory({ tenantId, name, estatus: estatus ?? true });
    return res.status(201).json({
      message: "categoria creada",
      category: normalizeCategory(category),
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "la categoria ya existe para este tenant" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId invalido" });
    }

    return res.status(500).json({ message: "error al crear categoria", error: error.message });
  }
});

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     tags:
 *       - Categories
 *     summary: Actualizar categoria
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la categoria
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryUpdateRequest'
 *     responses:
 *       200:
 *         description: Categoria actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategorySingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Categoria no encontrada
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
    const estatus = req.body?.estatus;

    if (!id || !name) {
      return res.status(400).json({ message: "id y name son requeridos" });
    }

    if (estatus !== undefined && typeof estatus !== "boolean") {
      return res.status(400).json({ message: "estatus debe ser booleano" });
    }

    const category = await updateCategory({ id, tenantId, name, estatus });
    return res.status(200).json({
      message: "categoria actualizada",
      category: normalizeCategory(category),
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "categoria no encontrada" });
    }

    if (error.code === "P2002") {
      return res.status(409).json({ message: "la categoria ya existe para este tenant" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId invalido" });
    }

    return res.status(500).json({ message: "error al actualizar categoria", error: error.message });
  }
});

module.exports = router;
