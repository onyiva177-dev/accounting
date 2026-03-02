-- ============================================================
-- AI Accounting System - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  company_name TEXT,
  avatar_url TEXT,
  currency TEXT DEFAULT 'USD',
  fiscal_year_start INT DEFAULT 1, -- 1 = January
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACCOUNTS (Chart of Accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT, -- e.g., "1000", "2000"
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  subtype TEXT, -- e.g., 'cash', 'accounts_receivable', 'credit_card'
  description TEXT,
  balance NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  parent_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'tag',
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT, -- invoice/receipt number
  vendor TEXT,
  status TEXT DEFAULT 'cleared' CHECK (status IN ('pending', 'cleared', 'reconciled', 'void')),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_interval TEXT, -- 'daily','weekly','monthly','yearly'
  tags TEXT[],
  ai_category_confidence NUMERIC(3,2), -- AI confidence score 0-1
  ai_suggested_category TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_address TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  discount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  total NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL,
  period TEXT DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('anomaly', 'forecast', 'tip', 'alert', 'summary')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'positive')),
  related_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VIEWS
-- ============================================================

-- Monthly summary view
CREATE OR REPLACE VIEW monthly_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', date) AS month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expenses,
  SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_profit
FROM transactions
WHERE status != 'void'
GROUP BY user_id, DATE_TRUNC('month', date);

-- Category spending view
CREATE OR REPLACE VIEW category_spending AS
SELECT
  t.user_id,
  c.name AS category_name,
  c.color,
  c.type,
  DATE_TRUNC('month', t.date) AS month,
  SUM(t.amount) AS total,
  COUNT(*) AS transaction_count
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.status != 'void'
GROUP BY t.user_id, c.name, c.color, c.type, DATE_TRUNC('month', t.date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Generic user_id policies for all tables
CREATE POLICY "Users own their accounts" ON accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their categories" ON categories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their transactions" ON transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their invoices" ON invoices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their budgets" ON budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their insights" ON ai_insights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own their audit log" ON audit_log FOR SELECT USING (auth.uid() = user_id);

-- Invoice items: access via invoice ownership
CREATE POLICY "Users own invoice items" ON invoice_items FOR ALL USING (
  invoice_id IN (SELECT id FROM invoices WHERE user_id = auth.uid())
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update account balance after transaction
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverse old, apply new
    IF OLD.type = 'income' THEN
      UPDATE accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    END IF;
    IF NEW.type = 'income' THEN
      UPDATE accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- SEED DATA (Default categories)
-- ============================================================
-- Note: These need to be inserted per-user. Below is a reference.
-- In the app, call a function to seed categories on first login.

-- Example default income categories:
-- Freelance, Salary, Investment Returns, Rental Income, Other Income

-- Example default expense categories:
-- Housing, Transportation, Food & Dining, Utilities, Healthcare,
-- Entertainment, Software & Tools, Marketing, Office Supplies,
-- Payroll, Taxes, Insurance, Travel, Education, Other Expenses
