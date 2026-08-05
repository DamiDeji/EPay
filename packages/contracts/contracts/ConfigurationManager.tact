/// @title EPay Configuration Manager
/// @notice Stores and manages global configuration parameters for the EPay protocol
/// @dev Only the contract owner (governance) can update configuration values
contract ConfigurationManager {
    // State
    owner: Address;
    paused: Bool;
    
    // Fee configuration (basis points, 50 = 0.5%)
    defaultFeeBps: Int as uint16;
    maxFeeBps: Int as uint16;
    
    // Treasury address where fees are collected
    treasuryAddress: Address;
    
    // Settlement configuration
    settlementMinAmount: Int as coins;
    settlementPeriod: Int as uint32; // in seconds
    
    // Payment configuration
    paymentExpiryTime: Int as uint32; // in seconds
    minPaymentAmount: Int as coins;
    
    // Protocol version
    protocolVersion: Int as uint32;
    
    // Events
    event ConfigUpdated(key: String, oldValue: Int, newValue: Int);
    event TreasuryAddressChanged(oldAddress: Address, newAddress: Address);
    event PauseStateChanged(paused: Bool);
    
    /// Initialize the configuration with default values
    init(owner: Address) {
        self.owner = owner;
        self.paused = false;
        self.defaultFeeBps = 50;
        self.maxFeeBps = 500;
        self.treasuryAddress = owner; // Initially the owner
        self.settlementMinAmount = ton("1");
        self.settlementPeriod = 86400; // 24 hours
        self.paymentExpiryTime = 3600; // 1 hour
        self.minPaymentAmount = ton("0.01");
        self.protocolVersion = 1;
    }
    
    /// Modifier to ensure only the owner can call certain functions
    receive("SetDefaultFeeBps") {
        require(self.paused == false, "Protocol is paused");
        require(sender() == self.owner, "Only owner can set fee");
        
        let newFee: Int = context().value;
        require(newFee >= 0, "Fee cannot be negative");
        require(newFee <= self.maxFeeBps, "Fee exceeds maximum allowed");
        
        let oldFee: Int = self.defaultFeeBps;
        self.defaultFeeBps = newFee;
        
        self.emit(ConfigUpdated("defaultFeeBps", oldFee, newFee));
        self.forward(sender());
    }
    
    receive("SetTreasuryAddress") {
        require(sender() == self.owner, "Only owner can set treasury address");
        
        let oldAddress: Address = self.treasuryAddress;
        self.treasuryAddress = context().value;
        
        self.emit(TreasuryAddressChanged(oldAddress, self.treasuryAddress));
        self.forward(sender());
    }
    
    receive("SetPaymentExpiryTime") {
        require(sender() == self.owner, "Only owner can set expiry time");
        let newValue: Int = context().value;
        let oldValue: Int = self.paymentExpiryTime;
        self.paymentExpiryTime = newValue;
        self.emit(ConfigUpdated("paymentExpiryTime", oldValue, newValue));
        self.forward(sender());
    }
    
    receive("SetMinPaymentAmount") {
        require(sender() == self.owner, "Only owner can set minimum payment");
        let newValue: Int = context().value;
        let oldValue: Int = self.minPaymentAmount;
        self.minPaymentAmount = newValue;
        self.emit(ConfigUpdated("minPaymentAmount", oldValue, newValue));
        self.forward(sender());
    }
    
    receive("Pause") {
        require(sender() == self.owner, "Only owner can pause");
        require(self.paused == false, "Already paused");
        self.paused = true;
        self.emit(PauseStateChanged(true));
        self.forward(sender());
    }
    
    receive("Unpause") {
        require(sender() == self.owner, "Only owner can unpause");
        require(self.paused == true, "Not paused");
        self.paused = false;
        self.emit(PauseStateChanged(false));
        self.forward(sender());
    }
    
    receive("TransferOwnership") {
        require(sender() == self.owner, "Only owner can transfer ownership");
        self.owner = context().value;
        self.forward(sender());
    }
    
    // View getters
    get fun paused(): Bool {
        return self.paused;
    }
    
    get fun defaultFeeBps(): Int {
        return self.defaultFeeBps;
    }
    
    get fun treasuryAddress(): Address {
        return self.treasuryAddress;
    }
    
    get fun paymentExpiryTime(): Int {
        return self.paymentExpiryTime;
    }
    
    get fun minPaymentAmount(): Int {
        return self.minPaymentAmount;
    }
}
