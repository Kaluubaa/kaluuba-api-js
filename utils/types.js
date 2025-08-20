export const PaymentStatus = {
  pending: 'pending',       // Created, not yet on blockchain
  submitted: 'submitted',   // Submitted to blockchain
  confirmed: 'confirmed',   // Confirmed on blockchain
  failed: 'failed',         // Transaction failed
  cancelled: 'cancelled',   // Cancelled by user/system
}

export const TransactionType = {
    direct: 'direct',
    invoice: 'invoice'
}

export const TokenSymbols = {
    USDC: 'USDC',
    USDT: 'USDT',
    ETH: "ETH"
}

export const InvoiceStatus = {
  draft: 'draft',
  sent: 'sent',
  viewed: 'viewed',
  partial: 'partial_paid',
  paid: 'paid',
  overdue: 'overdue',
  cancelled: 'cancelled'
};

export const InvoiceType = {
  oneTime: 'one_time',
  recurring: 'recurring'
};

export const RecurrenceInterval = {
  weekly: 'weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  yearly: 'yearly'
};

export const DiscountType = {
  percentage: 'percentage',
  fixed: 'fixed'
}