export const PaymentStatus = {
  pending: 'pending',       // Created, not yet on blockchain
  submitted: 'submitted',   // Submitted to blockchain
  confirmed: 'confirmed',   // Confirmed on blockchain
  failed: 'failed',         // Transaction failed
  cancelled: 'cancelled',   // Cancelled by user/system
} as const;

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

export const TransactionType = {
    direct: 'direct',
    invoice: 'invoice'
} as const;

export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

export const TokenSymbols = {
    USDC: 'USDC',
    USDT: 'USDT',
    ETH: "ETH"
} as const;

export type TokenSymbols = typeof TokenSymbols[keyof typeof TokenSymbols];