/// @title EPay Fee Manager
/// @notice Manages fee calculation, collection, and distribution
/// @dev Integrates with ConfigurationManager for fee parameters
contract FeeManager {
    // State
    owner: Address;
    configManager: Address;
    
    // Fee tiers based on volume
    feeTiers: map<Int, Int>; // volume threshold -> fee bps
    
    // Merchant custom fee rates
    merchantFees: map<Address, Int>; // merchant address -> custom fee bps
    
    // Total fees collected
    totalFeesCollected: Int as coins;
    
    // Events
    event FeeCollected(from: Address, amount: Int, fee: Int);
    event FeeTierUpdated(threshold: Int, feeBps: Int);
    event MerchantFeeSet(merchant: Address, feeBps: Int);
    
    init(owner: Address, configManager: Address) {
        self.owner = owner;
        self.configManager = configManager;
        self.totalFeesCollected = 0;
        
        // Default fee tiers
        self.feeTiers.set(ton("0"), 50);       // 0.5% for < 100 TON
        self.feeTiers.set(ton("100"), 40);      // 0.4% for 100-1000 TON
        self.feeTiers.set(ton("1000"), 30);     // 0.3% for 1000-10000 TON
        self.feeTiers.set(ton("10000"), 20);    // 0.2% for 10000+ TON
    }
    
    /// Calculate the fee for a given amount
    get fun calculateFee(amount: Int, merchant: Address): Int {
        let feeBps: Int = self.getMerchantFeeBps(merchant);
        let fee: Int = (amount * feeBps) / 10000;
        return fee;
    }
    
    /// Get the fee in basis points for a merchant
    get fun getMerchantFeeBps(merchant: Address): Int {
        // Check if merchant has a custom fee rate
        let customFee: Int? = self.merchantFees.get(merchant);
        if (customFee != null) {
            return customFee!!;
        }
        
        // Fall back to default fee from config manager
        // In production, this would call ConfigurationManager
        let defaultFee: Int = 50;
        return defaultFee;
    }
    
    /// Collect fee from a payment
    receive("CollectFee") {
        let amount: Int = context().value;
        let merchant: Address = sender();
        let fee: Int = self.calculateFee(amount, merchant);
        
        self.totalFeesCollected = self.totalFeesCollected + fee;
        self.emit(FeeCollected(merchant, amount, fee));
    }
    
    /// Set a custom fee rate for a merchant
    receive("SetMerchantFee") {
        require(sender() == self.owner, "Only owner can set merchant fees");
        
        // Parse merchant address and fee from the message
        // In production, this would use proper message parsing
        let merchant: Address = sender();
        let feeBps: Int = 50; // Would come from message body
        
        self.merchantFees.set(merchant, feeBps);
        self.emit(MerchantFeeSet(merchant, feeBps));
    }
    
    /// Remove custom fee rate for a merchant
    receive("RemoveMerchantFee") {
        require(sender() == self.owner, "Only owner can remove merchant fees");
        
        let merchant: Address = sender(); // Would come from message body
        self.merchantFees.del(merchant);
    }
    
    /// Get total fees collected
    get fun totalFeesCollected(): Int {
        return self.totalFeesCollected;
    }
}
