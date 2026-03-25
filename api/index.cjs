const { app } = require("../backend/src/app");

module.exports = (req, res) => {
  // Mount Express app at /api
  req.url = req.url.replace(/^\/api/, "") || "/";
  return app(req, res);
};

