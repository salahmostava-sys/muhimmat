const express = require("express");
const { listOrders, createOrder } = require("../controllers/ordersController");
const { requirePermission } = require("../middlewares/authz");

const router = express.Router();

router.get("/", requirePermission("orders:view"), listOrders);
router.post("/", requirePermission("orders:write"), createOrder);

module.exports = router;
