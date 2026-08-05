/// @title EPay Refund Manager
/// @notice Manages payment refunds including partial refunds
/// @dev Tracks refund status and ensures refunds are processed correctly
contract RefundManager {
    // State
    owner: Address;
    paymentRouter: Address;
    
    nextRefundId: Int as uint64;
    refunds: map<Int, RefundData>;
    paymentRefunds: map<Int, Int>; // paymentId -> refundId
    
    struct RefundData {
        refundId: Int;
        paymentId: Int;
        merchant: Address;
        amount: Int;
        originalAmount: Int;
        currency: String;
        status: RefundStatus;
        reason: String;
        isPartial: Bool;
        processedAt: Int?;
        createdAt: Int;
        updatedAt: Int;
    }
    
    enum RefundStatus {
        REQUESTED: 0;
        APPROVED: 1;
        PROCESSING: 2;
        COMPLETED: 3;
        REJECTED: 4;
        FAILED: 5;
    }
    
    // Events
    event RefundRequested(refundId: Int, paymentId: Int, amount: Int, reason: String);
    event RefundApproved(refundId: Int);
    event RefundCompleted(refundId: Int, txHash: String);
    event RefundRejected(refundId: Int, reason: String);
    event RefundFailed(refundId: Int, reason: String);
    
    init(owner: Address, paymentRouter: Address) {
        self.owner = owner;
        self.paymentRouter = paymentRouter;
        self.nextRefundId = 1;
    }
    
    /// Request a refund
    receive("RequestRefund") {
        let refundId: Int = self.nextRefundId;
        self.nextRefundId = self.nextRefundId + 1;
        
        let paymentId: Int = context().value; // Would come from message
        let reason: String = "Customer requested"; // Would come from message
        
        // Check no existing refund for this payment
        let existingRefund: Int? = self.paymentRefunds.get(paymentId);
        require(existingRefund == null, "Refund already exists for this payment");
        
        let refund: RefundData = RefundData {
            refundId: refundId,
            paymentId: paymentId,
            merchant: sender(),
            amount: context().value, // Would be the refund amount
            originalAmount: context().value, // Would be the original payment amount
            currency: "TON",
            status: RefundStatus.REQUESTED,
            reason: reason,
            isPartial: false,
            processedAt: null,
            createdAt: now(),
            updatedAt: now()
        };
        
        // Determine if partial refund
        if (refund.amount < refund.originalAmount) {
            refund.isPartial = true;
        }
        
        self.refunds.set(refundId, refund);
        self.paymentRefunds.set(paymentId, refundId);
        
        self.emit(RefundRequested(refundId, paymentId, refund.amount, reason));
    }
    
    /// Approve a refund
    receive("ApproveRefund") {
        let refundId: Int = context().value;
        let refund: RefundData? = self.refunds.get(refundId);
        
        require(refund != null, "Refund not found");
        require(refund!!.status == RefundStatus.REQUESTED, "Refund not in requested state");
        require(sender() == self.owner || sender() == refund!!.merchant, "Not authorized");
        
        refund!!.status = RefundStatus.APPROVED;
        refund!!.updatedAt = now();
        
        self.refunds.set(refundId, refund!!);
        self.emit(RefundApproved(refundId));
    }
    
    /// Process and complete a refund
    receive("ProcessRefund") {
        let refundId: Int = context().value;
        let refund: RefundData? = self.refunds.get(refundId);
        
        require(refund != null, "Refund not found");
        require(refund!!.status == RefundStatus.APPROVED, "Refund not approved");
        
        refund!!.status = RefundStatus.PROCESSING;
        self.refunds.set(refundId, refund!!);
        
        // In production, this would interact with PaymentRouter to reverse the payment
        // Forward funds back to the original payer
        
        refund!!.status = RefundStatus.COMPLETED;
        refund!!.processedAt = now();
        refund!!.updatedAt = now();
        
        self.refunds.set(refundId, refund!!);
        self.emit(RefundCompleted(refundId, "refund_processed"));
    }
    
    /// Reject a refund request
    receive("RejectRefund") {
        let refundId: Int = context().value;
        let refund: RefundData? = self.refunds.get(refundId);
        
        require(refund != null, "Refund not found");
        require(refund!!.status == RefundStatus.REQUESTED, "Refund not in requested state");
        require(sender() == self.owner || sender() == refund!!.merchant, "Not authorized");
        
        refund!!.status = RefundStatus.REJECTED;
        refund!!.updatedAt = now();
        
        self.refunds.set(refundId, refund!!);
        self.emit(RefundRejected(refundId, "Refund rejected"));
    }
    
    /// Create a partial refund
    receive("RequestPartialRefund") {
        let refundId: Int = self.nextRefundId;
        self.nextRefundId = self.nextRefundId + 1;
        
        let paymentId: Int = context().value; // Would come from message
        let partialAmount: Int = context().value; // Would be partial amount
        let reason: String = "Partial refund";
        
        let existingRefund: Int? = self.paymentRefunds.get(paymentId);
        require(existingRefund == null, "Refund already exists for this payment");
        
        let refund: RefundData = RefundData {
            refundId: refundId,
            paymentId: paymentId,
            merchant: sender(),
            amount: partialAmount,
            originalAmount: context().value, // Original amount
            currency: "TON",
            status: RefundStatus.REQUESTED,
            reason: reason,
            isPartial: true,
            processedAt: null,
            createdAt: now(),
            updatedAt: now()
        };
        
        self.refunds.set(refundId, refund);
        self.paymentRefunds.set(paymentId, refundId);
        
        self.emit(RefundRequested(refundId, paymentId, partialAmount, reason));
    }
    
    // View getters
    get fun getRefund(refundId: Int): RefundData? {
        return self.refunds.get(refundId);
    }
    
    get fun getRefundByPayment(paymentId: Int): RefundData? {
        let refundId: Int? = self.paymentRefunds.get(paymentId);
        if (refundId == null) {
            return null;
        }
        return self.refunds.get(refundId!!);
    }
    
    get fun isRefundCompleted(refundId: Int): Bool {
        let refund: RefundData? = self.refunds.get(refundId);
        if (refund == null) {
            return false;
        }
        return refund!!.status == RefundStatus.COMPLETED;
    }
}
