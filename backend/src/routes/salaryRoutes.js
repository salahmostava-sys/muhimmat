const express = require("express");
const { calcSalary } = require("../controllers/salaryController");
const { requirePermission } = require("../middlewares/authz");

const router = express.Router();

router.get("/calc", requirePermission("salary:approve"), calcSalary);

module.exports = router;
