const { asyncHandler } = require("../utils/asyncHandler");
const { supabaseAdmin } = require("../config/supabase");

const me = asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user?.id || null,
      email: req.user?.email || null,
    },
    role: req.userRole || null,
    roles: req.userRoles || (req.userRole ? [req.userRole] : []),
  });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken =
    req.body?.refresh_token ||
    req.headers["x-refresh-token"] ||
    req.query?.refresh_token;

  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(400).json({ message: "Missing refresh token" });
  }

  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data?.session) {
    return res.status(401).json({
      message: "Refresh token invalid",
      details: error?.message || null,
    });
  }

  return res.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at || null,
    token_type: data.session.token_type || "bearer",
  });
});

module.exports = { me, refresh };
