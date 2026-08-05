/// @title EPay Invoice Manager
/// @notice Manages the complete invoice lifecycle from creation to payment
/// @dev Supports draft, issuance, partial payment, cancellation, and refund flows
contract InvoiceManager {
    // State
    owner: Address;
    paymentRouter: Address;
    
    nextInvoiceId: Int as uint64;
    invoices: map<Int, InvoiceData>;
    invoiceByNumber: map<String, Int>;
    
    struct InvoiceData {
        invoiceId: Int;
        invoiceNumber: String;
        merchant: Address;
        customer: Address?;
        amount: Int;
        currency: String;
        status: InvoiceStatus;
        dueDate: Int;
        paidAmount: Int;
        paymentId: Int?;
        createdAt: Int;
        updatedAt: Int;
    }
    
    enum InvoiceStatus {
        DRAFT: 0;
        ISSUED: 1;
        SENT: 2;
        VIEWED: 3;
        PARTIALLY_PAID: 4;
        PAID: 5;
        OVERDUE: 6;
        CANCELLED: 7;
        REFUNDED: 8;
    }
    
    // Events
    event InvoiceCreated(invoiceId: Int, invoiceNumber: String, merchant: Address, amount: Int);
    event InvoiceIssued(invoiceId: Int);
    event InvoicePaid(invoiceId: Int, paymentId: Int, amount: Int);
    event InvoiceCancelled(invoiceId: Int);
    event InvoiceRefunded(invoiceId: Int);
    event InvoiceMarkedOverdue(invoiceId: Int);
    
    init(owner: Address, paymentRouter: Address) {
        self.owner = owner;
        self.paymentRouter = paymentRouter;
        self.nextInvoiceId = 1;
    }
    
    /// Create a new invoice (draft)
    receive("CreateInvoice") {
        let invoiceId: Int = self.nextInvoiceId;
        self.nextInvoiceId = self.nextInvoiceId + 1;
        
        let merchant: Address = sender();
        let amount: Int = context().value;
        let invoiceNumber: String = "INV-" + invoiceId.toString();
        
        let invoice: InvoiceData = InvoiceData {
            invoiceId: invoiceId,
            invoiceNumber: invoiceNumber,
            merchant: merchant,
            customer: null,
            amount: amount,
            currency: "TON",
            status: InvoiceStatus.DRAFT,
            dueDate: now() + (30 * 86400), // 30 days
            paidAmount: 0,
            paymentId: null,
            createdAt: now(),
            updatedAt: now()
        };
        
        self.invoices.set(invoiceId, invoice);
        self.invoiceByNumber.set(invoiceNumber, invoiceId);
        
        self.emit(InvoiceCreated(invoiceId, invoiceNumber, merchant, amount));
    }
    
    /// Issue invoice (make it available for payment)
    receive("IssueInvoice") {
        let invoiceId: Int = context().value;
        let invoice: InvoiceData? = self.invoices.get(invoiceId);
        
        require(invoice != null, "Invoice not found");
        require(invoice!!.merchant == sender(), "Only merchant can issue");
        require(invoice!!.status == InvoiceStatus.DRAFT, "Invoice not in draft");
        
        invoice!!.status = InvoiceStatus.ISSUED;
        invoice!!.updatedAt = now();
        
        self.invoices.set(invoiceId, invoice!!);
        self.emit(InvoiceIssued(invoiceId));
    }
    
    /// Record payment against an invoice
    receive("RecordPayment") {
        let invoiceId: Int = context().value;
        let invoice: InvoiceData? = self.invoices.get(invoiceId);
        
        require(invoice != null, "Invoice not found");
        require(invoice!!.status == InvoiceStatus.ISSUED || invoice!!.status == InvoiceStatus.PARTIALLY_PAID, "Invoice not payable");
        require(now() <= invoice!!.dueDate, "Invoice past due date");
        
        let paymentAmount: Int = context().value; // Would come from payment
        
        invoice!!.paidAmount = invoice!!.paidAmount + paymentAmount;
        
        if (invoice!!.paidAmount >= invoice!!.amount) {
            invoice!!.status = InvoiceStatus.PAID;
            invoice!!.paymentId = paymentId;
            self.emit(InvoicePaid(invoiceId, paymentId, paymentAmount));
        } else {
            invoice!!.status = InvoiceStatus.PARTIALLY_PAID;
        }
        
        invoice!!.updatedAt = now();
        self.invoices.set(invoiceId, invoice!!);
    }
    
    /// Cancel an invoice
    receive("CancelInvoice") {
        let invoiceId: Int = context().value;
        let invoice: InvoiceData? = self.invoices.get(invoiceId);
        
        require(invoice != null, "Invoice not found");
        require(invoice!!.merchant == sender() || sender() == self.owner, "Not authorized");
        require(invoice!!.status == InvoiceStatus.DRAFT || invoice!!.status == InvoiceStatus.ISSUED, "Cannot cancel in current state");
        
        invoice!!.status = InvoiceStatus.CANCELLED;
        invoice!!.updatedAt = now();
        
        self.invoices.set(invoiceId, invoice!!);
        self.emit(InvoiceCancelled(invoiceId));
    }
    
    /// Refund a paid invoice
    receive("RefundInvoice") {
        let invoiceId: Int = context().value;
        let invoice: InvoiceData? = self.invoices.get(invoiceId);
        
        require(invoice != null, "Invoice not found");
        require(invoice!!.merchant == sender(), "Only merchant can refund");
        require(invoice!!.status == InvoiceStatus.PAID, "Invoice not in paid state");
        
        invoice!!.status = InvoiceStatus.REFUNDED;
        invoice!!.updatedAt = now();
        
        self.invoices.set(invoiceId, invoice!!);
        self.emit(InvoiceRefunded(invoiceId));
    }
    
    /// Mark overdue invoices
    receive("MarkOverdue") {
        let invoiceId: Int = context().value;
        let invoice: InvoiceData? = self.invoices.get(invoiceId);
        
        require(invoice != null, "Invoice not found");
        require(now() > invoice!!.dueDate, "Invoice not yet overdue");
        require(invoice!!.status == InvoiceStatus.ISSUED, "Invoice not in issued state");
        
        invoice!!.status = InvoiceStatus.OVERDUE;
        invoice!!.updatedAt = now();
        
        self.invoices.set(invoiceId, invoice!!);
        self.emit(InvoiceMarkedOverdue(invoiceId));
    }
    
    // View getters
    get fun getInvoice(invoiceId: Int): InvoiceData? {
        return self.invoices.get(invoiceId);
    }
    
    get fun getInvoiceByNumber(number: String): InvoiceData? {
        let invoiceId: Int? = self.invoiceByNumber.get(number);
        if (invoiceId == null) {
            return null;
        }
        return self.invoices.get(invoiceId!!);
    }
    
    get fun isInvoicePaid(invoiceId: Int): Bool {
        let invoice: InvoiceData? = self.invoices.get(invoiceId);
        if (invoice == null) {
            return false;
        }
        return invoice!!.status == InvoiceStatus.PAID;
    }
}
