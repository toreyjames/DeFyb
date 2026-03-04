-- Security hardening: remove broad anonymous access policies.

-- Prevent anonymous users from inserting arbitrary team notifications.
DROP POLICY IF EXISTS "Anon can insert team notifications" ON notifications;

-- Prevent anonymous users from reading all pending signature documents.
-- If public signing links are needed, replace this with a token-bound policy.
DROP POLICY IF EXISTS "Anon can view public documents" ON documents;
