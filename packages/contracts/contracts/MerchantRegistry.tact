/// @title EPay Merchant Registry
/// @notice Manages merchant registration, verification, and profiles
/// @dev Handles the full merchant lifecycle from onboarding to deactivation
contract MerchantRegistry {
    // State
    owner: Address;
    
    // Merchant tracking
    nextMerchantId: Int as uint64;
    merchants: map<Int, MerchantData>;
    merchantByAddress: map<Address, Int>;
    
    // Verification
    verifiers: map<Address, Bool>;
    
    // Merchant Data Structure
    struct MerchantData {
        merchantId: Int;
        owner: Address;
        businessName: String;
        businessEmail: String;
        businessUrl: String?;
        status: MerchantStatus;
        verificationLevel: VerificationLevel;
        settlementAddress: Address;
        webhookUrl: String?;
        feeBps: Int;
        createdAt: Int;
        updatedAt: Int;
    }
    
    enum MerchantStatus {
        PENDING: 0;
        ACTIVE: 1;
        SUSPENDED: 2;
        REJECTED: 3;
        INACTIVE: 4;
    }
    
    enum VerificationLevel {
        NONE: 0;
        BASIC: 1;
        VERIFIED: 2;
        ENTERPRISE: 3;
    }
    
    // Events
    event MerchantRegistered(merchantId: Int, owner: Address, businessName: String);
    event MerchantVerified(merchantId: Int, level: VerificationLevel);
    event MerchantSuspended(merchantId: Int, reason: String);
    event MerchantReactivated(merchantId: Int);
    event SettlementAddressUpdated(merchantId: Int, oldAddress: Address, newAddress: Address);
    
    init(owner: Address) {
        self.owner = owner;
        self.nextMerchantId = 1;
        self.verifiers.set(owner, true);
    }
    
    /// Register a new merchant
    receive("RegisterMerchant") {
        let merchantId: Int = self.nextMerchantId;
        self.nextMerchantId = self.nextMerchantId + 1;
        
        // Check if address already has a merchant
        let existingId: Int? = self.merchantByAddress.get(sender());
        require(existingId == null, "Address already registered");
        
        // Parse merchant data from message
        let businessName: String = "New Merchant"; // Would come from message
        let businessEmail: String = "merchant@email.com"; // Would come from message
        let settlementAddress: Address = sender();
        
        let merchant: MerchantData = MerchantData {
            merchantId: merchantId,
            owner: sender(),
            businessName: businessName,
            businessEmail: businessEmail,
            businessUrl: null,
            status: MerchantStatus.PENDING,
            verificationLevel: VerificationLevel.NONE,
            settlementAddress: settlementAddress,
            webhookUrl: null,
            feeBps: 50,
            createdAt: now(),
            updatedAt: now()
        };
        
        self.merchants.set(merchantId, merchant);
        self.merchantByAddress.set(sender(), merchantId);
        
        self.emit(MerchantRegistered(merchantId, sender(), businessName));
    }
    
    /// Verify a merchant
    receive("VerifyMerchant") {
        require(self.verifiers.get(sender()) == true, "Not authorized to verify merchants");
        
        let merchantId: Int = context().value;
        let merchant: MerchantData? = self.merchants.get(merchantId);
        
        require(merchant != null, "Merchant not found");
        require(merchant!!.status == MerchantStatus.PENDING, "Merchant not in pending state");
        
        merchant!!.status = MerchantStatus.ACTIVE;
        merchant!!.verificationLevel = VerificationLevel.VERIFIED;
        merchant!!.updatedAt = now();
        
        self.merchants.set(merchantId, merchant!!);
        self.emit(MerchantVerified(merchantId, VerificationLevel.VERIFIED));
    }
    
    /// Suspend a merchant
    receive("SuspendMerchant") {
        require(sender() == self.owner || self.verifiers.get(sender()) == true, "Not authorized");
        
        let merchantId: Int = context().value;
        let merchant: MerchantData? = self.merchants.get(merchantId);
        
        require(merchant != null, "Merchant not found");
        require(merchant!!.status == MerchantStatus.ACTIVE, "Can only suspend active merchants");
        
        merchant!!.status = MerchantStatus.SUSPENDED;
        merchant!!.updatedAt = now();
        
        self.merchants.set(merchantId, merchant!!);
        self.emit(MerchantSuspended(merchantId, "Violation"));
    }
    
    /// Reactivate a suspended merchant
    receive("ReactivateMerchant") {
        require(sender() == self.owner || self.verifiers.get(sender()) == true, "Not authorized");
        
        let merchantId: Int = context().value;
        let merchant: MerchantData? = self.merchants.get(merchantId);
        
        require(merchant != null, "Merchant not found");
        require(merchant!!.status == MerchantStatus.SUSPENDED, "Merchant not suspended");
        
        merchant!!.status = MerchantStatus.ACTIVE;
        merchant!!.updatedAt = now();
        
        self.merchants.set(merchantId, merchant!!);
        self.emit(MerchantReactivated(merchantId));
    }
    
    /// Update settlement address
    receive("UpdateSettlementAddress") {
        let merchantId: Int = self.merchantByAddress.get(sender())!!;
        let merchant: MerchantData? = self.merchants.get(merchantId);
        
        require(merchant != null, "Merchant not found");
        
        let oldAddress: Address = merchant!!.settlementAddress;
        merchant!!.settlementAddress = context().value; // Would be the new address
        merchant!!.updatedAt = now();
        
        self.merchants.set(merchantId, merchant!!);
        self.emit(SettlementAddressUpdated(merchantId, oldAddress, merchant!!.settlementAddress));
    }
    
    /// Add verifier
    receive("AddVerifier") {
        require(sender() == self.owner, "Only owner can add verifiers");
        let newVerifier: Address = context().value; // Would come from message
        self.verifiers.set(newVerifier, true);
    }
    
    /// Remove verifier
    receive("RemoveVerifier") {
        require(sender() == self.owner, "Only owner can remove verifiers");
        let verifier: Address = context().value; // Would come from message
        self.verifiers.del(verifier);
    }
    
    // View getters
    get fun isMerchant(address: Address): Bool {
        return self.merchantByAddress.get(address) != null;
    }
    
    get fun getMerchant(merchantId: Int): MerchantData? {
        return self.merchants.get(merchantId);
    }
    
    get fun getMerchantByAddress(address: Address): MerchantData? {
        let merchantId: Int? = self.merchantByAddress.get(address);
        if (merchantId == null) {
            return null;
        }
        return self.merchants.get(merchantId!!);
    }
    
    get fun isMerchantActive(address: Address): Bool {
        let merchant: MerchantData? = self.getMerchantByAddress(address);
        if (merchant == null) {
            return false;
        }
        return merchant!!.status == MerchantStatus.ACTIVE;
    }
}
