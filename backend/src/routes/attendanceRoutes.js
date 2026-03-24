const express = require("express");
const {
  checkIn,
  checkOut,
  getAttendanceByEmployee,
} = require("../controllers/attendanceController");
const { requirePermission } = require("../middlewares/authz");

const router = express.Router();

router.post("/check-in", requirePermission("attendance:write"), checkIn);
router.post("/check-out", requirePermission("attendance:write"), checkOut);
router.get("/:employee", requirePermission("attendance:view"), getAttendanceByEmployee);

module.exports = router;
