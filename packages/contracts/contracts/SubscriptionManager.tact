/// @title EPay Subscription Manager
/// @notice Manages recurring subscription billing with multiple billing intervals
/// @dev Supports trial periods, max payments, pausing, and cancellation
contract SubscriptionManager {
    // State
    owner: Address;
    paymentRouter: Address;
    
    nextSubscriptionId: Int as uint64;
    subscriptions: map<Int, SubscriptionData>;
    
    struct SubscriptionData {
        subscriptionId: Int;
        merchant: Address;
        customer: Address;
        planName: String;
        amount: Int;
        currency: String;
        interval: BillingInterval;
        status: SubscriptionStatus;
        trialEndDate: Int?;
        currentPeriodStart: Int;
        currentPeriodEnd: Int;
        nextBillingDate: Int;
        maxPayments: Int?;
        paymentsMade: Int;
        lastPaymentId: Int?;
        cancelledAt: Int?;
        createdAt: Int;
        updatedAt: Int;
    }
    
    enum BillingInterval {
        DAILY: 0;
        WEEKLY: 1;
        MONTHLY: 2;
        QUARTERLY: 3;
        ANNUALLY: 4;
    }
    
    enum SubscriptionStatus {
        ACTIVE: 0;
        PAUSED: 1;
        CANCELLED: 2;
        EXPIRED: 3;
        PAYMENT_FAILED: 4;
        TRIAL: 5;
    }
    
    // Events
    event SubscriptionCreated(subscriptionId: Int, merchant: Address, customer: Address, planName: String);
    event SubscriptionRenewed(subscriptionId: Int, periodStart: Int, periodEnd: Int);
    event SubscriptionPaused(subscriptionId: Int);
    event SubscriptionResumed(subscriptionId: Int);
    event SubscriptionCancelled(subscriptionId: Int);
    event SubscriptionPaymentFailed(subscriptionId: Int);
    event SubscriptionExpired(subscriptionId: Int);
    
    init(owner: Address, paymentRouter: Address) {
        self.owner = owner;
        self.paymentRouter = paymentRouter;
        self.nextSubscriptionId = 1;
    }
    
    /// Create a new subscription
    receive("CreateSubscription") {
        let subscriptionId: Int = self.nextSubscriptionId;
        self.nextSubscriptionId = self.nextSubscriptionId + 1;
        
        let merchant: Address = sender();
        let planName: String = "Basic Plan"; // Would come from message
        
        let nowTimestamp: Int = now();
        let intervalSeconds: Int = 2592000; // 30 days for monthly
        
        let trialEnd: Int? = nowTimestamp + 604800; // 7 day trial
        
        let subscription: SubscriptionData = SubscriptionData {
            subscriptionId: subscriptionId,
            merchant: merchant,
            customer: sender(), // Would come from message
            planName: planName,
            amount: context().value, // Would come from message
            currency: "TON",
            interval: BillingInterval.MONTHLY,
            status: SubscriptionStatus.TRIAL,
            trialEndDate: trialEnd,
            currentPeriodStart: nowTimestamp,
            currentPeriodEnd: nowTimestamp + intervalSeconds,
            nextBillingDate: trialEnd!!,
            maxPayments: null,
            paymentsMade: 0,
            lastPaymentId: null,
            cancelledAt: null,
            createdAt: nowTimestamp,
            updatedAt: nowTimestamp
        };
        
        self.subscriptions.set(subscriptionId, subscription);
        self.emit(SubscriptionCreated(subscriptionId, merchant, sender(), planName));
    }
    
    /// Process subscription renewal billing
    receive("ProcessRenewal") {
        let subscriptionId: Int = context().value;
        let subscription: SubscriptionData? = self.subscriptions.get(subscriptionId);
        
        require(subscription != null, "Subscription not found");
        require(subscription!!.status == SubscriptionStatus.ACTIVE, "Subscription not active");
        require(now() >= subscription!!.nextBillingDate, "Not yet due for billing");
        
        // Check max payments
        if (subscription!!.maxPayments != null && subscription!!.paymentsMade >= subscription!!.maxPayments!!) {
            subscription!!.status = SubscriptionStatus.EXPIRED;
            self.subscriptions.set(subscriptionId, subscription!!);
            self.emit(SubscriptionExpired(subscriptionId));
            return;
        }
        
        // Calculate new period
        let intervalSeconds: Int = 2592000; // Would depend on interval type
        let newPeriodStart: Int = subscription!!.currentPeriodEnd;
        let newPeriodEnd: Int = newPeriodStart + intervalSeconds;
        
        subscription!!.currentPeriodStart = newPeriodStart;
        subscription!!.currentPeriodEnd = newPeriodEnd;
        subscription!!.nextBillingDate = newPeriodEnd;
        subscription!!.paymentsMade = subscription!!.paymentsMade + 1;
        subscription!!.updatedAt = now();
        
        self.subscriptions.set(subscriptionId, subscription!!);
        self.emit(SubscriptionRenewed(subscriptionId, newPeriodStart, newPeriodEnd));
    }
    
    /// Pause a subscription
    receive("PauseSubscription") {
        let subscriptionId: Int = context().value;
        let subscription: SubscriptionData? = self.subscriptions.get(subscriptionId);
        
        require(subscription != null, "Subscription not found");
        require(subscription!!.merchant == sender() || subscription!!.customer == sender(), "Not authorized");
        require(subscription!!.status == SubscriptionStatus.ACTIVE || subscription!!.status == SubscriptionStatus.TRIAL, "Cannot pause in current state");
        
        subscription!!.status = SubscriptionStatus.PAUSED;
        subscription!!.updatedAt = now();
        
        self.subscriptions.set(subscriptionId, subscription!!);
        self.emit(SubscriptionPaused(subscriptionId));
    }
    
    /// Resume a paused subscription
    receive("ResumeSubscription") {
        let subscriptionId: Int = context().value;
        let subscription: SubscriptionData? = self.subscriptions.get(subscriptionId);
        
        require(subscription != null, "Subscription not found");
        require(subscription!!.status == SubscriptionStatus.PAUSED, "Subscription not paused");
        
        subscription!!.status = SubscriptionStatus.ACTIVE;
        subscription!!.nextBillingDate = now() + 86400; // Resume billing tomorrow
        subscription!!.updatedAt = now();
        
        self.subscriptions.set(subscriptionId, subscription!!);
        self.emit(SubscriptionResumed(subscriptionId));
    }
    
    /// Cancel a subscription
    receive("CancelSubscription") {
        let subscriptionId: Int = context().value;
        let subscription: SubscriptionData? = self.subscriptions.get(subscriptionId);
        
        require(subscription != null, "Subscription not found");
        require(subscription!!.merchant == sender() || subscription!!.customer == sender() || sender() == self.owner, "Not authorized");
        require(subscription!!.status != SubscriptionStatus.CANCELLED, "Already cancelled");
        
        subscription!!.status = SubscriptionStatus.CANCELLED;
        subscription!!.cancelledAt = now();
        subscription!!.updatedAt = now();
        
        self.subscriptions.set(subscriptionId, subscription!!);
        self.emit(SubscriptionCancelled(subscriptionId));
    }
    
    /// Mark payment as failed
    receive("MarkPaymentFailed") {
        let subscriptionId: Int = context().value;
        let subscription: SubscriptionData? = self.subscriptions.get(subscriptionId);
        
        require(subscription != null, "Subscription not found");
        require(subscription!!.status == SubscriptionStatus.ACTIVE, "Subscription not active");
        
        subscription!!.status = SubscriptionStatus.PAYMENT_FAILED;
        subscription!!.updatedAt = now();
        
        self.subscriptions.set(subscriptionId, subscription!!);
        self.emit(SubscriptionPaymentFailed(subscriptionId));
    }
    
    // View getters
    get fun getSubscription(subscriptionId: Int): SubscriptionData? {
        return self.subscriptions.get(subscriptionId);
    }
    
    get fun isSubscriptionActive(subscriptionId: Int): Bool {
        let subscription: SubscriptionData? = self.subscriptions.get(subscriptionId);
        if (subscription == null) {
            return false;
        }
        return subscription!!.status == SubscriptionStatus.ACTIVE;
    }
    
    get fun getNextBillingDate(subscriptionId: Int): Int? {
        let subscription: SubscriptionData? = self.subscriptions.get(subscriptionId);
        if (subscription == null) {
            return null;
        }
        return subscription!!.nextBillingDate;
    }
}
