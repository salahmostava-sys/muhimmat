function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  // eslint-disable-next-line no-console
  console.error(err.stack || err);
  res.status(status).json({
    error: status === 500 ? "Internal Server Error" : "Request Failed",
    message: err.message || "Internal server error",
    details: err.message || null,
  });
}

module.exports = { notFound, errorHandler };
