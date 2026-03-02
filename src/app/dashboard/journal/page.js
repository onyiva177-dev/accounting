'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, X, Trash2, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Eye } from 'lucide-react'

function JournalModal({ entry, accounts, onClose, onSave }) {
  const emptyLine = () => ({ account_id: '', debit: '', credit: '', _id: Math.random() })

  const [form, setForm] = useState({
    description: entry?.description || '',
    date: entry?.date || new Date().toISOString().split('T')[0],
    notes: entry?.notes || '',
  })
  const [lines, setLines] = useState(
    entry?.journal_lines?.length
      ? entry.journal_lines.map(l => ({ ...l, _id: Math.random(), debit: l.debit || '', credit: l.credit || '' }))
      : [emptyLine(), emptyLine()]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  function updateLine(idx, field, value) {
    setLines(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      // Auto-clear opposing field if user types in one
      if (field === 'debit' && value) updated[idx].credit = ''
      if (field === 'credit' && value) updated[idx].debit = ''
      return updated
    })
  }

  function addLine() {
    setLines(prev => [...prev, emptyLine()])
  }

  function removeLine(idx) {
    if (lines.length <= 2) return
    setLines(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!isBalanced) {
      setError('Journal entry is not balanced. Total debits must equal total credits.')
      return
    }

    const validLines = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
    if (validLines.length < 2) {
      setError('A journal entry requires at least 2 lines.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    try {
      let journalId = entry?.id

      if (entry?.id) {
        // Update
        await supabase.from('journal_entries').update({
          description: form.description,
          date: form.date,
          notes: form.notes,
        }).eq('id', entry.id)

        // Delete old lines and re-insert
        await supabase.from('journal_lines').delete().eq('journal_id', entry.id)
      } else {
        // Create
        const { data: je, error: jeError } = await supabase
          .from('journal_entries')
          .insert({ ...form, user_id: user.id })
          .select()
          .single()

        if (jeError) throw jeError
        journalId = je.id
      }

      // Insert lines
      const { error: linesError } = await supabase.from('journal_lines').insert(
        validLines.map(l => ({
          journal_id: journalId,
          account_id: l.account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        }))
      )

      if (linesError) throw linesError

      onSave()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{entry ? 'Edit Journal Entry' : 'New Journal Entry'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="grid-2 mb-4">
              <div className="form-group">
                <label className="form-label">Description *</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Monthly rent payment"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Journal Lines */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 32px', gap: 8, marginBottom: 6 }}>
                <span className="form-label">Account</span>
                <span className="form-label text-right">Debit (DR)</span>
                <span className="form-label text-right">Credit (CR)</span>
                <span></span>
              </div>

              {lines.map((line, idx) => (
                <div key={line._id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 32px', gap: 8, marginBottom: 8, alignItems: 'start' }}>
                  <select
                    className="form-select"
                    value={line.account_id}
                    onChange={e => updateLine(idx, 'account_id', e.target.value)}
                  >
                    <option value="">Select account…</option>
                    {['asset', 'liability', 'equity', 'revenue', 'expense'].map(type => (
                      <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                        {accounts.filter(a => a.type === type).map(a => (
                          <option key={a.id} value={a.id}>
                            {a.code ? `${a.code} — ` : ''}{a.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="form-input text-right"
                    placeholder="0.00"
                    value={line.debit}
                    onChange={e => updateLine(idx, 'debit', e.target.value)}
                    min="0"
                    step="0.01"
                    style={{ textAlign: 'right' }}
                  />
                  <input
                    type="number"
                    className="form-input text-right"
                    placeholder="0.00"
                    value={line.credit}
                    onChange={e => updateLine(idx, 'credit', e.target.value)}
                    min="0"
                    step="0.01"
                    style={{ textAlign: 'right' }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length <= 2}
                    style={{ color: 'var(--text-3)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={addLine}>
                <Plus size={14} /> Add Line
              </button>
            </div>

            {/* Balance Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 32px', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className={`journal-balance-indicator ${isBalanced ? 'balanced' : 'unbalanced'}`}>
                  {isBalanced ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {isBalanced ? 'Balanced' : `Off by ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', color: totalDebit > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                {formatCurrency(totalDebit)}
              </div>
              <div style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 'var(--radius)', color: totalCredit > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                {formatCurrency(totalCredit)}
              </div>
              <div></div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input
                className="form-input"
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes or reference"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !isBalanced}>
              {loading ? <span className="loading-spinner" /> : entry ? 'Save Changes' : 'Post Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ViewEntryModal({ entry, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{entry.description}</h2>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>{formatDate(entry.date)}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Type</th>
                  <th className="right">Debit (DR)</th>
                  <th className="right">Credit (CR)</th>
                </tr>
              </thead>
              <tbody>
                {entry.journal_lines?.map(line => (
                  <tr key={line.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{line.accounts?.name}</div>
                      {line.accounts?.code && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{line.accounts.code}</div>}
                    </td>
                    <td><span className={`badge badge-${line.accounts?.type}`}>{line.accounts?.type}</span></td>
                    <td className="right font-mono">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                    <td className="right font-mono">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}><strong>Total</strong></td>
                  <td className="right font-mono">
                    {formatCurrency(entry.journal_lines?.reduce((s, l) => s + (l.debit || 0), 0))}
                  </td>
                  <td className="right font-mono">
                    {formatCurrency(entry.journal_lines?.reduce((s, l) => s + (l.credit || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {entry.notes && (
            <div className="mt-4">
              <div className="form-label">Notes</div>
              <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{entry.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function JournalPage() {
  const [entries, setEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'create' | entry
  const [viewEntry, setViewEntry] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data: entriesData }, { data: accountsData }] = await Promise.all([
      supabase
        .from('journal_entries')
        .select(`
          id, description, date, notes, created_at,
          journal_lines(id, debit, credit, account_id, accounts(id, name, code, type))
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
      supabase.from('accounts').select('id, name, code, type').order('code')
    ])

    setEntries(entriesData || [])
    setAccounts(accountsData || [])
    setLoading(false)
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete(id) {
    const supabase = createClient()
    await supabase.from('journal_lines').delete().eq('journal_id', id)
    await supabase.from('journal_entries').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeleteId(null)
  }

  function handleSave() {
    setModal(null)
    fetchData()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal Entries</h1>
          <p className="page-subtitle">Double-entry accounting ledger</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> New Entry
        </button>
      </div>

      <div className="page-body animate-fade-in">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          {loading ? (
            <div className="loading-full"><span className="loading-spinner" /><span>Loading entries…</span></div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <Plus size={40} />
              <h3>No journal entries</h3>
              <p>Create your first double-entry journal entry to track transactions</p>
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
                    <th>Balance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const totalDebit = entry.journal_lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0
                    const totalCredit = entry.journal_lines?.reduce((s, l) => s + (l.credit || 0), 0) || 0
                    const balanced = Math.abs(totalDebit - totalCredit) < 0.01
                    const debitAccounts = entry.journal_lines?.filter(l => l.debit > 0).map(l => l.accounts?.name).filter(Boolean)
                    const creditAccounts = entry.journal_lines?.filter(l => l.credit > 0).map(l => l.accounts?.name).filter(Boolean)

                    return (
                      <tr key={entry.id}>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(entry.date)}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{entry.description}</div>
                          {entry.notes && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{entry.notes}</div>}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div style={{ color: 'var(--text-2)' }}>DR: {debitAccounts?.join(', ') || '—'}</div>
                          <div style={{ color: 'var(--text-3)' }}>CR: {creditAccounts?.join(', ') || '—'}</div>
                        </td>
                        <td className="right font-mono">{formatCurrency(totalDebit)}</td>
                        <td className="right font-mono">{formatCurrency(totalCredit)}</td>
                        <td>
                          <span className={`badge ${balanced ? 'badge-green' : 'badge-red'}`}>
                            {balanced ? '✓ Balanced' : '✗ Error'}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2 justify-end">
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setViewEntry(entry)} title="View">
                              <Eye size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(entry)} title="Edit">
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteId(entry.id)} title="Delete" style={{ color: 'var(--red)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            Previous
          </button>
          <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Page {page + 1}</span>
          <button className="btn btn-secondary btn-sm" disabled={entries.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      </div>

      {(modal === 'create' || (modal && modal !== 'create')) && (
        <JournalModal
          entry={modal === 'create' ? null : modal}
          accounts={accounts}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {viewEntry && <ViewEntryModal entry={viewEntry} onClose={() => setViewEntry(null)} />}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Entry</h2>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)' }}>
                Delete <strong style={{ color: 'var(--text)' }}>{entries.find(e => e.id === deleteId)?.description}</strong>?
                This will remove all associated journal lines.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete Entry</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
