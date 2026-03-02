# LedgerPro — Double-Entry Accounting System

A production-ready double-entry accounting system built with Next.js 14, Supabase, and PostgreSQL.

## Features

- ✅ Email/password authentication with session persistence
- ✅ Chart of Accounts with hierarchy support
- ✅ Double-entry journal entries (debits must equal credits)
- ✅ Real-time account balance computation from journal lines
- ✅ Trial Balance report
- ✅ Profit & Loss (Income Statement)
- ✅ Balance Sheet with accounting equation verification
- ✅ Row Level Security — users only see their own data
- ✅ Default chart of accounts seeded on registration

---

## 1. Supabase Setup

### Step 1: Run the initial schema
In your Supabase dashboard → SQL Editor, run `supabase_schema.sql` first.

### Step 2: Run the double-entry schema
Then run `supabase_schema_double_entry.sql` to create:
- `journal_entries` table
- `journal_lines` table
- Account balance views
- RLS policies

---

## 2. Running Locally

```bash
# Clone or unzip the project
cd double-entry-accounting

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 3. Environment Variables

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://nvxzlbzuknkrufxjeurt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 4. Deploying to Vercel

### Option A: Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B: GitHub Import
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

---

## Accounting Logic

### Double-Entry Rules
- Every journal entry has at least 2 lines
- Total Debits = Total Credits (enforced in UI)
- **Debit-normal accounts**: Assets, Expenses (increase on debit)
- **Credit-normal accounts**: Liabilities, Equity, Revenue (increase on credit)

### Balance Computation
Balances are computed dynamically from `journal_lines`, not stored:
```sql
-- Assets & Expenses
balance = SUM(debit) - SUM(credit)

-- Liabilities, Equity, Revenue  
balance = SUM(credit) - SUM(debit)
```

### Accounting Equation
`Assets = Liabilities + Equity + (Revenue - Expenses)`

---

## Folder Structure

```
src/
├── app/
│   ├── login/page.js
│   ├── register/page.js
│   ├── dashboard/
│   │   ├── layout.js
│   │   ├── page.js (Dashboard overview)
│   │   ├── accounts/page.js (Chart of Accounts)
│   │   ├── journal/page.js (Journal Entries)
│   │   └── reports/
│   │       ├── trial-balance/page.js
│   │       ├── profit-loss/page.js
│   │       └── balance-sheet/page.js
│   ├── globals.css
│   └── layout.js
├── components/
│   └── layout/Sidebar.js
├── lib/
│   ├── supabase/
│   │   ├── client.js
│   │   └── server.js
│   └── utils.js
└── middleware.js
```
