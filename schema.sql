-- run this once (Render Shell or any SQL client)
CREATE TABLE IF NOT EXISTS waitlist (
  id BIGSERIAL PRIMARY KEY,
  email TEXT,
  phone TEXT,
  source_page TEXT,
  user_agent TEXT,
  ip INET,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT at_least_one CHECK (
    (email IS NOT NULL AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    OR (phone IS NOT NULL AND phone ~* '^\+?[0-9\s().-]{7,}$')
  )
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_email_lower ON waitlist ((lower(email)));
