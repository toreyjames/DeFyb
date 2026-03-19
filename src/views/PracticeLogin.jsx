import { useState } from "react";
import { DS } from "../design/tokens";
import { Button, Card } from "../components/ui";
import { DeFybLogo } from "../components/svg";
import { supabase, isSupabaseConfigured } from "../supabase";
import { normalizeAuthError } from "../lib/auth";
import { trackEvent } from "../lib/analytics";

export const PracticeLogin = ({ onLogin, onBack, onDemoStart }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [oauthUnavailable, setOauthUnavailable] = useState({ google: false, azure: false });
  const showGoogleAuth = import.meta.env.VITE_ENABLE_GOOGLE_AUTH !== "false";
  const showMicrosoftAuth = import.meta.env.VITE_ENABLE_MICROSOFT_AUTH !== "false";

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    if (!isSupabaseConfigured()) {
      setError("Authentication not configured");
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (data.user) onLogin(data.user);
    } catch (err) {
      setError(normalizeAuthError(err, "password"));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setLoading(true);
    setError(null);
    setNotice(null);

    if (!isSupabaseConfigured()) {
      setError("Authentication not configured");
      setLoading(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin + "?tool=1",
          queryParams: provider === "azure" ? { prompt: "select_account" } : undefined,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      const raw = String(err?.message || err || "").toLowerCase();
      if (raw.includes("unsupported provider") || raw.includes("provider is not enabled")) {
        setOauthUnavailable((prev) => ({ ...prev, [provider]: true }));
        setError(`${provider === "google" ? "Google" : "Microsoft"} sign-in is not enabled in Supabase yet. Use email/password for now.`);
      } else {
        setError(normalizeAuthError(err, "oauth"));
      }
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Enter your email first, then click reset password.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Authentication not configured");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password?audience=practice`,
      });
      if (resetError) throw resetError;
      setNotice(`Password reset email sent to ${email.trim()}.`);
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
            PRACTICE ACCESS
          </div>
          <div style={{ marginTop: "10px", fontSize: "14px", color: DS.colors.textMuted }}>
            Sign in to the revenue capture workspace.
          </div>
        </div>

        {(showGoogleAuth || showMicrosoftAuth) && (
          <div style={{ display: "grid", gap: "10px", marginBottom: "16px" }}>
            {showGoogleAuth && (
              <Button onClick={() => !loading && !oauthUnavailable.google && handleOAuth("google")} style={{ width: "100%", opacity: (loading || oauthUnavailable.google) ? 0.55 : 1 }}>
                {oauthUnavailable.google ? "Google (Unavailable)" : "Continue with Google"}
              </Button>
            )}
            {showMicrosoftAuth && (
              <Button onClick={() => !loading && !oauthUnavailable.azure && handleOAuth("azure")} style={{ width: "100%", opacity: (loading || oauthUnavailable.azure) ? 0.55 : 1 }}>
                {oauthUnavailable.azure ? "Microsoft (Unavailable)" : "Continue with Microsoft"}
              </Button>
            )}
          </div>
        )}

        <div style={{ fontSize: "11px", color: DS.colors.textDim, marginBottom: "14px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Email and password
        </div>

        <form onSubmit={handlePasswordLogin}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Clinic Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@clinic.com"
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
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
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

          <button type="submit" style={{
            width: "100%", padding: "12px 28px",
            background: DS.colors.shock, color: "#fff",
            border: "none", borderRadius: DS.radius.md,
            cursor: "pointer", fontFamily: DS.fonts.body,
            fontSize: "15px", fontWeight: 500, letterSpacing: "0.01em",
            opacity: loading ? 0.7 : 1, transition: "all 0.2s ease",
          }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: DS.colors.textDim }}>
          <span onClick={() => !loading && handlePasswordReset()} style={{ color: DS.colors.shock, cursor: "pointer" }}>Forgot password</span>
        </p>
        <p style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: DS.colors.textDim }}>
          New practice? <span onClick={() => !loading && onDemoStart?.()} style={{ color: DS.colors.shock, cursor: "pointer" }}>Run instant demo</span> or{" "}
          <span onClick={() => (window.location.href = "mailto:torey@defyb.org?subject=DeFyb%20Practice%20Onboarding")} style={{ color: DS.colors.shock, cursor: "pointer" }}>
            request onboarding
          </span>
        </p>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <span onClick={onBack} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}>
            ← Back to site
          </span>
        </div>
      </Card>
    </div>
  );
};
