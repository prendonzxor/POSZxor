const express = require("express");
const {
  getActiveSubscriptionPlans,
  getActiveSubscriptionPlanByCode,
} = require("../services/subscription-plan.service");
const { validateSubscriptionCouponPreview } = require("../services/promotion.service");

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SubscriptionPlan:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "fb0b6d90-6f40-43fe-a751-4fdcbf884d96"
 *         code:
 *           type: string
 *           example: "FREE"
 *         name:
 *           type: string
 *           example: "Gratis"
 *         priceMxn:
 *           type: number
 *           example: 0
 *         mercadoPagoPreapprovalPlanId:
 *           type: string
 *           nullable: true
 *           example: "906d73e0a200422c98d6eec7c293311b"
 *         billingPeriod:
 *           type: string
 *           example: "trial"
 *         description:
 *           type: string
 *           example: "Plan gratis por 15 dias para probar POS Zxor"
 *         badge:
 *           type: string
 *           nullable: true
 *           example: "15 DIAS GRATIS"
 *         recommendation:
 *           type: string
 *           nullable: true
 *           example: "Ideal para explorar el producto antes de elegir un plan de pago"
 *         sortOrder:
 *           type: integer
 *           example: 0
 *         trialDays:
 *           type: integer
 *           nullable: true
 *           example: 15
 *         limitsUsers:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         limitsBranches:
 *           type: integer
 *           nullable: true
 *           example: 1
 *         limitsOrdersPerMonth:
 *           type: integer
 *           nullable: true
 *           example: 300
 *         limitsProducts:
 *           type: integer
 *           nullable: true
 *           example: 100
 *         isUnlimitedUsers:
 *           type: boolean
 *           example: false
 *         isUnlimitedBranches:
 *           type: boolean
 *           example: false
 *         isUnlimitedOrders:
 *           type: boolean
 *           example: false
 *         isUnlimitedProducts:
 *           type: boolean
 *           example: false
 *         features:
 *           type: array
 *           items:
 *             type: string
 *           example:
 *             - "Prueba gratis por 15 dias"
 *             - "POS (ventas)"
 *             - "Reportes basicos"
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
 *     SubscriptionPlansListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "planes obtenidos"
 *         plans:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SubscriptionPlan'
 *     SubscriptionPricingPreviewRequest:
 *       type: object
 *       required:
 *         - planCode
 *       properties:
 *         planCode:
 *           type: string
 *           example: "PRO"
 *         couponCode:
 *           type: string
 *           nullable: true
 *           example: "BIENVENIDA10"
 *     SubscriptionPricingPreviewResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "preview calculado"
 *         plan:
 *           $ref: '#/components/schemas/SubscriptionPlan'
 *         pricing:
 *           type: object
 *           properties:
 *             originalAmount:
 *               type: number
 *               example: 399
 *             discountAmount:
 *               type: number
 *               example: 39.9
 *             finalAmount:
 *               type: number
 *               example: 359.1
 *             couponCode:
 *               type: string
 *               nullable: true
 *               example: "BIENVENIDA10"
 *             isDiscountApplied:
 *               type: boolean
 *               example: true
 *             reason:
 *               type: string
 *               nullable: true
 *               example: null
 */

/**
 * @swagger
 * /api/subscription-plans:
 *   get:
 *     tags:
 *       - Subscription Plans
 *     summary: Obtener planes de suscripcion activos
 *     responses:
 *       200:
 *         description: Planes obtenidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionPlansListResponse'
 *       500:
 *         description: Error del servidor
 */
router.get("/", async (_req, res) => {
  try {
    const plans = await getActiveSubscriptionPlans();
    return res.status(200).json({
      message: "planes obtenidos",
      plans,
    });
  } catch (error) {
    return res.status(500).json({
      message: "error al obtener planes",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/subscription-plans/pricing-preview:
 *   post:
 *     tags:
 *       - Subscription Plans
 *     summary: Obtener preview de precio de suscripcion aplicando un cupon global
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubscriptionPricingPreviewRequest'
 *     responses:
 *       200:
 *         description: Preview calculado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionPricingPreviewResponse'
 *       400:
 *         description: Error de validacion
 */
router.post("/pricing-preview", async (req, res) => {
  try {
    const planCode = String(req.body?.planCode || "").trim().toUpperCase();
    const couponCode = String(req.body?.couponCode || "").trim().toUpperCase();

    if (!planCode) {
      return res.status(400).json({ message: "planCode es requerido" });
    }

    const plan = await getActiveSubscriptionPlanByCode(planCode);
    if (!plan) {
      return res.status(404).json({ message: "plan no encontrado" });
    }

    const originalAmount = Number(plan.priceMxn || 0);
    const validation = couponCode
      ? await validateSubscriptionCouponPreview({
          planCode,
          code: couponCode,
          subtotal: originalAmount,
        })
      : {
          isValid: false,
          reason: null,
          coupon: null,
          discountAmount: 0,
          finalSubtotal: originalAmount,
        };

    return res.status(200).json({
      message: "preview calculado",
      plan,
      pricing: {
        originalAmount,
        discountAmount: Number(validation.discountAmount || 0),
        finalAmount: Number(validation.finalSubtotal || originalAmount),
        couponCode: validation.isValid ? couponCode : null,
        isDiscountApplied: Boolean(validation.isValid),
        reason: validation.reason || null,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "error al calcular preview",
      error: error.code,
    });
  }
});

module.exports = router;
