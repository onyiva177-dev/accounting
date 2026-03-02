import { createClient } from '@/lib/supabase/server'
import { formatCurrency, computeBalance } from '@/lib/utils'

export default async function ProfitLossPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: accounts } = await supabase
    .from('accounts')
    .select(`id, name, code, type, journal_lines(debit, credit)`)
    .eq('user_id', user.id)
    .in('type', ['revenue', 'expense'])
    .order('code', { ascending: true })

  const incomeAccounts = (accounts || [])
    .filter(a => a.type === 'revenue')
    .map(a => ({ ...a, balance: computeBalance(a, a.journal_lines) }))
    .filter(a => a.balance !== 0)

  const expenseAccounts = (accounts || [])
    .filter(a => a.type === 'expense')
    .map(a => ({ ...a, balance: computeBalance(a, a.journal_lines) }))
    .filter(a => a.balance !== 0)

  const totalIncome = incomeAccounts.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = expenseAccounts.reduce((s, a) => s + a.balance, 0)
  const netProfit = totalIncome - totalExpenses
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0

  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit & Loss</h1>
          <p className="page-subtitle">Income Statement — Generated {generatedAt}</p>
        </div>
        <div className="flex gap-2 items-center">
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Profit Margin:</span>
          <span className={`badge ${netProfit >= 0 ? 'badge-green' : 'badge-red'}`} style={{ padding: '6px 12px', fontSize: 13 }}>
            {profitMargin}%
          </span>
        </div>
      </div>

      <div className="page-body animate-fade-in">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value green">{formatCurrency(totalIncome)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value red">{formatCurrency(totalExpenses)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Net Profit</div>
            <div className={`stat-value ${netProfit >= 0 ? 'green' : 'red'}`}>{formatCurrency(netProfit)}</div>
          </div>
        </div>

        {/* Revenue Section */}
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title">Revenue</span>
            <span style={{ color: 'var(--green)', fontFamily: 'var(--font-display)', fontSize: 18 }}>
              {formatCurrency(totalIncome)}
            </span>
          </div>
          {incomeAccounts.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <p>No revenue recorded</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="right">Amount</th>
                    <th className="right">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeAccounts.map(account => (
                    <tr key={account.id}>
                      <td className="muted font-mono">{account.code || '—'}</td>
                      <td>{account.name}</td>
                      <td className="right font-mono amount-positive">{formatCurrency(account.balance)}</td>
                      <td className="right muted">{totalIncome > 0 ? ((account.balance / totalIncome) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}><strong>Total Revenue</strong></td>
                    <td className="right font-mono"><strong className="amount-positive">{formatCurrency(totalIncome)}</strong></td>
                    <td className="right"><strong>100%</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Expenses Section */}
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title">Expenses</span>
            <span style={{ color: 'var(--red)', fontFamily: 'var(--font-display)', fontSize: 18 }}>
              {formatCurrency(totalExpenses)}
            </span>
          </div>
          {expenseAccounts.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <p>No expenses recorded</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="right">Amount</th>
                    <th className="right">% of Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseAccounts.map(account => (
                    <tr key={account.id}>
                      <td className="muted font-mono">{account.code || '—'}</td>
                      <td>{account.name}</td>
                      <td className="right font-mono amount-negative">{formatCurrency(account.balance)}</td>
                      <td className="right muted">{totalIncome > 0 ? ((account.balance / totalIncome) * 100).toFixed(1) : '—'}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}><strong>Total Expenses</strong></td>
                    <td className="right font-mono"><strong className="amount-negative">{formatCurrency(totalExpenses)}</strong></td>
                    <td className="right muted">{totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : '—'}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Net Profit */}
        <div className="card" style={{ borderColor: netProfit >= 0 ? 'rgba(45,212,160,0.3)' : 'rgba(255,107,107,0.3)' }}>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Net Profit / (Loss)</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Revenue − Expenses</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={`stat-value ${netProfit >= 0 ? 'green' : 'red'}`} style={{ fontSize: 32 }}>
                {formatCurrency(netProfit)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                {netProfit >= 0 ? 'Profit' : 'Loss'} · {profitMargin}% margin
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
