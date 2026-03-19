import { useState, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import { DS } from "./design/tokens";
import { FontLoader, GlobalStyles } from "./design/GlobalStyles";
import { ConfigProvider } from "./lib/config.jsx";
import { isTeamUser } from "./lib/auth";
import { trackEvent } from "./lib/analytics";
import { seoPages } from "./data/seo";
import { PublicSite } from "./views/PublicSite";
import { ClientPortal } from "./views/ClientPortal";
import { TeamDashboard } from "./views/TeamDashboard";
import { RevenueCaptureTool } from "./views/RevenueCaptureTool";
import { Login } from "./views/Login";
import { PasswordResetView } from "./views/PasswordResetView";
import { MarketingLandingPage } from "./views/MarketingLandingPage";
import { SecurityPage } from "./views/SecurityPage";
import { PrivacyPolicy } from "./views/PrivacyPolicy";
import { TermsOfService } from "./views/TermsOfService";

const getRouteIntent = () => {
  if (typeof window === "undefined") return null;
  const path = (window.location.pathname || "").toLowerCase();
  if (path === "/multi-clinic-provider-coding") return "seo-multi-clinic";
  if (path === "/orthopedic-coding-revenue-capture") return "seo-ortho-capture";
  if (path === "/small-practice-underbilling-tool") return "seo-underbilling-tool";
  if (path === "/security") return "security";
  if (path === "/privacy") return "privacy";
  if (path === "/terms") return "terms";
  if (path === "/reset-password") return "reset";
  if (path === "/demo") return "demo";
  if (path === "/login") return "login";
  if (path === "/team") return "team";
  if (path === "/tool" || path === "/app") return "tool";
  if (window.location.search.includes("audience=") && path.includes("reset-password")) return "reset";
  if (window.location.search.includes("team")) return "team";
  if (window.location.search.includes("tool")) return "tool";
  return null;
};

const viewToUrl = (view) => {
  if (view === "seo-multi-clinic") return "/multi-clinic-provider-coding";
  if (view === "seo-ortho-capture") return "/orthopedic-coding-revenue-capture";
  if (view === "seo-underbilling-tool") return "/small-practice-underbilling-tool";
  if (view === "security") return "/security";
  if (view === "privacy") return "/privacy";
  if (view === "terms") return "/terms";
  if (view === "password-reset") return "/reset-password";
  if (view === "tool-demo") return "/demo";
  if (view === "login") return "/login";
  if (view === "team" || view === "team-login") return "/team";
  if (view === "tool" || view === "practice-login") return "/tool";
  return "/";
};

export default function App() {
  const [currentView, setCurrentView] = useState("public");
  const [teamUser, setTeamUser] = useState(null);
  const [practiceUser, setPracticeUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const hasInitializedHistory = useRef(false);
  const isPopNavigating = useRef(false);

  const resolveIntentToView = (intent) => {
    if (intent === "seo-multi-clinic") return "seo-multi-clinic";
    if (intent === "seo-ortho-capture") return "seo-ortho-capture";
    if (intent === "seo-underbilling-tool") return "seo-underbilling-tool";
    if (intent === "security") return "security";
    if (intent === "privacy") return "privacy";
    if (intent === "terms") return "terms";
    if (intent === "reset") return "password-reset";
    if (intent === "demo") return "tool-demo";
    if (intent === "login") return (teamUser || practiceUser) ? (teamUser ? "team" : "tool") : "login";
    if (intent === "team") return teamUser ? "team" : "login";
    if (intent === "tool") return practiceUser ? "tool" : "login";
    return "public";
  };

  useEffect(() => {
    const checkSession = async () => {
      const intent = getRouteIntent();
      const isSeoIntent = intent === "seo-multi-clinic" || intent === "seo-ortho-capture" || intent === "seo-underbilling-tool" || intent === "security" || intent === "privacy" || intent === "terms";

      if (!isSupabaseConfigured()) {
        if (isSeoIntent) setCurrentView(intent);
        if (intent === "reset") setCurrentView("password-reset");
        if (intent === "demo") setCurrentView("tool-demo");
        if (intent === "login") setCurrentView("login");
        if (intent === "team") setCurrentView("login");
        if (intent === "tool") setCurrentView("login");
        setCheckingAuth(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (isSeoIntent) {
          setCurrentView(intent);
          setCheckingAuth(false);
          return;
        }
        if (session?.user) {
          if (intent === "demo") { setCurrentView("tool-demo"); return; }
          if (intent === "reset") { setCurrentView("password-reset"); return; }
          if (isTeamUser(session.user)) {
            setTeamUser(session.user);
            if (intent === "team") setCurrentView("team");
            else if (intent === "tool") setCurrentView("practice-login");
          } else {
            setPracticeUser(session.user);
            if (intent === "tool") setCurrentView("tool");
          }
        } else if (intent === "login" || intent === "team" || intent === "tool") {
          setCurrentView("login");
        } else if (intent === "demo") {
          setCurrentView("tool-demo");
        } else if (intent === "reset") {
          setCurrentView("password-reset");
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkSession();

    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          setTeamUser(null);
          setPracticeUser(null);
          setCurrentView("public");
        } else if (event === "PASSWORD_RECOVERY") {
          setCurrentView("password-reset");
        } else if (session?.user) {
          if (isTeamUser(session.user)) {
            setTeamUser(session.user);
            setPracticeUser(null);
            if (event === "SIGNED_IN") setCurrentView("team");
          } else {
            setPracticeUser(session.user);
            setTeamUser(null);
            if (event === "SIGNED_IN") setCurrentView("tool");
          }
        }
      });

      return () => subscription?.unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (checkingAuth || typeof window === "undefined") return;

    const targetUrl = viewToUrl(currentView);
    const state = { defyb: true, view: currentView };

    if (!hasInitializedHistory.current) {
      const directDeepLink = currentView !== "public" && window.history.length <= 1;
      if (directDeepLink) {
        window.history.replaceState({ defyb: true, view: "public" }, "", "/");
        window.history.pushState(state, "", targetUrl);
      } else {
        window.history.replaceState(state, "", targetUrl);
      }
      hasInitializedHistory.current = true;
      return;
    }

    if (isPopNavigating.current) {
      isPopNavigating.current = false;
      return;
    }

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) {
      window.history.pushState(state, "", targetUrl);
    }
  }, [currentView, checkingAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = (event) => {
      isPopNavigating.current = true;
      const popView = event.state?.defyb ? event.state.view : null;
      if (popView) {
        setCurrentView(popView);
        return;
      }
      setCurrentView(resolveIntentToView(getRouteIntent()));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [teamUser, practiceUser]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const seoConfig = seoPages[currentView];
    const title = seoConfig?.title || "DeFyb — Defying the Death of Small Practices";
    const description = seoConfig?.description || "Revenue capture and coding intelligence for small practices.";
    const canonicalPath = viewToUrl(currentView);
    const canonicalUrl = `https://defyb.org${canonicalPath}`;
    document.title = title;

    const upsertMeta = (selector, attr, attrValue, content) => {
      let node = document.querySelector(selector);
      if (!node) {
        node = document.createElement("meta");
        node.setAttribute(attr, attrValue);
        document.head.appendChild(node);
      }
      node.setAttribute("content", content);
    };

    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", "DeFyb");
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonicalUrl);

    trackEvent("page_view", { page: currentView, path: canonicalPath });
  }, [currentView]);

  const handleUnifiedLogin = (user) => {
    if (isTeamUser(user)) {
      setTeamUser(user);
      setPracticeUser(null);
      setCurrentView("team");
    } else {
      setPracticeUser(user);
      setTeamUser(null);
      setCurrentView("tool");
    }
  };

  const handleTeamLogout = async () => {
    if (isSupabaseConfigured()) await supabase.auth.signOut();
    setTeamUser(null);
    setPracticeUser(null);
    setCurrentView("public");
  };

  const handleRequestTeamAccess = (source = "unknown") => {
    trackEvent("cta_team_access_click", { source });
    setCurrentView(teamUser ? "team" : "login");
  };

  const handleRequestPracticeAccess = (source = "unknown") => {
    trackEvent("cta_practice_access_click", { source });
    setCurrentView(practiceUser ? "tool" : "login");
  };

  const handleStartDemo = (source = "unknown") => {
    trackEvent("cta_demo_start_click", { source });
    setCurrentView("tool-demo");
  };

  const handlePasswordResetDone = async () => {
    if (isSupabaseConfigured()) await supabase.auth.signOut();
    setCurrentView("login");
  };

  if (checkingAuth) {
    return (
      <>
        <FontLoader />
        <GlobalStyles />
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          color: DS.colors.textMuted,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>⚡</div>
            Loading...
          </div>
        </div>
      </>
    );
  }

  return (
    <ConfigProvider>
      <FontLoader />
      <GlobalStyles />
      {currentView === "public" && (
        <PublicSite
          onLogin={handleRequestTeamAccess}
          onClientLogin={handleRequestPracticeAccess}
          onDemoStart={handleStartDemo}
        />
      )}
      {(currentView === "seo-multi-clinic" || currentView === "seo-ortho-capture" || currentView === "seo-underbilling-tool") && (
        <MarketingLandingPage
          pageKey={currentView}
          kicker={seoPages[currentView].kicker}
          title={seoPages[currentView].headline}
          subtitle={seoPages[currentView].subtitle}
          bullets={seoPages[currentView].bullets}
          faqs={seoPages[currentView].faqs}
          onClientLogin={handleRequestPracticeAccess}
          onDemoStart={handleStartDemo}
          onBack={() => setCurrentView("public")}
        />
      )}
      {currentView === "security" && (
        <SecurityPage onBack={() => setCurrentView("public")} />
      )}
      {currentView === "privacy" && (
        <PrivacyPolicy onBack={() => setCurrentView("public")} />
      )}
      {currentView === "terms" && (
        <TermsOfService onBack={() => setCurrentView("public")} />
      )}
      {currentView === "login" && (
        <Login
          onLogin={handleUnifiedLogin}
          onDemoStart={handleStartDemo}
          onBack={() => setCurrentView("public")}
        />
      )}
      {currentView === "practice-login" && (
        <Login
          audience="practice"
          onLogin={handleUnifiedLogin}
          onDemoStart={handleStartDemo}
          onBack={() => setCurrentView("public")}
        />
      )}
      {currentView === "team-login" && (
        <Login
          audience="team"
          onLogin={handleUnifiedLogin}
          onBack={() => setCurrentView("public")}
        />
      )}
      {currentView === "password-reset" && (
        <PasswordResetView onDone={handlePasswordResetDone} />
      )}
      {currentView === "team" && (
        teamUser ? (
          <TeamDashboard onBack={handleTeamLogout} />
        ) : (
          <Login
            audience="team"
            onLogin={handleUnifiedLogin}
            onBack={() => setCurrentView("public")}
          />
        )
      )}
      {currentView === "tool" && (
        practiceUser ? (
          <RevenueCaptureTool onBack={handleTeamLogout} />
        ) : (
          <Login
            audience="practice"
            onLogin={handleUnifiedLogin}
            onDemoStart={handleStartDemo}
            onBack={() => setCurrentView("public")}
          />
        )
      )}
      {currentView === "tool-demo" && (
        <RevenueCaptureTool
          demoMode
          onBack={() => setCurrentView("public")}
        />
      )}
    </ConfigProvider>
  );
}
