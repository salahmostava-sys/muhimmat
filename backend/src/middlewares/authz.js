const { supabaseAdmin } = require("../config/supabase");

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

async function authenticateUser(req) {
  const token = extractBearerToken(req);
  if (!token) return { user: null, reason: "Missing Bearer token" };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, reason: "Invalid or expired token" };
  }

  return { user: data.user, reason: null };
}

async function getUserRole(userId) {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", String(userId))
    .maybeSingle();

  if (error) throw error;
  return data?.role || null;
}

function defaultPermissionsForRole(role) {
  const base = {
    employees: { view: false, write: false, delete: false },
    orders: { view: false, write: false, delete: false },
    attendance: { view: false, write: false },
    salary: { view: false, write: false, approve: false },
    roles: { view: false, write: false },
  };

  if (role === "admin") {
    return {
      ...base,
      employees: { view: true, write: true, delete: true },
      orders: { view: true, write: true, delete: true },
      attendance: { view: true, write: true },
      salary: { view: true, write: true, approve: true },
      roles: { view: true, write: true },
    };
  }
  if (role === "hr") {
    return {
      ...base,
      employees: { view: true, write: true, delete: false },
      orders: { view: true, write: true, delete: false },
      attendance: { view: true, write: true },
      salary: { view: true, write: false, approve: false },
      roles: { view: true, write: false },
    };
  }
  if (role === "finance" || role === "accountant") {
    return {
      ...base,
      employees: { view: true, write: false, delete: false },
      orders: { view: true, write: false, delete: false },
      attendance: { view: true, write: false },
      salary: { view: true, write: true, approve: true },
      roles: { view: true, write: false },
    };
  }
  if (role === "operations") {
    return {
      ...base,
      employees: { view: true, write: false, delete: false },
      orders: { view: true, write: true, delete: false },
      attendance: { view: true, write: true },
      salary: { view: true, write: false, approve: false },
      roles: { view: false, write: false },
    };
  }
  if (role === "viewer") {
    return {
      ...base,
      employees: { view: true, write: false, delete: false },
      orders: { view: true, write: false, delete: false },
      attendance: { view: true, write: false },
      salary: { view: true, write: false, approve: false },
      roles: { view: false, write: false },
    };
  }
  return base;
}

async function getRolePermissions(role) {
  if (!role) return null;
  const roleCandidates = role === "finance" ? ["finance", "accountant"] : [role];

  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("title, permissions")
    .in("title", roleCandidates)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.permissions || defaultPermissionsForRole(role);
}

function resolvePermission(permissions, resource, action) {
  if (!permissions || typeof permissions !== "object") return false;
  if (permissions["*"] && permissions["*"][action] === true) return true;
  return permissions[resource]?.[action] === true;
}

function requireAuth() {
  return async (req, res, next) => {
    try {
      const { user, reason } = await authenticateUser(req);
      if (!user) {
        return res.status(401).json({
          message: "Unauthorized",
          details: reason,
        });
      }

      const role = await getUserRole(user.id);
      const permissions = role ? await getRolePermissions(role) : null;
      req.user = user;
      req.userId = user.id;
      req.userRole = role;
      req.userPermissions = permissions;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function requireRoles(allowedRoles) {
  return async (req, res, next) => {
    try {
      const { user, reason } = await authenticateUser(req);
      if (!user) {
        return res.status(401).json({
          message: "Unauthorized",
          details: reason,
        });
      }

      const role = await getUserRole(user.id);
      if (!role) {
        return res.status(403).json({
          message: "Forbidden: role is not assigned to this user",
        });
      }
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ message: "Forbidden: insufficient role permissions" });
      }

      const permissions = await getRolePermissions(role);
      req.user = user;
      req.userId = user.id;
      req.userRole = role;
      req.userPermissions = permissions;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function requirePermission(permissionKey) {
  const [resource, action] = String(permissionKey || "").split(":");
  return async (req, res, next) => {
    try {
      const role = req.userRole;
      const permissions = req.userPermissions || (role ? await getRolePermissions(role) : null);

      if (!permissions) {
        return res.status(403).json({ message: "Forbidden: no permissions assigned" });
      }

      const allowed = resolvePermission(permissions, resource, action);
      if (!allowed) {
        return res.status(403).json({
          message: "Forbidden: missing permission",
          permission: permissionKey,
        });
      }

      req.userPermissions = permissions;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireAuth, requireRoles, requirePermission, authenticateUser };
