/// @title EPay Role Manager
/// @notice Role-based access control for the EPay protocol
/// @dev Manages roles, permissions, and access grants
contract RoleManager {
    // State
    owner: Address;
    
    // Role definitions
    roles: map<String, RoleData>;
    
    // User role assignments
    userRoles: map<Address, map<String, Bool>>;
    
    // Track all users with a specific role
    roleMembers: map<String, map<Address, Bool>>;
    
    struct RoleData {
        name: String;
        description: String;
        permissions: map<String, Bool>;
        createdAt: Int;
    }
    
    // Events
    event RoleCreated(roleName: String, description: String);
    event RoleGranted(user: Address, role: String, granter: Address);
    event RoleRevoked(user: Address, role: String, revoker: Address);
    event PermissionAdded(role: String, permission: String);
    event PermissionRemoved(role: String, permission: String);
    
    init(owner: Address) {
        self.owner = owner;
        self.initDefaultRoles();
    }
    
    /// Initialize default roles
    fun initDefaultRoles() {
        // Admin role
        self.createRole("ADMIN", "Full system administrator access");
        self.addPermission("ADMIN", "admin.all");
        
        // Merchant role
        self.createRole("MERCHANT", "Merchant access to manage payments and invoices");
        self.addPermission("MERCHANT", "payment.create");
        self.addPermission("MERCHANT", "payment.read");
        self.addPermission("MERCHANT", "invoice.create");
        self.addPermission("MERCHANT", "invoice.read");
        self.addPermission("MERCHANT", "refund.request");
        self.addPermission("MERCHANT", "subscription.manage");
        
        // Customer role
        self.createRole("CUSTOMER", "Customer access to make payments");
        self.addPermission("CUSTOMER", "payment.create");
        self.addPermission("CUSTOMER", "payment.read");
        self.addPermission("CUSTOMER", "invoice.read");
        self.addPermission("CUSTOMER", "subscription.read");
        self.addPermission("CUSTOMER", "escrow.participate");
        
        // Verifier role
        self.createRole("VERIFIER", "Can verify merchants");
        self.addPermission("VERIFIER", "merchant.verify");
        self.addPermission("VERIFIER", "merchant.read");
        
        // Developer role
        self.createRole("DEVELOPER", "API access for developers");
        self.addPermission("DEVELOPER", "api.access");
        self.addPermission("DEVELOPER", "payment.read");
        self.addPermission("DEVELOPER", "webhook.manage");
    }
    
    /// Create a new role
    fun createRole(name: String, description: String) {
        let role: RoleData = RoleData {
            name: name,
            description: description,
            permissions: emptyMap(),
            createdAt: now()
        };
        self.roles.set(name, role);
        self.emit(RoleCreated(name, description));
    }
    
    /// Add a permission to a role
    fun addPermission(roleName: String, permission: String) {
        let role: RoleData? = self.roles.get(roleName);
        require(role != null, "Role not found");
        
        role!!.permissions.set(permission, true);
        self.roles.set(roleName, role!!);
        self.emit(PermissionAdded(roleName, permission));
    }
    
    /// Remove a permission from a role
    fun removePermission(roleName: String, permission: String) {
        let role: RoleData? = self.roles.get(roleName);
        require(role != null, "Role not found");
        
        role!!.permissions.del(permission);
        self.roles.set(roleName, role!!);
        self.emit(PermissionRemoved(roleName, permission));
    }
    
    /// Grant a role to a user
    receive("GrantRole") {
        require(sender() == self.owner || self.hasRole(sender(), "ADMIN"), "Not authorized to grant roles");
        
        // Would parse user address and role name from message
        let user: Address = sender();
        let roleName: String = "MERCHANT";
        
        // Set role for user
        let userRoleMap: map<String, Bool> = emptyMap();
        userRoleMap.set(roleName, true);
        self.userRoles.set(user, userRoleMap);
        
        // Add user to role members
        let roleMemberMap: map<Address, Bool>? = self.roleMembers.get(roleName);
        if (roleMemberMap == null) {
            roleMemberMap = emptyMap();
        }
        roleMemberMap!!.set(user, true);
        self.roleMembers.set(roleName, roleMemberMap!!);
        
        self.emit(RoleGranted(user, roleName, sender()));
    }
    
    /// Revoke a role from a user
    receive("RevokeRole") {
        require(sender() == self.owner || self.hasRole(sender(), "ADMIN"), "Not authorized to revoke roles");
        
        let user: Address = sender(); // Would come from message
        let roleName: String = "MERCHANT"; // Would come from message
        
        let userRoleMap: map<String, Bool>? = self.userRoles.get(user);
        if (userRoleMap != null) {
            userRoleMap!!.del(roleName);
            self.userRoles.set(user, userRoleMap!!);
        }
        
        let roleMemberMap: map<Address, Bool>? = self.roleMembers.get(roleName);
        if (roleMemberMap != null) {
            roleMemberMap!!.del(user);
            self.roleMembers.set(roleName, roleMemberMap!!);
        }
        
        self.emit(RoleRevoked(user, roleName, sender()));
    }
    
    /// Check if a user has a specific role
    get fun hasRole(user: Address, roleName: String): Bool {
        let userRoleMap: map<String, Bool>? = self.userRoles.get(user);
        if (userRoleMap == null) {
            return false;
        }
        return userRoleMap!!.get(roleName) == true;
    }
    
    /// Check if a user has a specific permission
    get fun hasPermission(user: Address, permission: String): Bool {
        // Check admin override
        if (self.hasRole(user, "ADMIN")) {
            return true;
        }
        
        // Check all roles for the user
        let userRoleMap: map<String, Bool>? = self.userRoles.get(user);
        if (userRoleMap == null) {
            return false;
        }
        
        // Iterate over roles (limitation: map iteration not easily done in TACT)
        // For now, check common roles
        let rolesToCheck: [String] = ["ADMIN", "MERCHANT", "CUSTOMER", "VERIFIER", "DEVELOPER"];
        
        for (roleName in rolesToCheck) {
            if (userRoleMap!!.get(roleName) == true) {
                let role: RoleData? = self.roles.get(roleName);
                if (role != null && role!!.permissions.get(permission) == true) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /// Check if role exists
    get fun roleExists(roleName: String): Bool {
        return self.roles.get(roleName) != null;
    }
    
    /// Get all members of a role
    get fun getRoleMembers(roleName: String): map<Address, Bool>? {
        return self.roleMembers.get(roleName);
    }
}
