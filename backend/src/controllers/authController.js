const { asyncHandler } = require("../utils/asyncHandler");

const me = asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user?.id || null,
      email: req.user?.email || null,
    },
    role: req.userRole || null,
  });
});

module.exports = { me };
