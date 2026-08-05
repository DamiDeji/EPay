/// @title EPay Emergency Pause
/// @notice Provides emergency pause/unpause functionality for the entire protocol
/// @dev Access controlled with timelock for unpausing
contract EmergencyPause {
    // State
    owner: Address;
    paused: Bool;
    pauseTimestamp: Int as uint32;
    
    // Access control
    pausers: map<Address, Bool>;
    
    // Events
    event ProtocolPaused(pauser: Address, timestamp: Int);
    event ProtocolUnpaused(unpauser: Address, timestamp: Int);
    event PauserAdded(pauser: Address);
    event PauserRemoved(pauser: Address);
    
    init(owner: Address) {
        self.owner = owner;
        self.paused = false;
        self.pauseTimestamp = 0;
        self.pausers.set(owner, true); // Owner is always a pauser
    }
    
    /// Modifier to check if not paused
    get fun notPaused(): Bool {
        return self.paused == false;
    }
    
    /// Modifier to check if paused
    get fun isPaused(): Bool {
        return self.paused;
    }
    
    /// Add a new pauser
    receive("AddPauser") {
        require(sender() == self.owner, "Only owner can add pausers");
        let newPauser: Address = sender(); // Would come from message body
        self.pausers.set(newPauser, true);
        self.emit(PauserAdded(newPauser));
    }
    
    /// Remove a pauser
    receive("RemovePauser") {
        require(sender() == self.owner, "Only owner can remove pausers");
        let pauser: Address = sender(); // Would come from message body
        require(pauser != self.owner, "Cannot remove owner");
        self.pausers.del(pauser);
        self.emit(PauserRemoved(pauser));
    }
    
    /// Pause the protocol
    receive("Pause") {
        let isPauser: Bool? = self.pausers.get(sender());
        require(isPauser != null && isPauser!! == true, "Not authorized to pause");
        require(self.paused == false, "Already paused");
        
        self.paused = true;
        self.pauseTimestamp = now();
        
        self.emit(ProtocolPaused(sender(), self.pauseTimestamp));
        self.forward(sender());
    }
    
    /// Unpause the protocol
    receive("Unpause") {
        require(sender() == self.owner, "Only owner can unpause");
        require(self.paused == true, "Not paused");
        require(now() >= self.pauseTimestamp + 3600, "Must wait 1 hour after pause");
        
        self.paused = false;
        self.pauseTimestamp = 0;
        
        self.emit(ProtocolUnpaused(sender(), now()));
        self.forward(sender());
    }
    
    /// Check if an address is a pauser
    get fun isPauser(addr: Address): Bool {
        let isPauserVal: Bool? = self.pausers.get(addr);
        return isPauserVal != null && isPauserVal!! == true;
    }
}
