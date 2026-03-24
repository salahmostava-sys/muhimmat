const express = require("express");
const {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} = require("../controllers/employeesController");
const { requirePermission } = require("../middlewares/authz");

const router = express.Router();

router.get("/", requirePermission("employees:view"), listEmployees);
router.post("/", requirePermission("employees:write"), createEmployee);
router.put("/:id", requirePermission("employees:write"), updateEmployee);
router.delete("/:id", requirePermission("employees:delete"), deleteEmployee);

module.exports = router;
