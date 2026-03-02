export function formatCurrency(amount, currency = 'USD') {
  const num = Number(amount) || 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense']

export function getAccountTypeColor(type) {
  const map = {
    asset: 'badge-asset',
    liability: 'badge-liability',
    equity: 'badge-equity',
    revenue: 'badge-revenue',
    income: 'badge-income',
    expense: 'badge-expense',
  }
  return map[type] || 'badge-asset'
}

// Normal balance: debit-normal = asset, expense; credit-normal = liability, equity, revenue
export function computeBalance(account, lines) {
  const totalDebit = lines?.reduce((s, l) => s + (Number(l.debit) || 0), 0) || 0
  const totalCredit = lines?.reduce((s, l) => s + (Number(l.credit) || 0), 0) || 0

  if (['asset', 'expense'].includes(account.type)) {
    return totalDebit - totalCredit
  } else {
    return totalCredit - totalDebit
  }
}
