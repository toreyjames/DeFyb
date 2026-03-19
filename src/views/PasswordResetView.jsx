import { useState, useEffect } from "react";
import { DS } from "../design/tokens";
import { Card } from "../components/ui";
import { DeFybLogo } from "../components/svg";
import { supabase, isSupabaseConfigured } from "../supabase";
import { normalizeAuthError } from "../lib/auth";

export const PasswordResetView = ({ onDone }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    const checkRecoverySession = async () => {
      if (!isSupabaseConfigured()) {
        setError("Authentication not configured");
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setHasRecoverySession(!!session?.user);
      } catch {
        setHasRecoverySession(false);
      }
    };
    checkRecoverySession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!password || password.length < 8) {
      setError("Use at least 8 characters for the new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Authentication not configured");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice("Password updated. You can now sign in.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(normalizeAuthError(err, "password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{
        width: "100%",
        maxWidth: "420px",
        margin: "20px",
        borderTop: `3px solid ${DS.colors.shock}`,
        background: `linear-gradient(180deg, ${DS.colors.bgCard}, #fbfdff)`,
      }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <DeFybLogo size={32} />
          <div style={{ fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.vital, marginTop: "8px", letterSpacing: "0.1em" }}>
            RESET PASSWORD
          </div>
        </div>

        {!hasRecoverySession && !notice && (
          <div style={{
            padding: "10px 14px", marginBottom: "16px", borderRadius: DS.radius.sm,
            background: DS.colors.warnDim, color: DS.colors.warn, fontSize: "13px",
          }}>
            Recovery link is missing or expired. Request a new password reset email.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              style={{
                width: "100%", padding: "10px 12px", background: DS.colors.bg,
                border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                color: DS.colors.text, fontSize: "14px", outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
              style={{
                width: "100%", padding: "10px 12px", background: DS.colors.bg,
                border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                color: DS.colors.text, fontSize: "14px", outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", marginBottom: "16px", borderRadius: DS.radius.sm,
              background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
            }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{
              padding: "10px 14px", marginBottom: "16px", borderRadius: DS.radius.sm,
              background: DS.colors.vitalDim, color: DS.colors.vital, fontSize: "13px",
            }}>
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !hasRecoverySession}
            style={{
              width: "100%", padding: "12px 28px",
              background: DS.colors.shock, color: "#fff",
              border: "none", borderRadius: DS.radius.md,
              cursor: loading || !hasRecoverySession ? "not-allowed" : "pointer", fontFamily: DS.fonts.body,
              fontSize: "15px", fontWeight: 500, letterSpacing: "0.01em",
              opacity: (loading || !hasRecoverySession) ? 0.65 : 1, transition: "all 0.2s ease",
            }}
          >
            {loading ? "Updating..." : "Set New Password"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <span onClick={onDone} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}>
            Return to login
          </span>
        </div>
      </Card>
    </div>
  );
};
