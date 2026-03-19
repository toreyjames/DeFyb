const allowedDomains = (import.meta.env.VITE_ALLOWED_TEAM_DOMAINS || "defyb.org")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const allowedEmails = (import.meta.env.VITE_ALLOWED_TEAM_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const isAllowedWorkEmail = (candidateEmail = "") => {
  const normalized = candidateEmail.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  const domain = normalized.split("@")[1];
  if (allowedEmails.includes(normalized)) return true;
  return allowedDomains.includes(domain);
};

export const isTeamUser = (user) => {
  if (!user) return false;
  const role = (user.app_metadata?.role || user.user_metadata?.role || user.user_metadata?.user_role || "")
    .toString()
    .toLowerCase();
  if (role === "team" || role === "admin" || role === "owner") return true;
  return isAllowedWorkEmail(user.email || "");
};

export const normalizeAuthError = (err, mode = "generic") => {
  const raw = (err?.message || "").toLowerCase();

  if (!raw) {
    if (mode === "oauth") return "Sign-in provider failed. Try Google, Microsoft, or email/password.";
    if (mode === "password") return "Email or password is incorrect.";
    return "Unable to complete sign-in. Please try again.";
  }

  if (raw.includes("rate") || raw.includes("limit") || raw.includes("too many")) {
    return "Too many login attempts right now. Wait 5-10 minutes or use Google/Microsoft sign-in.";
  }
  if (raw.includes("invalid") && raw.includes("email")) {
    return "Use a valid clinic email format like name@clinic.com.";
  }
  if (raw.includes("invalid login credentials") || raw.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }
  if (raw.includes("network") || raw.includes("fetch")) {
    return "Network issue while signing in. Check your connection and try again.";
  }
  if (raw.includes("provider")) {
    return "Sign-in provider is not configured yet. Use email login for now.";
  }

  if (mode === "oauth") return "OAuth sign-in failed. Try again or use email login.";
  if (mode === "password") return "Email or password is incorrect.";
  if (mode === "magic") return "Sign-in link is unavailable. Use password or SSO.";
  return "Unable to complete sign-in. Please try again.";
};
