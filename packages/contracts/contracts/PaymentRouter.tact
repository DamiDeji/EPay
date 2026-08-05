/// @title EPay Payment Router
/// @notice Routes and processes payments between payers and merchants
/// @dev Handles payment creation, confirmation, and failure scenarios
contract PaymentRouter {
    // State
    owner: Address;
    configManager: Address;
    feeManager: Address;
    pauseContract: Address;
    
    // Payment tracking
    nextPaymentId: Int as uint64;
    payments: map<Int, PaymentData>;
    
    // Payment Data Structure
    struct PaymentData {
        paymentId: Int;
        merchant: Address;
        payer: Address;
        recipient: Address;
        amount: Int;
        currency: String;
        status: PaymentStatus;
        fee: Int;
        createdAt: Int;
        expiresAt: Int;
        memo: String?;
    }
    
    // Payment Status Enum
    enum PaymentStatus {
        PENDING: 0;
        PROCESSING: 1;
        CONFIRMED: 2;
        COMPLETED: 3;
        FAILED: 4;
        REFUNDED: 5;
    }
    
    // Events
    event PaymentCreated(paymentId: Int, merchant: Address, payer: Address, amount: Int);
    event PaymentConfirmed(paymentId: Int, txHash: String);
    event PaymentCompleted(paymentId: Int);
    event PaymentFailed(paymentId: Int, reason: String);
    event PaymentRefunded(paymentId: Int, refundAmount: Int);
    
    init(owner: Address, configManager: Address, feeManager: Address, pauseContract: Address) {
        self.owner = owner;
        self.configManager = configManager;
        self.feeManager = feeManager;
        self.pauseContract = pauseContract;
        self.nextPaymentId = 1;
    }
    
    /// Create a new payment
    receive("CreatePayment") {
        // TODO: Check not paused via pause contract
        
        let paymentId: Int = self.nextPaymentId;
        self.nextPaymentId = self.nextPaymentId + 1;
        
        let merchant: Address = sender();
        // In production, parse payer, amount, recipient from message body
        let payer: Address = sender();
        let recipient: Address = sender();
        let amount: Int = context().value;
        
        // Calculate fee
        let fee: Int = (amount * 50) / 10000; // 0.5% default fee
        
        // Validate minimum payment
        require(amount >= ton("0.01"), "Amount below minimum payment");
        
        let payment: PaymentData = PaymentData {
            paymentId: paymentId,
            merchant: merchant,
            payer: payer,
            recipient: recipient,
            amount: amount,
            currency: "TON",
            status: PaymentStatus.PENDING,
            fee: fee,
            createdAt: now(),
            expiresAt: now() + 3600,
            memo: null
        };
        
        self.payments.set(paymentId, payment);
        self.emit(PaymentCreated(paymentId, merchant, payer, amount));
    }
    
    /// Confirm a payment has been received on-chain
    receive("ConfirmPayment") {
        let paymentId: Int = context().value;
        let payment: PaymentData? = self.payments.get(paymentId);
        
        require(payment != null, "Payment not found");
        require(payment!!.status == PaymentStatus.PENDING, "Payment not pending");
        require(now() < payment!!.expiresAt, "Payment expired");
        
        payment!!.status = PaymentStatus.CONFIRMED;
        self.payments.set(paymentId, payment!!);
        
        self.emit(PaymentConfirmed(paymentId, "confirmed"));
    }
    
    /// Complete a payment and settle funds
    receive("CompletePayment") {
        let paymentId: Int = context().value;
        let payment: PaymentData? = self.payments.get(paymentId);
        
        require(payment != null, "Payment not found");
        require(payment!!.status == PaymentStatus.CONFIRMED, "Payment not confirmed");
        
        payment!!.status = PaymentStatus.COMPLETED;
        self.payments.set(paymentId, payment!!);
        
        // Forward funds to recipient minus fees
        let netAmount: Int = payment!!.amount - payment!!.fee;
        self.forwardTo(payment!!.recipient, netAmount);
        
        self.emit(PaymentCompleted(paymentId));
    }
    
    /// Mark payment as failed
    receive("FailPayment") {
        let paymentId: Int = context().value;
        let payment: PaymentData? = self.payments.get(paymentId);
        
        require(payment != null, "Payment not found");
        require(payment!!.status == PaymentStatus.PENDING || payment!!.status == PaymentStatus.PROCESSING, "Cannot fail in current state");
        
        payment!!.status = PaymentStatus.FAILED;
        self.payments.set(paymentId, payment!!);
        
        self.emit(PaymentFailed(paymentId, "Payment failed"));
    }
    
    /// Process a refund
    receive("RefundPayment") {
        let paymentId: Int = context().value;
        let payment: PaymentData? = self.payments.get(paymentId);
        
        require(payment != null, "Payment not found");
        require(payment!!.status == PaymentStatus.COMPLETED, "Can only refund completed payments");
        
        payment!!.status = PaymentStatus.REFUNDED;
        self.payments.set(paymentId, payment!!);
        
        self.forwardTo(payment!!.payer, payment!!.amount);
        self.emit(PaymentRefunded(paymentId, payment!!.amount));
    }
    
    /// Get payment details
    get fun getPayment(paymentId: Int): PaymentData? {
        return self.payments.get(paymentId);
    }
    
    /// Check if a payment exists
    get fun paymentExists(paymentId: Int): Bool {
        return self.payments.get(paymentId) != null;
    }
    
    /// Get next payment ID
    get fun getNextPaymentId(): Int {
        return self.nextPaymentId;
    }
    
    /// Internal helper to forward TON to an address
    fun forwardTo(recipient: Address, amount: Int) {
        // In production, use proper TON send message
    }
}
