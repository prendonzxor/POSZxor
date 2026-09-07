const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const {
  DISCOUNT_TYPES,
  DISCOUNT_SCOPES,
  listCouponsByTenant,
  createCoupon,
  updateCouponById,
  validateCouponForTenant,
  listDiscountsByTenant,
  createDiscount,
  updateDiscountById,
} = require("../services/promotion.service");

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

function normalizeNullableString(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function normalizeNullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return Number(value);
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Coupon:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "2840aaea-c1a8-4a98-a997-d1d6fdb0f82b"
 *         tenantId:
 *           type: string
 *           example: "f9789760-4dc8-4fb6-9f7d-9c177d2038ef"
 *         code:
 *           type: string
 *           example: "BIENVENIDA10"
 *         name:
 *           type: string
 *           example: "Cupon de bienvenida"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "10% de descuento en la primera compra"
 *         scope:
 *           type: string
 *           enum: [order, product, category, customer, subscription, subscription_plan]
 *           example: "subscription_plan"
 *         targetRef:
 *           type: string
 *           nullable: true
 *           example: "PRO"
 *         discountType:
 *           type: string
 *           enum: [percentage, fixed_amount]
 *         discountValue:
 *           type: number
 *           example: 10
 *         maxDiscountAmount:
 *           type: number
 *           nullable: true
 *           example: 150
 *         minOrderAmount:
 *           type: number
 *           nullable: true
 *           example: 500
 *         usageLimit:
 *           type: integer
 *           nullable: true
 *           example: 100
 *         usedCount:
 *           type: integer
 *           example: 0
 *         startsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         endsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     DiscountRule:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         tenantId:
 *           type: string
 *         name:
 *           type: string
 *           example: "Descuento por categoria bebidas"
 *         description:
 *           type: string
 *           nullable: true
 *         scope:
 *           type: string
 *           enum: [order, product, category, customer]
 *         targetRef:
 *           type: string
 *           nullable: true
 *           example: "category-001"
 *         discountType:
 *           type: string
 *           enum: [percentage, fixed_amount]
 *         discountValue:
 *           type: number
 *           example: 15
 *         minOrderAmount:
 *           type: number
 *           nullable: true
 *           example: 300
 *         stackable:
 *           type: boolean
 *           example: false
 *         startsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         endsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     CouponCreateRequest:
 *       type: object
 *       required: [code, name, discountType, discountValue]
 *       properties:
 *         code:
 *           type: string
 *           example: "BIENVENIDA10"
 *         name:
 *           type: string
 *           example: "Cupon de bienvenida"
 *         description:
 *           type: string
 *           example: "Promocion para nuevos clientes"
 *         scope:
 *           type: string
 *           enum: [order, product, category, customer, subscription, subscription_plan]
 *           example: "subscription_plan"
 *         targetRef:
 *           type: string
 *           nullable: true
 *           example: "PRO"
 *         discountType:
 *           type: string
 *           enum: [percentage, fixed_amount]
 *         discountValue:
 *           type: number
 *           example: 10
 *         maxDiscountAmount:
 *           type: number
 *           nullable: true
 *           example: 150
 *         minOrderAmount:
 *           type: number
 *           nullable: true
 *           example: 500
 *         usageLimit:
 *           type: integer
 *           nullable: true
 *           example: 100
 *         startsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         endsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isActive:
 *           type: boolean
 *           example: true
 *     CouponValidateRequest:
 *       type: object
 *       required: [code]
 *       properties:
 *         code:
 *           type: string
 *           example: "BIENVENIDA10"
 *         subtotal:
 *           type: number
 *           example: 1200
 *     CouponValidationResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "cupon validado"
 *         result:
 *           type: object
 *           properties:
 *             isValid:
 *               type: boolean
 *             reason:
 *               type: string
 *               nullable: true
 *             discountAmount:
 *               type: number
 *             finalSubtotal:
 *               type: number
 *             coupon:
 *               oneOf:
 *                 - $ref: '#/components/schemas/Coupon'
 *                 - type: 'null'
 *     CouponListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "cupones obtenidos"
 *         coupons:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Coupon'
 *     CouponSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "cupon creado"
 *         coupon:
 *           $ref: '#/components/schemas/Coupon'
 *     DiscountRuleCreateRequest:
 *       type: object
 *       required: [name, scope, discountType, discountValue]
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         scope:
 *           type: string
 *           enum: [order, product, category, customer]
 *         targetRef:
 *           type: string
 *           nullable: true
 *         discountType:
 *           type: string
 *           enum: [percentage, fixed_amount]
 *         discountValue:
 *           type: number
 *         minOrderAmount:
 *           type: number
 *           nullable: true
 *         stackable:
 *           type: boolean
 *         startsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         endsAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isActive:
 *           type: boolean
 *     DiscountRuleListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "descuentos obtenidos"
 *         discounts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DiscountRule'
 *     DiscountRuleSingleResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "descuento creado"
 *         discount:
 *           $ref: '#/components/schemas/DiscountRule'
 */

/**
 * @swagger
 * /api/promotions/coupons:
 *   get:
 *     tags: [Promotions]
 *     summary: Obtener cupones del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cupones obtenidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CouponListResponse'
 */
router.get("/coupons", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const coupons = await listCouponsByTenant(authContext.tenantId);
    return res.status(200).json({ message: "cupones obtenidos", coupons });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener cupones", error: error.message });
  }
});

/**
 * @swagger
 * /api/promotions/coupons:
 *   post:
 *     tags: [Promotions]
 *     summary: Crear cupon
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponCreateRequest'
 *     responses:
 *       201:
 *         description: Cupon creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CouponSingleResponse'
 */
router.post("/coupons", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const coupon = await createCoupon({
      tenantId: authContext.tenantId,
      code: req.body?.code,
      name: req.body?.name,
      description: req.body?.description,
      scope: req.body?.scope,
      targetRef: req.body?.targetRef,
      discountType: req.body?.discountType,
      discountValue: req.body?.discountValue,
      maxDiscountAmount: normalizeNullableNumber(req.body?.maxDiscountAmount),
      minOrderAmount: normalizeNullableNumber(req.body?.minOrderAmount),
      usageLimit: normalizeNullableNumber(req.body?.usageLimit),
      startsAt: normalizeNullableString(req.body?.startsAt),
      endsAt: normalizeNullableString(req.body?.endsAt),
      isActive: req.body?.isActive,
    });

    return res.status(201).json({ message: "cupon creado", coupon });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === "ER_DUP_ENTRY" ? 409 : 500);
    return res.status(statusCode).json({ message: error.message || "error al crear cupon", error: error.code });
  }
});

/**
 * @swagger
 * /api/promotions/coupons/{id}:
 *   put:
 *     tags: [Promotions]
 *     summary: Actualizar cupon
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponCreateRequest'
 *     responses:
 *       200:
 *         description: Cupon actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CouponSingleResponse'
 */
router.put("/coupons/:id", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const coupon = await updateCouponById({
      id: req.params.id,
      tenantId: authContext.tenantId,
      code: req.body?.code,
      name: req.body?.name,
      description: req.body?.description,
      scope: req.body?.scope,
      targetRef: req.body?.targetRef,
      discountType: req.body?.discountType,
      discountValue: req.body?.discountValue,
      maxDiscountAmount: req.body?.maxDiscountAmount,
      minOrderAmount: req.body?.minOrderAmount,
      usageLimit: req.body?.usageLimit,
      startsAt: req.body?.startsAt,
      endsAt: req.body?.endsAt,
      isActive: req.body?.isActive,
    });

    return res.status(200).json({ message: "cupon actualizado", coupon });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === "ER_DUP_ENTRY" ? 409 : 500);
    return res.status(statusCode).json({ message: error.message || "error al actualizar cupon", error: error.code });
  }
});

/**
 * @swagger
 * /api/promotions/coupons/validate:
 *   post:
 *     tags: [Promotions]
 *     summary: Validar cupon para un subtotal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CouponValidateRequest'
 *     responses:
 *       200:
 *         description: Resultado de validacion
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CouponValidationResponse'
 */
router.post("/coupons/validate", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const result = await validateCouponForTenant({
      tenantId: authContext.tenantId,
      code: req.body?.code,
      subtotal: req.body?.subtotal,
    });

    return res.status(200).json({ message: "cupon validado", result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || "error al validar cupon" });
  }
});

/**
 * @swagger
 * /api/promotions/discounts:
 *   get:
 *     tags: [Promotions]
 *     summary: Obtener reglas de descuento del tenant autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Descuentos obtenidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiscountRuleListResponse'
 */
router.get("/discounts", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const discounts = await listDiscountsByTenant(authContext.tenantId);
    return res.status(200).json({ message: "descuentos obtenidos", discounts });
  } catch (error) {
    return res.status(500).json({ message: "error al obtener descuentos", error: error.message });
  }
});

/**
 * @swagger
 * /api/promotions/discounts:
 *   post:
 *     tags: [Promotions]
 *     summary: Crear regla de descuento
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DiscountRuleCreateRequest'
 *     responses:
 *       201:
 *         description: Descuento creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiscountRuleSingleResponse'
 */
router.post("/discounts", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const discount = await createDiscount({
      tenantId: authContext.tenantId,
      name: req.body?.name,
      description: req.body?.description,
      scope: req.body?.scope,
      targetRef: req.body?.targetRef,
      discountType: req.body?.discountType,
      discountValue: req.body?.discountValue,
      minOrderAmount: normalizeNullableNumber(req.body?.minOrderAmount),
      stackable: req.body?.stackable,
      startsAt: normalizeNullableString(req.body?.startsAt),
      endsAt: normalizeNullableString(req.body?.endsAt),
      isActive: req.body?.isActive,
    });

    return res.status(201).json({ message: "descuento creado", discount });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || "error al crear descuento", error: error.code });
  }
});

/**
 * @swagger
 * /api/promotions/discounts/{id}:
 *   put:
 *     tags: [Promotions]
 *     summary: Actualizar regla de descuento
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DiscountRuleCreateRequest'
 *     responses:
 *       200:
 *         description: Descuento actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DiscountRuleSingleResponse'
 */
router.put("/discounts/:id", async (req, res) => {
  try {
    const authContext = await resolveTenantIdFromToken(req);
    if (authContext.error) {
      return res.status(401).json({ message: authContext.error });
    }

    const discount = await updateDiscountById({
      id: req.params.id,
      tenantId: authContext.tenantId,
      name: req.body?.name,
      description: req.body?.description,
      scope: req.body?.scope,
      targetRef: req.body?.targetRef,
      discountType: req.body?.discountType,
      discountValue: req.body?.discountValue,
      minOrderAmount: req.body?.minOrderAmount,
      stackable: req.body?.stackable,
      startsAt: req.body?.startsAt,
      endsAt: req.body?.endsAt,
      isActive: req.body?.isActive,
    });

    return res.status(200).json({ message: "descuento actualizado", discount });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ message: error.message || "error al actualizar descuento", error: error.code });
  }
});

module.exports = router;
