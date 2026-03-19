import { useState } from "react";
import { DS } from "../design/tokens";
import { Button, Card } from "../components/ui";
import { DeFybLogo } from "../components/svg";
import { supabase, isSupabaseConfigured } from "../supabase";
import { normalizeAuthError } from "../lib/auth";
import { trackEvent } from "../lib/analytics";

const MODE_MAGIC = "magic";
const MODE_PASSWORD = "password";

export const Login = ({ onLogin, onBack, onDemoStart, audience }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState(MODE_MAGIC);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [oauthUnavailable, setOauthUnavailable] = useState({ google: false, azure: false });

  const showGoogleAuth = import.meta.env.VITE_ENABLE_GOOGLE_AUTH !== "false";
  const showMicrosoftAuth = import.meta.env.VITE_ENABLE_MICROSOFT_AUTH !== "false";

  const redirectParam = audience === "team" ? "team=1" : "tool=1";

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Authentication not configured");
      return;
    }

    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}?${redirectParam}`,
        },
      });
      if (otpError) throw otpError;
      trackEvent("login_magic_link_sent", { audience });
      setNotice("Check your inbox — click the link and you're in. Works for new and existing accounts.");
    } catch (err) {
      setError(normalizeAuthError(err, "magic"));
    } finally {
      setLoading(false);
    }
  };

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
      trackEvent("login_password_success", { audience });
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
          redirectTo: `${window.location.origin}?${redirectParam}`,
          queryParams: provider === "azure" ? { prompt: "select_account" } : undefined,
        },
      });
      if (authError) throw authError;
      trackEvent("login_oauth_start", { provider, audience });
    } catch (err) {
      const raw = String(err?.message || err || "").toLowerCase();
      if (raw.includes("unsupported provider") || raw.includes("provider is not enabled")) {
        setOauthUnavailable((prev) => ({ ...prev, [provider]: true }));
        setError(`${provider === "google" ? "Google" : "Microsoft"} sign-in is not enabled yet. Use email instead.`);
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
      setError("Type your email above, then tap reset.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Authentication not configured");
      return;
    }

    setLoading(true);
    try {
      const aud = audience || "practice";
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password?audience=${aud}`,
      });
      if (resetError) throw resetError;
      setNotice(`Password reset link sent to ${email.trim()}.`);
    } catch (err) {
      setError(normalizeAuthError(err, "password"));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    background: DS.colors.bg,
    border: `1px solid ${DS.colors.borderLight}`,
    borderRadius: DS.radius.sm,
    color: DS.colors.text,
    fontSize: "15px",
    fontFamily: DS.fonts.body,
    outline: "none",
    transition: "border-color 0.2s ease",
  };

  const labelStyle = {
    display: "block",
    fontSize: "12px",
    color: DS.colors.textMuted,
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: 600,
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `linear-gradient(170deg, ${DS.colors.bg} 0%, #e4ecf2 100%)`,
    }}>
      <Card style={{
        width: "100%",
        maxWidth: "440px",
        margin: "20px",
        borderTop: `3px solid ${DS.colors.shock}`,
        background: DS.colors.bgCard,
        boxShadow: DS.shadow.deep,
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <DeFybLogo size={36} />
          <h1 style={{
            fontFamily: DS.fonts.display,
            fontSize: "22px",
            color: DS.colors.text,
            margin: "12px 0 6px",
            fontWeight: 600,
          }}>
            Welcome to DeFyb
          </h1>
          <p style={{ fontSize: "14px", color: DS.colors.textMuted, margin: 0 }}>
            Sign in or get started — same door for everyone.
          </p>
        </div>

        {/* -- Demo banner for new users (prominent, above everything) -- */}
        {onDemoStart && (
          <div
            onClick={() => !loading && onDemoStart()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px 16px",
              marginBottom: "20px",
              background: DS.colors.vitalDim,
              border: `1px solid ${DS.colors.vital}33`,
              borderRadius: DS.radius.md,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: "20px", lineHeight: 1 }}>&#9889;</span>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: DS.colors.vital }}>
                New here? Try the instant demo
              </div>
              <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginTop: "2px" }}>
                See the revenue tool in action — no account needed.
              </div>
            </div>
          </div>
        )}

        {/* -- OAuth buttons -- */}
        {(showGoogleAuth || showMicrosoftAuth) && (
          <>
            <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
              {showGoogleAuth && (
                <button
                  onClick={() => !loading && !oauthUnavailable.google && handleOAuth("google")}
                  disabled={loading || oauthUnavailable.google}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    background: DS.colors.bgCard,
                    border: `1px solid ${DS.colors.borderLight}`,
                    borderRadius: DS.radius.md,
                    cursor: (loading || oauthUnavailable.google) ? "not-allowed" : "pointer",
                    fontFamily: DS.fonts.body,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: DS.colors.text,
                    opacity: (loading || oauthUnavailable.google) ? 0.5 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {oauthUnavailable.google ? "Google unavailable" : "Continue with Google"}
                </button>
              )}
              {showMicrosoftAuth && (
                <button
                  onClick={() => !loading && !oauthUnavailable.azure && handleOAuth("azure")}
                  disabled={loading || oauthUnavailable.azure}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    background: DS.colors.bgCard,
                    border: `1px solid ${DS.colors.borderLight}`,
                    borderRadius: DS.radius.md,
                    cursor: (loading || oauthUnavailable.azure) ? "not-allowed" : "pointer",
                    fontFamily: DS.fonts.body,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: DS.colors.text,
                    opacity: (loading || oauthUnavailable.azure) ? 0.5 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 23 23">
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  {oauthUnavailable.azure ? "Microsoft unavailable" : "Continue with Microsoft"}
                </button>
              )}
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "0 0 20px",
            }}>
              <div style={{ flex: 1, height: "1px", background: DS.colors.borderLight }} />
              <span style={{
                fontSize: "11px",
                color: DS.colors.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}>
                or use email
              </span>
              <div style={{ flex: 1, height: "1px", background: DS.colors.borderLight }} />
            </div>
          </>
        )}

        {/* -- Email field (shared by magic link & password modes) -- */}
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@clinic.com"
            required
            autoComplete="email"
            autoFocus
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = DS.colors.shock; }}
            onBlur={(e) => { e.target.style.borderColor = DS.colors.borderLight; }}
          />
        </div>

        {/* -- Magic link mode (primary) -- */}
        {mode === MODE_MAGIC && (
          <form onSubmit={handleMagicLink}>
            {error && (
              <div style={{
                padding: "10px 14px", marginBottom: "14px", borderRadius: DS.radius.sm,
                background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
              }}>
                {error}
              </div>
            )}
            {notice && (
              <div style={{
                padding: "12px 14px", marginBottom: "14px", borderRadius: DS.radius.sm,
                background: DS.colors.vitalDim, color: DS.colors.vital, fontSize: "13px",
                lineHeight: 1.5,
              }}>
                {notice}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%",
              padding: "13px 28px",
              background: `linear-gradient(140deg, ${DS.colors.shock}, ${DS.colors.shockLight})`,
              color: "#fff",
              border: "none",
              borderRadius: DS.radius.md,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: DS.fonts.body,
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.01em",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.2s ease",
              boxShadow: DS.shadow.glow,
            }}>
              {loading ? "Sending..." : "Continue with email"}
            </button>

            <p style={{
              textAlign: "center",
              marginTop: "14px",
              fontSize: "13px",
              color: DS.colors.textDim,
            }}>
              We'll email you a sign-in link — no password needed.
            </p>

            <p style={{
              textAlign: "center",
              marginTop: "10px",
              fontSize: "12px",
              color: DS.colors.textDim,
            }}>
              <span
                onClick={() => { setMode(MODE_PASSWORD); setError(null); setNotice(null); }}
                style={{ color: DS.colors.shock, cursor: "pointer", fontWeight: 500 }}
              >
                Use password instead
              </span>
            </p>
          </form>
        )}

        {/* -- Password mode (secondary) -- */}
        {mode === MODE_PASSWORD && (
          <form onSubmit={handlePasswordLogin}>
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = DS.colors.shock; }}
                onBlur={(e) => { e.target.style.borderColor = DS.colors.borderLight; }}
              />
            </div>

            {error && (
              <div style={{
                padding: "10px 14px", marginBottom: "14px", borderRadius: DS.radius.sm,
                background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
              }}>
                {error}
              </div>
            )}
            {notice && (
              <div style={{
                padding: "12px 14px", marginBottom: "14px", borderRadius: DS.radius.sm,
                background: DS.colors.vitalDim, color: DS.colors.vital, fontSize: "13px",
                lineHeight: 1.5,
              }}>
                {notice}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: "100%",
              padding: "13px 28px",
              background: `linear-gradient(140deg, ${DS.colors.shock}, ${DS.colors.shockLight})`,
              color: "#fff",
              border: "none",
              borderRadius: DS.radius.md,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: DS.fonts.body,
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.01em",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.2s ease",
              boxShadow: DS.shadow.glow,
            }}>
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "14px",
              fontSize: "12px",
            }}>
              <span
                onClick={() => { setMode(MODE_MAGIC); setError(null); setNotice(null); }}
                style={{ color: DS.colors.shock, cursor: "pointer", fontWeight: 500 }}
              >
                Use email link instead
              </span>
              <span
                onClick={() => !loading && handlePasswordReset()}
                style={{ color: DS.colors.textDim, cursor: "pointer" }}
              >
                Forgot password?
              </span>
            </div>
          </form>
        )}

        {/* -- Footer -- */}
        <div style={{
          marginTop: "24px",
          paddingTop: "16px",
          borderTop: `1px solid ${DS.colors.borderLight}`,
          textAlign: "center",
          fontSize: "13px",
          color: DS.colors.textDim,
        }}>
          <span
            onClick={onBack}
            style={{ color: DS.colors.textMuted, cursor: "pointer" }}
          >
            &larr; Back to site
          </span>
        </div>
      </Card>
    </div>
  );
};
