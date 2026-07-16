const ROLE_PERMISSIONS = {
  'Super Admin': ['*'], // All permissions
  'Admin': ['reports:read', 'checklist:read'], // Reports access only
  'Lead-Auditor': ['roster:read', 'roster:write', 'checklist:read'],
  'Auditor': ['checklist:read', 'checklist:write'],
  'Manager': ['checklist:read', 'checklist:review'],
  'Supervisor': ['checklist:read', 'checklist:supervise']
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role_name;
    
    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];
    
    if (userPermissions.includes('*') || userPermissions.includes(permission)) {
      return next();
    }
    
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

module.exports = { requirePermission, ROLE_PERMISSIONS };