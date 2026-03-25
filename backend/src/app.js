require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const employeesRoutes = require("./routes/employeesRoutes");
const ordersRoutes = require("./routes/ordersRoutes");
const salaryRoutes = require("./routes/salaryRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const rolesRoutes = require("./routes/rolesRoutes");
const authRoutes = require("./routes/authRoutes");
const { notFound, errorHandler } = require("./middlewares/errorHandler");
const { requireAuth } = require("./middlewares/authz");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "backend-api" });
});

app.use("/employees", requireAuth(), employeesRoutes);
app.use("/orders", requireAuth(), ordersRoutes);
app.use("/salary", requireAuth(), salaryRoutes);
app.use("/attendance", requireAuth(), attendanceRoutes);
app.use("/roles", requireAuth(), rolesRoutes);
app.use("/auth", authRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };

