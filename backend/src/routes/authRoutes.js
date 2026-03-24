const express = require("express");
const { me, refresh } = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authz");

const router = express.Router();

router.post("/refresh", refresh);
router.get("/me", requireAuth(), me);

module.exports = router;
