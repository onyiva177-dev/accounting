'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', company_name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, company_name: form.company_name }
      }
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Seed default accounts for new user
      await seedDefaultAccounts(supabase, data.user.id)
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function seedDefaultAccounts(supabase, userId) {
    const defaultAccounts = [
      { name: 'Cash and Cash Equivalents', code: '1000', type: 'asset' },
      { name: 'Accounts Receivable', code: '1100', type: 'asset' },
      { name: 'Prepaid Expenses', code: '1200', type: 'asset' },
      { name: 'Equipment', code: '1500', type: 'asset' },
      { name: 'Accounts Payable', code: '2000', type: 'liability' },
      { name: 'Accrued Liabilities', code: '2100', type: 'liability' },
      { name: 'Notes Payable', code: '2200', type: 'liability' },
      { name: "Owner's Equity", code: '3000', type: 'equity' },
      { name: 'Retained Earnings', code: '3100', type: 'equity' },
      { name: 'Service Revenue', code: '4000', type: 'revenue' },
      { name: 'Product Revenue', code: '4100', type: 'revenue' },
      { name: 'Salaries & Wages', code: '5000', type: 'expense' },
      { name: 'Rent Expense', code: '5100', type: 'expense' },
      { name: 'Utilities Expense', code: '5200', type: 'expense' },
      { name: 'Office Supplies', code: '5300', type: 'expense' },
      { name: 'Marketing & Advertising', code: '5400', type: 'expense' },
      { name: 'Depreciation Expense', code: '5500', type: 'expense' },
    ]

    await supabase.from('accounts').insert(
      defaultAccounts.map(a => ({ ...a, user_id: userId }))
    )
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">L</div>
          <span className="auth-logo-text">LedgerPro</span>
        </div>

        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Set up your accounting workspace</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                name="full_name"
                className="form-input"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                name="company_name"
                className="form-input"
                value={form.company_name}
                onChange={handleChange}
                placeholder="Acme Corp"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              name="email"
              className="form-input"
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="form-input"
              value={form.password}
              onChange={handleChange}
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full mt-4"
            disabled={loading}
            style={{ height: 42 }}
          >
            {loading ? <span className="loading-spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
