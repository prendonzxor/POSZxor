const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  getProductsByTenant,
  searchProductsByTenant,
  getProductById,
  createProduct,
  updateProduct,
} = require("../services/product.service");
const { createNotification } = require("../services/notification.service");

const router = express.Router();

const PRODUCT_UNITS = ["pc", "kg", "g", "l", "ml", "box", "pack", "service"];

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
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 4aef4f6c-8de4-4ea9-8f73-4f4717a2d112
 *         tenantId:
 *           type: string
 *           example: f9789760-4dc8-4fb6-9f7d-9c177d2038ef
 *         categoryId:
 *           type: string
 *           nullable: true
 *           example: 5f9672d9-a5ea-4b4e-8c23-b6f8244a02c0
 *         sku:
 *           type: string
 *           nullable: true
 *           example: SKU-001
 *         barcode:
 *           type: string
 *           nullable: true
 *           example: 7501234567890
 *         name:
 *           type: string
 *           example: Refresco 600ml
 *         unit:
 *           type: string
 *           enum: [pc, kg, g, l, ml, box, pack, service]
 *           example: pc
 *         allowDecimalQty:
 *           type: boolean
 *           example: false
 *         cost:
 *           type: number
 *           format: decimal
 *           example: 10.5
 *         price:
 *           type: number
 *           format: decimal
 *           example: 16.9
 *         wholesalePrice:
 *           type: number
 *           format: decimal
 *           example: 16.9
 *         taxRate:
 *           type: number
 *           format: decimal
 *           example: 16.0
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ProductCreateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         categoryId:
 *           type: string
 *           nullable: true
 *           example: 5f9672d9-a5ea-4b4e-8c23-b6f8244a02c0
 *         sku:
 *           type: string
 *           nullable: true
 *           example: SKU-001
 *         barcode:
 *           type: string
 *           nullable: true
 *           example: 7501234567890
 *         name:
 *           type: string
 *           example: Refresco 600ml
 *         unit:
 *           type: string
 *           enum: [pc, kg, g, l, ml, box, pack, service]
 *           example: pc
 *         allowDecimalQty:
 *           type: boolean
 *           example: false
 *         cost:
 *           type: number
 *           example: 10.5
 *         price:
 *           type: number
 *           example: 16.9
 *         wholesalePrice:
 *           type: number
 *           example: 16.9
 *         taxRate:
 *           type: number
 *           example: 16
 *         isActive:
 *           type: boolean
 *           example: true
 *     ProductUpdateRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         categoryId:
 *           type: string
 *           nullable: true
 *         sku:
 *           type: string
 *           nullable: true
 *         barcode:
 *           type: string
 *           nullable: true
 *         name:
 *           type: string
 *           example: Refresco cola 600ml
 *         unit:
 *           type: string
 *           enum: [pc, kg, g, l, ml, box, pack, service]
 *         allowDecimalQty:
 *           type: boolean
 *         cost:
 *           type: number
 *         price:
 *           type: number
 *         wholesalePrice:
 *           type: number
 *         taxRate:
 *           type: number
 *         isActive:
 *           type: boolean
 *     ProductSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: producto creado
 *         product:
 *           $ref: '#/components/schemas/Product'
 *     ProductsListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: productos obtenidos
 *         products:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Product'
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags:
 *       - Products
 *     summary: Obtener productos del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Productos obtenidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductsListResponse'
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

    const products = await getProductsByTenant(authContext.tenantId);
    return res.status(200).json({
      message: "productos obtenidos",
      products,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener productos", error: error.message });
  }
});

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     tags:
 *       - Products
 *     summary: Buscar productos por sku, barcode y/o name (OR + LIKE)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sku
 *         required: false
 *         schema:
 *           type: string
 *         description: Coincidencia parcial de SKU
 *       - in: query
 *         name: barcode
 *         required: false
 *         schema:
 *           type: string
 *         description: Coincidencia parcial de codigo de barras
 *       - in: query
 *         name: name
 *         required: false
 *         schema:
 *           type: string
 *         description: Coincidencia parcial de nombre
 *     responses:
 *       200:
 *         description: Productos encontrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductsListResponse'
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
router.get("/search", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const sku = String(req.query.sku || "").trim() || undefined;
    const barcode = String(req.query.barcode || "").trim() || undefined;
    const name = String(req.query.name || "").trim() || undefined;

    if (!sku && !barcode && !name) {
      return res.status(400).json({ message: "debes enviar al menos un parametro: sku, barcode o name" });
    }

    const products = await searchProductsByTenant({
      tenantId: authContext.tenantId,
      sku,
      barcode,
      name,
    });

    return res.status(200).json({
      message: "productos encontrados",
      products,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al buscar productos", error: error.message });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     tags:
 *       - Products
 *     summary: Obtener producto por id del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Producto obtenido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductSingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Producto no encontrado
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
router.get("/:id", async (req, res) => {
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

    const product = await getProductById({ id, tenantId });
    if (!product) {
      return res.status(404).json({ message: "producto no encontrado" });
    }

    return res.status(200).json({
      message: "producto obtenido",
      product,
    });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener producto", error: error.message });
  }
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     tags:
 *       - Products
 *     summary: Crear producto
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductCreateRequest'
 *     responses:
 *       201:
 *         description: Producto creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductSingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: SKU o barcode duplicado en tenant
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
    const categoryId = String(req.body?.categoryId || "").trim() || null;
    const sku = String(req.body?.sku || "").trim() || null;
    const barcode = String(req.body?.barcode || "").trim() || null;
    const name = String(req.body?.name || "").trim();
    const unit = String(req.body?.unit || "pc").trim();
    const allowDecimalQty = parseBoolean(req.body?.allowDecimalQty, false);
    const cost = parseNumber(req.body?.cost, 0);
    const price = parseNumber(req.body?.price, 0);
    const wholesalePrice = parseNumber(req.body?.wholesalePrice, price);
    const taxRate = parseNumber(req.body?.taxRate, 0);
    const isActive = parseBoolean(req.body?.isActive, true);

    if (!name) {
      return res.status(400).json({ message: "name es requerido" });
    }

    if (!PRODUCT_UNITS.includes(unit)) {
      return res.status(400).json({ message: "unit invalido" });
    }

    if (cost === null || price === null || wholesalePrice === null || taxRate === null) {
      return res.status(400).json({ message: "cost, price, wholesalePrice y taxRate deben ser numericos" });
    }

    const product = await createProduct({
      tenantId,
      categoryId,
      sku,
      barcode,
      name,
      unit,
      allowDecimalQty,
      cost,
      price,
      wholesalePrice,
      taxRate,
      isActive,
    });
    const entryLabel = unit === "service" ? "servicio" : "producto";

    try {
      await createNotification({
        tenantId,
        title: `${entryLabel === "servicio" ? "Servicio" : "Producto"} creado`,
        message: `Se creo el ${entryLabel} "${name}".`,
        type: "success",
        metadata: {
          entity: "product",
          action: "created",
          productId: product.id,
          unit,
          sku,
          barcode,
        },
      });
    } catch (notificationError) {
      console.error("No se pudo crear notificacion de producto:", notificationError);
    }

    return res.status(201).json({
      message: "producto creado",
      product,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "sku o barcode ya existe para este tenant" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId o categoryId invalido" });
    }

    return res.status(500).json({ message: "error al crear producto", error: error.message });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     tags:
 *       - Products
 *     summary: Actualizar producto
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductUpdateRequest'
 *     responses:
 *       200:
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductSingleResponse'
 *       400:
 *         description: Error de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Producto no encontrado
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
    const categoryId = String(req.body?.categoryId || "").trim() || null;
    const sku = String(req.body?.sku || "").trim() || null;
    const barcode = String(req.body?.barcode || "").trim() || null;
    const name = String(req.body?.name || "").trim();
    const unit = String(req.body?.unit || "pc").trim();
    const allowDecimalQty = parseBoolean(req.body?.allowDecimalQty, false);
    const cost = parseNumber(req.body?.cost, 0);
    const price = parseNumber(req.body?.price, 0);
    const wholesalePrice = parseNumber(req.body?.wholesalePrice, price);
    const taxRate = parseNumber(req.body?.taxRate, 0);
    const isActive = parseBoolean(req.body?.isActive, true);

    if (!id || !name) {
      return res.status(400).json({ message: "id y name son requeridos" });
    }

    if (!PRODUCT_UNITS.includes(unit)) {
      return res.status(400).json({ message: "unit invalido" });
    }

    if (cost === null || price === null || wholesalePrice === null || taxRate === null) {
      return res.status(400).json({ message: "cost, price, wholesalePrice y taxRate deben ser numericos" });
    }

    const existingProduct = await getProductById({ id, tenantId });
    if (!existingProduct) {
      return res.status(404).json({ message: "producto no encontrado" });
    }

    const product = await updateProduct({
      id,
      data: {
        tenantId,
        categoryId,
        sku,
        barcode,
        name,
        unit,
        allowDecimalQty,
        cost,
        price,
        wholesalePrice,
        taxRate,
        isActive,
      },
    });
    const entryLabel = unit === "service" ? "servicio" : "producto";

    try {
      await createNotification({
        tenantId,
        title: `${entryLabel === "servicio" ? "Servicio" : "Producto"} actualizado`,
        message: `Se actualizo el ${entryLabel} "${name}".`,
        type: "info",
        metadata: {
          entity: "product",
          action: "updated",
          productId: product.id,
          previousName: existingProduct.name,
          unit,
          sku,
          barcode,
        },
      });
    } catch (notificationError) {
      console.error("No se pudo crear notificacion de actualizacion de producto:", notificationError);
    }

    return res.status(200).json({
      message: "producto actualizado",
      product,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "sku o barcode ya existe para este tenant" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ message: "tenantId o categoryId invalido" });
    }

    if (error.code === "P2025") {
      return res.status(404).json({ message: "producto no encontrado" });
    }

    return res.status(500).json({ message: "error al actualizar producto", error: error.message });
  }
});

module.exports = router;
