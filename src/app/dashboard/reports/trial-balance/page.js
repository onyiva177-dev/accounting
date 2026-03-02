import { createClient } from '@/lib/supabase/server'
import { formatCurrency, computeBalance } from '@/lib/utils'
import { Download } from 'lucide-react'

export default async function TrialBalancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: accounts } = await supabase
    .from('accounts')
    .select(`id, name, code, type, journal_lines(debit, credit)`)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('code', { ascending: true })

  const rows = (accounts || []).map(account => {
    const bal = computeBalance(account, account.journal_lines)
    const isDebitNormal = ['asset', 'expense'].includes(account.type)
    return {
      ...account,
      debit: isDebitNormal ? (bal > 0 ? bal : 0) : (bal < 0 ? -bal : 0),
      credit: !isDebitNormal ? (bal > 0 ? bal : 0) : (bal < 0 ? -bal : 0),
      balance: bal,
    }
  }).filter(r => r.debit > 0 || r.credit > 0)

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const typeOrder = ['asset', 'liability', 'equity', 'revenue', 'expense']
  const groupedRows = typeOrder.map(type => ({
    type,
    rows: rows.filter(r => r.type === type)
  })).filter(g => g.rows.length > 0)

  const generatedAt = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Balance</h1>
          <p className="page-subtitle">Generated {generatedAt}</p>
        </div>
        <div className="flex gap-2">
          {isBalanced
            ? <span className="badge badge-green" style={{ padding: '6px 12px', fontSize: 13 }}>✓ Balanced</span>
            : <span className="badge badge-red" style={{ padding: '6px 12px', fontSize: 13 }}>✗ Out of Balance</span>
          }
        </div>
      </div>

      <div className="page-body animate-fade-in">
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Code</th>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th className="right">Debit (DR)</th>
                  <th className="right">Credit (CR)</th>
                </tr>
              </thead>
              <tbody>
                {groupedRows.map(group => (
                  <>
                    <tr key={`section-${group.type}`} style={{ background: 'var(--bg-3)' }}>
                      <td colSpan={5} style={{ padding: '8px 16px' }}>
                        <span className={`badge badge-${group.type}`} style={{ fontSize: 11 }}>
                          {group.type.charAt(0).toUpperCase() + group.type.slice(1)}
                        </span>
                      </td>
                    </tr>
                    {group.rows.map(row => (
                      <tr key={row.id}>
                        <td className="muted font-mono">{row.code || '—'}</td>
                        <td>{row.name}</td>
                        <td><span className={`badge badge-${row.type}`} style={{ fontSize: 11 }}>{row.type}</span></td>
                        <td className="right font-mono">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                        <td className="right font-mono">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}><strong>TOTALS</strong></td>
                  <td className="right">
                    <strong className="font-mono">{formatCurrency(totalDebit)}</strong>
                  </td>
                  <td className="right">
                    <strong className="font-mono" style={{ color: isBalanced ? 'var(--green)' : 'var(--red)' }}>
                      {formatCurrency(totalCredit)}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {!isBalanced && (
          <div className="alert alert-error mt-4">
            ⚠ Trial balance is out of balance by {formatCurrency(Math.abs(totalDebit - totalCredit))}.
            This may indicate missing or incorrect journal entries.
          </div>
        )}

        {rows.length === 0 && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <h3>No data yet</h3>
            <p>Post journal entries to generate a trial balance</p>
          </div>
        )}
      </div>
    </>
  )
}
