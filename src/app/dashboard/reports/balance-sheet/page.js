import { createClient } from '@/lib/supabase/server'
import { formatCurrency, computeBalance } from '@/lib/utils'

export default async function BalanceSheetPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: accounts } = await supabase
    .from('accounts')
    .select(`id, name, code, type, journal_lines(debit, credit)`)
    .eq('user_id', user.id)
    .in('type', ['asset', 'liability', 'equity'])
    .order('code', { ascending: true })

  // Also get revenue and expense for retained earnings
  const { data: plAccounts } = await supabase
    .from('accounts')
    .select(`id, type, journal_lines(debit, credit)`)
    .eq('user_id', user.id)
    .in('type', ['revenue', 'expense'])

  const assetAccounts = (accounts || [])
    .filter(a => a.type === 'asset')
    .map(a => ({ ...a, balance: computeBalance(a, a.journal_lines) }))

  const liabilityAccounts = (accounts || [])
    .filter(a => a.type === 'liability')
    .map(a => ({ ...a, balance: computeBalance(a, a.journal_lines) }))

  const equityAccounts = (accounts || [])
    .filter(a => a.type === 'equity')
    .map(a => ({ ...a, balance: computeBalance(a, a.journal_lines) }))

  const totalRevenue = (plAccounts || [])
    .filter(a => a.type === 'revenue')
    .reduce((s, a) => s + computeBalance(a, a.journal_lines), 0)

  const totalExpenses = (plAccounts || [])
    .filter(a => a.type === 'expense')
    .reduce((s, a) => s + computeBalance(a, a.journal_lines), 0)

  const currentPeriodEarnings = totalRevenue - totalExpenses

  const totalAssets = assetAccounts.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0)
  const totalEquityAccounts = equityAccounts.reduce((s, a) => s + a.balance, 0)
  const totalEquity = totalEquityAccounts + currentPeriodEarnings
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01

  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  const AccountSection = ({ title, accounts: accs, total, color }) => (
    <div className="card mb-4">
      <div className="card-header">
        <span className="card-title">{title}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: color || 'var(--text)' }}>
          {formatCurrency(total)}
        </span>
      </div>
      {accs.filter(a => a.balance !== 0).length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 20px' }}>
          <p>No balances recorded</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th className="right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {accs.filter(a => a.balance !== 0).map(account => (
                <tr key={account.id}>
                  <td className="muted font-mono">{account.code || '—'}</td>
                  <td>{account.name}</td>
                  <td className={`right font-mono ${account.balance > 0 ? 'amount-positive' : 'amount-negative'}`}>
                    {formatCurrency(account.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><strong>Total {title}</strong></td>
                <td className="right font-mono"><strong>{formatCurrency(total)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Balance Sheet</h1>
          <p className="page-subtitle">Statement of Financial Position — {generatedAt}</p>
        </div>
        <div className="flex gap-2 items-center">
          {isBalanced
            ? <span className="badge badge-green" style={{ padding: '6px 12px', fontSize: 13 }}>✓ Balanced</span>
            : <span className="badge badge-red" style={{ padding: '6px 12px', fontSize: 13 }}>✗ Out of Balance</span>
          }
        </div>
      </div>

      <div className="page-body animate-fade-in">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Assets</div>
            <div className="stat-value accent">{formatCurrency(totalAssets)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Liabilities</div>
            <div className={`stat-value ${totalLiabilities > 0 ? 'red' : ''}`}>{formatCurrency(totalLiabilities)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Equity</div>
            <div className={`stat-value ${totalEquity >= 0 ? 'green' : 'red'}`}>{formatCurrency(totalEquity)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <h2 className="report-section-title" style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              Assets
            </h2>
            <AccountSection title="Assets" accounts={assetAccounts} total={totalAssets} color="var(--accent)" />
          </div>

          <div>
            <h2 className="report-section-title" style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              Liabilities & Equity
            </h2>
            <AccountSection title="Liabilities" accounts={liabilityAccounts} total={totalLiabilities} color="var(--red)" />

            {/* Equity section with current earnings */}
            <div className="card mb-4">
              <div className="card-header">
                <span className="card-title">Equity</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: totalEquity >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {formatCurrency(totalEquity)}
                </span>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Account</th>
                      <th className="right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equityAccounts.filter(a => a.balance !== 0).map(account => (
                      <tr key={account.id}>
                        <td className="muted font-mono">{account.code || '—'}</td>
                        <td>{account.name}</td>
                        <td className={`right font-mono ${account.balance >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                          {formatCurrency(account.balance)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: 'var(--accent-glow)' }}>
                      <td className="muted font-mono">—</td>
                      <td style={{ color: 'var(--accent)' }}>Current Period Earnings</td>
                      <td className={`right font-mono ${currentPeriodEarnings >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                        {formatCurrency(currentPeriodEarnings)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}><strong>Total Equity</strong></td>
                      <td className="right font-mono">
                        <strong className={totalEquity >= 0 ? 'amount-positive' : 'amount-negative'}>
                          {formatCurrency(totalEquity)}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Totals check */}
            <div className="card" style={{ borderColor: isBalanced ? 'rgba(45,212,160,0.3)' : 'rgba(255,107,107,0.3)' }}>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Total Liabilities</span>
                  <span className="font-mono">{formatCurrency(totalLiabilities)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Total Equity</span>
                  <span className="font-mono">{formatCurrency(totalEquity)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>Total Liabilities + Equity</span>
                  <span className={`font-mono ${isBalanced ? 'amount-positive' : 'amount-negative'}`}>
                    {formatCurrency(totalLiabilitiesAndEquity)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Accounting equation check */}
        <div className={`alert ${isBalanced ? 'alert-success' : 'alert-error'} mt-4`}>
          <strong>Accounting Equation: </strong>
          Assets ({formatCurrency(totalAssets)}) = Liabilities ({formatCurrency(totalLiabilities)}) + Equity ({formatCurrency(totalEquity)}) 
          {isBalanced ? ' ✓' : ` — Difference: ${formatCurrency(Math.abs(totalAssets - totalLiabilitiesAndEquity))}`}
        </div>
      </div>
    </>
  )
}
