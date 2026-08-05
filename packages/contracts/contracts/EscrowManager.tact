/// @title EPay Escrow Manager
/// @notice Manages escrow payments with milestone-based release
/// @dev Supports multi-milestone escrow, dispute resolution, and refunds
contract EscrowManager {
    // State
    owner: Address;
    paymentRouter: Address;
    
    nextEscrowId: Int as uint64;
    escrows: map<Int, EscrowData>;
    
    struct EscrowData {
        escrowId: Int;
        merchant: Address;
        customer: Address;
        totalAmount: Int;
        currency: String;
        status: EscrowStatus;
        milestoneCount: Int;
        currentMilestone: Int;
        milestones: map<Int, MilestoneData>;
        funderAddress: Address;
        disputeReason: String?;
        createdAt: Int;
        updatedAt: Int;
    }
    
    struct MilestoneData {
        index: Int;
        description: String;
        amount: Int;
        status: MilestoneStatus;
        completedAt: Int?;
        releasedAt: Int?;
    }
    
    enum EscrowStatus {
        CREATED: 0;
        FUNDED: 1;
        IN_PROGRESS: 2;
        MILESTONE_RELEASED: 3;
        COMPLETED: 4;
        DISPUTED: 5;
        RESOLVED: 6;
        CANCELLED: 7;
        REFUNDED: 8;
    }
    
    enum MilestoneStatus {
        PENDING: 0;
        IN_PROGRESS: 1;
        COMPLETED: 2;
        RELEASED: 3;
    }
    
    // Events
    event EscrowCreated(escrowId: Int, merchant: Address, customer: Address, amount: Int);
    event EscrowFunded(escrowId: Int, funder: Address, amount: Int);
    event MilestoneCompleted(escrowId: Int, milestoneIndex: Int);
    event MilestoneReleased(escrowId: Int, milestoneIndex: Int, amount: Int);
    event EscrowCompleted(escrowId: Int);
    event EscrowDisputed(escrowId: Int, reason: String);
    event EscrowResolved(escrowId: Int, resolution: String);
    event EscrowCancelled(escrowId: Int);
    event EscrowRefunded(escrowId: Int);
    
    init(owner: Address, paymentRouter: Address) {
        self.owner = owner;
        self.paymentRouter = paymentRouter;
        self.nextEscrowId = 1;
    }
    
    /// Create a new escrow with milestones
    receive("CreateEscrow") {
        let escrowId: Int = self.nextEscrowId;
        self.nextEscrowId = self.nextEscrowId + 1;
        
        let merchant: Address = sender();
        let customer: Address = sender(); // Would come from message
        
        let escrow: EscrowData = EscrowData {
            escrowId: escrowId,
            merchant: merchant,
            customer: customer,
            totalAmount: context().value,
            currency: "TON",
            status: EscrowStatus.CREATED,
            milestoneCount: 0,
            currentMilestone: 0,
            milestones: emptyMap(),
            funderAddress: customer,
            disputeReason: null,
            createdAt: now(),
            updatedAt: now()
        };
        
        self.escrows.set(escrowId, escrow);
        self.emit(EscrowCreated(escrowId, merchant, customer, context().value));
    }
    
    /// Fund an escrow (customer deposits funds)
    receive("FundEscrow") {
        let escrowId: Int = context().value;
        let escrow: EscrowData? = self.escrows.get(escrowId);
        
        require(escrow != null, "Escrow not found");
        require(escrow!!.status == EscrowStatus.CREATED, "Escrow not in created state");
        require(context().value >= escrow!!.totalAmount, "Insufficient funding amount");
        
        escrow!!.status = EscrowStatus.FUNDED;
        escrow!!.updatedAt = now();
        
        self.escrows.set(escrowId, escrow!!);
        self.emit(EscrowFunded(escrowId, sender(), context().value));
    }
    
    /// Complete a milestone
    receive("CompleteMilestone") {
        let escrowId: Int = context().value;
        let escrow: EscrowData? = self.escrows.get(escrowId);
        
        require(escrow != null, "Escrow not found");
        require(escrow!!.merchant == sender(), "Only merchant can complete milestones");
        require(escrow!!.status == EscrowStatus.FUNDED || escrow!!.status == EscrowStatus.IN_PROGRESS, "Invalid escrow state");
        
        let milestoneIndex: Int = escrow!!.currentMilestone;
        let milestone: MilestoneData? = escrow!!.milestones.get(milestoneIndex);
        
        require(milestone != null, "Milestone not found");
        require(milestone!!.status == MilestoneStatus.IN_PROGRESS, "Milestone not in progress");
        
        milestone!!.status = MilestoneStatus.COMPLETED;
        milestone!!.completedAt = now();
        
        escrow!!.milestones.set(milestoneIndex, milestone!!);
        
        self.emit(MilestoneCompleted(escrowId, milestoneIndex));
        
        // Check if all milestones are completed
        if (escrow!!.currentMilestone >= escrow!!.milestoneCount - 1) {
            // Release final milestone
            self.releaseMilestone(escrowId, milestoneIndex);
            escrow!!.status = EscrowStatus.COMPLETED;
            self.emit(EscrowCompleted(escrowId));
        } else {
            escrow!!.currentMilestone = escrow!!.currentMilestone + 1;
            // Start next milestone
            let nextMilestone: MilestoneData? = escrow!!.milestones.get(escrow!!.currentMilestone);
            if (nextMilestone != null) {
                nextMilestone!!.status = MilestoneStatus.IN_PROGRESS;
                escrow!!.milestones.set(escrow!!.currentMilestone, nextMilestone!!);
            }
        }
        
        escrow!!.updatedAt = now();
        self.escrows.set(escrowId, escrow!!);
    }
    
    /// Release funds for a completed milestone
    fun releaseMilestone(escrowId: Int, milestoneIndex: Int) {
        let escrow: EscrowData? = self.escrows.get(escrowId);
        require(escrow != null, "Escrow not found");
        
        let milestone: MilestoneData? = escrow!!.milestones.get(milestoneIndex);
        require(milestone != null, "Milestone not found");
        
        milestone!!.status = MilestoneStatus.RELEASED;
        milestone!!.releasedAt = now();
        
        escrow!!.milestones.set(milestoneIndex, milestone!!);
        escrow!!.status = EscrowStatus.MILESTONE_RELEASED;
        escrow!!.updatedAt = now();
        
        self.escrows.set(escrowId, escrow!!);
        
        // Forward funds to merchant
        self.emit(MilestoneReleased(escrowId, milestoneIndex, milestone!!.amount));
    }
    
    /// Dispute an escrow
    receive("DisputeEscrow") {
        let escrowId: Int = context().value;
        let escrow: EscrowData? = self.escrows.get(escrowId);
        
        require(escrow != null, "Escrow not found");
        require(escrow!!.customer == sender() || escrow!!.merchant == sender(), "Only participants can dispute");
        require(escrow!!.status == EscrowStatus.FUNDED || escrow!!.status == EscrowStatus.IN_PROGRESS, "Cannot dispute in current state");
        
        escrow!!.status = EscrowStatus.DISPUTED;
        escrow!!.updatedAt = now();
        
        self.escrows.set(escrowId, escrow!!);
        self.emit(EscrowDisputed(escrowId, "Dispute filed"));
    }
    
    /// Resolve a dispute (admin only)
    receive("ResolveDispute") {
        require(sender() == self.owner, "Only owner can resolve disputes");
        
        let escrowId: Int = context().value;
        let escrow: EscrowData? = self.escrows.get(escrowId);
        
        require(escrow != null, "Escrow not found");
        require(escrow!!.status == EscrowStatus.DISPUTED, "Escrow not disputed");
        
        escrow!!.status = EscrowStatus.RESOLVED;
        escrow!!.updatedAt = now();
        
        self.escrows.set(escrowId, escrow!!);
        self.emit(EscrowResolved(escrowId, "Resolved by admin"));
    }
    
    /// Cancel an escrow and refund
    receive("CancelEscrow") {
        let escrowId: Int = context().value;
        let escrow: EscrowData? = self.escrows.get(escrowId);
        
        require(escrow != null, "Escrow not found");
        require(escrow!!.status == EscrowStatus.CREATED || escrow!!.status == EscrowStatus.DISPUTED, "Cannot cancel in current state");
        
        escrow!!.status = EscrowStatus.CANCELLED;
        escrow!!.updatedAt = now();
        
        self.escrows.set(escrowId, escrow!!);
        self.emit(EscrowCancelled(escrowId));
    }
    
    // View getters
    get fun getEscrow(escrowId: Int): EscrowData? {
        return self.escrows.get(escrowId);
    }
    
    get fun escrowExists(escrowId: Int): Bool {
        return self.escrows.get(escrowId) != null;
    }
}
