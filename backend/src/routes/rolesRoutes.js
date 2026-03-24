const express = require("express");
const { listRoles } = require("../controllers/rolesController");
const { requirePermission } = require("../middlewares/authz");

const router = express.Router();

router.get("/", requirePermission("roles:view"), listRoles);

module.exports = router;
