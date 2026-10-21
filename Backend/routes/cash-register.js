const express = require("express");
const prisma = require("../lib/prisma");
const { parseSessionToken } = require("../lib/session-token");
const { getRegister, openRegister, closeRegister } = require("../services/cash-register.service");
const router = express.Router();
router.use(async (req, res, next) => {
  try {
    const header = String(req.headers.authorization || "");
    const session = parseSessionToken(header.startsWith("Bearer ") ? header.slice(7).trim() : "");
    if (!session) return res.status(401).json({ message: "token invalido o expirado" });
    const user = await prisma.user.findUnique({ where: { id: Number(session.userId) }, select: { id: true, tenantId: true } });
    if (!user || (session.tenantId && session.tenantId !== user.tenantId)) return res.status(401).json({ message: "usuario autenticado no encontrado" });
    req.registerAuth = { tenantId: user.tenantId, userId: user.id };
    next();
  } catch (error) { next(error); }
});
router.get("/", async (req, res, next) => {
  try {
    const branchId = String(req.query.branchId || "").trim();
    if (!branchId) return res.status(400).json({ message: "branchId es requerido" });
    res.json(await getRegister({ ...req.registerAuth, branchId }));
  } catch (error) { next(error); }
});
router.get("/report", async (req, res, next) => {
  try {
    const { getCashReport } = require("../services/cash-report.service");
    res.json(await getCashReport({ ...req.registerAuth, branchId: String(req.query.branchId || "").trim() || undefined,
      from: req.query.from, to: req.query.to, page: req.query.page === undefined ? 1 : Number(req.query.page) }));
  } catch (error) { next(error); }
});
router.post("/open", async (req, res, next) => {
  try {
    const branchId = String(req.body?.branchId || "").trim();
    if (!branchId) return res.status(400).json({ message: "branchId es requerido" });
    const session = await openRegister({ ...req.registerAuth, branchId, openingBalance: req.body?.openingBalance });
    res.status(201).json({ session });
  } catch (error) { next(error); }
});
router.post("/:id/close", async (req, res, next) => {
  try {
    const branchId = String(req.body?.branchId || "").trim();
    if (!branchId) return res.status(400).json({ message: "branchId es requerido" });
    const session = await closeRegister({ ...req.registerAuth, branchId, sessionId: req.params.id, countedCash: req.body?.countedCash });
    res.json({ session });
  } catch (error) { next(error); }
});
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status || (error.code === "P2002" ? 409 : 500)).json({ message: error.status ? error.message : "No se pudo completar la operacion de caja." });
});
module.exports = router;
