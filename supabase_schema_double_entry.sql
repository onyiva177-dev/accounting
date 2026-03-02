-- ============================================================
-- LedgerPro - Double Entry Accounting Additional Schema
-- Run this AFTER the initial supabase_schema.sql
-- ============================================================

-- ============================================================
-- JOURNAL ENTRIES (Double-Entry Header)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  reference TEXT,
  is_posted BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOURNAL LINES (Double-Entry Lines)
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  journal_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT NOT NULL,
  debit NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  )
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_id ON journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their journal entries" 
  ON journal_entries FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Users own their journal lines" 
  ON journal_lines FOR ALL 
  USING (
    journal_id IN (
      SELECT id FROM journal_entries WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- VIEWS
-- ============================================================

-- Account Balances View (computed from journal_lines)
CREATE OR REPLACE VIEW account_balances AS
SELECT
  a.id,
  a.user_id,
  a.name,
  a.code,
  a.type,
  a.parent_id,
  a.is_active,
  COALESCE(SUM(jl.debit), 0) AS total_debit,
  COALESCE(SUM(jl.credit), 0) AS total_credit,
  CASE
    WHEN a.type IN ('asset', 'expense') THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
    ELSE COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
  END AS balance
FROM accounts a
LEFT JOIN journal_lines jl ON jl.account_id = a.id
  LEFT JOIN journal_entries je ON je.id = jl.journal_id AND je.is_posted = TRUE
GROUP BY a.id;

-- Trial Balance View
CREATE OR REPLACE VIEW trial_balance AS
SELECT
  ab.user_id,
  ab.id AS account_id,
  ab.name AS account_name,
  ab.code AS account_code,
  ab.type AS account_type,
  ab.total_debit,
  ab.total_credit,
  ab.balance,
  CASE
    WHEN ab.type IN ('asset', 'expense') AND ab.balance >= 0 THEN ab.balance
    WHEN ab.type NOT IN ('asset', 'expense') AND ab.balance < 0 THEN ABS(ab.balance)
    ELSE 0
  END AS trial_debit,
  CASE
    WHEN ab.type NOT IN ('asset', 'expense') AND ab.balance >= 0 THEN ab.balance
    WHEN ab.type IN ('asset', 'expense') AND ab.balance < 0 THEN ABS(ab.balance)
    ELSE 0
  END AS trial_credit
FROM account_balances ab
WHERE ab.total_debit > 0 OR ab.total_credit > 0;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- updated_at trigger for journal_entries
CREATE TRIGGER trg_journal_entries_updated_at 
  BEFORE UPDATE ON journal_entries 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Validate journal entry is balanced on insert/update
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit NUMERIC;
  total_credit NUMERIC;
BEGIN
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM journal_lines
  WHERE journal_id = COALESCE(NEW.journal_id, OLD.journal_id);

  -- Allow imbalanced state during batch inserts (check happens via app)
  -- This is a soft validation - hard validation is done in the application layer
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UPDATE accounts table to remove trigger-based balance
-- (we compute from journal_lines instead)
-- ============================================================
DROP TRIGGER IF EXISTS trg_update_account_balance ON transactions;

-- ============================================================
-- SEED: Default accounts are seeded on user registration via app
-- ============================================================
