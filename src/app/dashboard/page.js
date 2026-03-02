import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Scale, BookOpen } from 'lucide-react'

async function getDashboardData(supabase, userId) {
  // Get account balances by type (computed from journal_lines)
  const { data: accounts } = await supabase
    .from('accounts')
    .select(`
      id, name, type, code,
      journal_lines(debit, credit)
    `)
    .eq('user_id', userId)

  // Compute balances
  const balances = { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 }

  accounts?.forEach(account => {
    const totalDebit = account.journal_lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0
    const totalCredit = account.journal_lines?.reduce((s, l) => s + (l.credit || 0), 0) || 0

    let balance = 0
    if (['asset', 'expense'].includes(account.type)) {
      balance = totalDebit - totalCredit
    } else {
      balance = totalCredit - totalDebit
    }

    if (balances[account.type] !== undefined) {
      balances[account.type] += balance
    }
  })

  // Get recent journal entries
  const { data: recentEntries } = await supabase
    .from('journal_entries')
    .select(`
      id, description, date, created_at,
      journal_lines(debit, credit, accounts(name))
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(8)

  return { balances, recentEntries: recentEntries || [] }
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', user.id)
    .single()

  const { balances, recentEntries } = await getDashboardData(supabase, user.id)
  const netProfit = balances.revenue - balances.expense

  const stats = [
    { label: 'Total Assets', value: balances.asset, color: 'accent' },
    { label: 'Total Liabilities', value: balances.liability, color: balances.liability > 0 ? 'red' : undefined },
    { label: 'Total Equity', value: balances.equity, color: undefined },
    { label: 'Revenue', value: balances.revenue, color: 'green' },
    { label: 'Expenses', value: balances.expense, color: balances.expense > 0 ? 'red' : undefined },
    { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? 'green' : 'red' },
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {profile?.company_name || profile?.full_name || user.email} — Financial Overview
          </p>
        </div>
      </div>

      <div className="page-body animate-fade-in">
        <div className="stats-grid">
          {stats.map(stat => (
            <div key={stat.label} className="stat-card">
              <div className="stat-label">{stat.label}</div>
              <div className={`stat-value ${stat.color || ''}`}>
                {formatCurrency(stat.value)}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Journal Entries</span>
          </div>
          {recentEntries.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={40} />
              <h3>No entries yet</h3>
              <p>Create your first journal entry to get started</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Accounts</th>
                    <th className="right">Debit</th>
                    <th className="right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map(entry => {
                    const totalDebit = entry.journal_lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0
                    const accountNames = [...new Set(entry.journal_lines?.map(l => l.accounts?.name).filter(Boolean))]
                    return (
                      <tr key={entry.id}>
                        <td className="muted">{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        <td>{entry.description || '—'}</td>
                        <td className="muted" style={{ fontSize: 12 }}>{accountNames.slice(0,3).join(', ')}{accountNames.length > 3 ? '…' : ''}</td>
                        <td className="right">{formatCurrency(totalDebit)}</td>
                        <td className="right">{formatCurrency(totalDebit)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
