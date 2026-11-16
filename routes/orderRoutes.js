import express from "express";
import { getBuyerOrders, getVendorOrders, updateOrderStatus, hideOrder } from "../controllers/orderController.js";
import { requireUserAuth } from "../middleware/userAuth.js";

const router = express.Router();

router.get("/my", requireUserAuth, getBuyerOrders);
router.get("/vendor", requireUserAuth, getVendorOrders);
router.patch("/:id/status", requireUserAuth, updateOrderStatus);
router.patch("/:id/hide", requireUserAuth, hideOrder);

export default router;