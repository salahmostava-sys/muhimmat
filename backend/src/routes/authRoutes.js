const express = require("express");
const { me } = require("../controllers/authController");

const router = express.Router();

router.get("/me", me);

module.exports = router;
