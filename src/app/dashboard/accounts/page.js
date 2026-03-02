'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, getAccountTypeColor, computeBalance } from '@/lib/utils'
import { Plus, Pencil, Trash2, X, ChevronRight } from 'lucide-react'

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense']

function AccountModal({ account, accounts, onClose, onSave }) {
  const [form, setForm] = useState({
    name: account?.name || '',
    code: account?.code || '',
    type: account?.type || 'asset',
    description: account?.description || '',
    parent_id: account?.parent_id || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      ...form,
      parent_id: form.parent_id || null,
      user_id: user.id,
    }

    let result
    if (account?.id) {
      result = await supabase.from('accounts').update(payload).eq('id', account.id).select().single()
    } else {
      result = await supabase.from('accounts').insert(payload).select().single()
    }

    if (result.error) {
      setError(result.error.message)
      setLoading(false)
      return
    }

    onSave(result.data)
  }

  const parentOptions = accounts.filter(a => a.id !== account?.id && a.type === form.type)

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{account ? 'Edit Account' : 'New Account'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Account Name *</label>
                <input name="name" className="form-input" value={form.name} onChange={handleChange} required placeholder="e.g. Cash" />
              </div>
              <div className="form-group">
                <label className="form-label">Account Code</label>
                <input name="code" className="form-input" value={form.code} onChange={handleChange} placeholder="e.g. 1000" />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select name="type" className="form-select" value={form.type} onChange={handleChange} required>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Parent Account</label>
                <select name="parent_id" className="form-select" value={form.parent_id} onChange={handleChange}>
                  <option value="">None</option>
                  {parentOptions.map(a => (
                    <option key={a.id} value={a.id}>{a.code ? `${a.code} — ` : ''}{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input name="description" className="form-input" value={form.description} onChange={handleChange} placeholder="Optional description" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : account ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'create' | account_object
  const [deleteId, setDeleteId] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  const fetchAccounts = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('accounts')
      .select(`id, name, code, type, description, parent_id, is_active, journal_lines(debit, credit)`)
      .order('code', { ascending: true })

    setAccounts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  async function handleDelete(id) {
    const account = accounts.find(a => a.id === id)
    if (account?.journal_lines?.length > 0) {
      setError('Cannot delete account with journal entries.')
      setDeleteId(null)
      return
    }

    const supabase = createClient()
    const { error: err } = await supabase.from('accounts').delete().eq('id', id)
    if (err) { setError(err.message); return }

    setAccounts(prev => prev.filter(a => a.id !== id))
    setDeleteId(null)
  }

  function handleSave(saved) {
    setAccounts(prev => {
      const idx = prev.findIndex(a => a.id === saved.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], ...saved }
        return updated
      }
      return [...prev, { ...saved, journal_lines: [] }]
    })
    setModal(null)
  }

  const filtered = filter === 'all' ? accounts : accounts.filter(a => a.type === filter)

  const groupedByType = ACCOUNT_TYPES.reduce((acc, type) => {
    acc[type] = filtered.filter(a => a.type === type && !a.parent_id)
    return acc
  }, {})

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">{accounts.length} accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <Plus size={16} /> New Account
        </button>
      </div>

      <div className="page-body animate-fade-in">
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error} <button onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button></div>}

        <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
          {['all', ...ACCOUNT_TYPES].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`btn btn-sm ${filter === t ? 'btn-primary' : 'btn-secondary'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-full"><span className="loading-spinner" /><span>Loading accounts…</span></div>
        ) : (
          ACCOUNT_TYPES.map(type => {
            const typeAccounts = filtered.filter(a => a.type === type)
            if (typeAccounts.length === 0) return null

            return (
              <div key={type} className="card mb-4">
                <div className="card-header">
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge badge-${type}`}>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    <span className="text-muted text-sm">{typeAccounts.length} accounts</span>
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text-2)' }}>
                    {formatCurrency(typeAccounts.reduce((s, a) => s + computeBalance(a, a.journal_lines), 0))}
                  </span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th className="right">Balance</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeAccounts.map(account => {
                        const balance = computeBalance(account, account.journal_lines)
                        const children = accounts.filter(a => a.parent_id === account.id)
                        return (
                          <>
                            <tr key={account.id}>
                              <td className="muted font-mono">{account.code || '—'}</td>
                              <td style={{ fontWeight: 500 }}>{account.name}</td>
                              <td className="muted">{account.description || '—'}</td>
                              <td className={`right font-mono ${balance > 0 ? 'amount-positive' : balance < 0 ? 'amount-negative' : 'amount-zero'}`}>
                                {formatCurrency(balance)}
                              </td>
                              <td>
                                <div className="flex gap-2 justify-end">
                                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(account)} title="Edit">
                                    <Pencil size={14} />
                                  </button>
                                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteId(account.id)} title="Delete" style={{ color: 'var(--red)' }}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {children.map(child => {
                              const childBal = computeBalance(child, child.journal_lines)
                              return (
                                <tr key={child.id} style={{ background: 'rgba(0,0,0,0.1)' }}>
                                  <td className="muted font-mono" style={{ paddingLeft: 32 }}>{child.code || '—'}</td>
                                  <td style={{ paddingLeft: 32, color: 'var(--text-2)' }}>↳ {child.name}</td>
                                  <td className="muted">{child.description || '—'}</td>
                                  <td className={`right font-mono ${childBal > 0 ? 'amount-positive' : childBal < 0 ? 'amount-negative' : 'amount-zero'}`}>
                                    {formatCurrency(childBal)}
                                  </td>
                                  <td>
                                    <div className="flex gap-2 justify-end">
                                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(child)}><Pencil size={14} /></button>
                                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDeleteId(child.id)} style={{ color: 'var(--red)' }}><Trash2 size={14} /></button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>

      {(modal === 'create' || (modal && modal !== 'create')) && (
        <AccountModal
          account={modal === 'create' ? null : modal}
          accounts={accounts}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Account</h2>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-2)' }}>
                Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{accounts.find(a => a.id === deleteId)?.name}</strong>?
                This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete Account</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
