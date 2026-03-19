import { DS } from "../design/tokens";
import { Button, Card } from "../components/ui";
import { DeFybLogo, HeartbeatLine } from "../components/svg";
import { trackEvent } from "../lib/analytics";

export const MarketingLandingPage = ({
  pageKey,
  kicker,
  title,
  subtitle,
  bullets = [],
  faqs = [],
  onClientLogin,
  onDemoStart,
  onBack,
}) => (
  <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px clamp(16px, 4vw, 80px)",
      background: `${DS.colors.bg}ee`, backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${DS.colors.border}`,
    }}>
      <div onClick={onBack} style={{ cursor: "pointer" }}>
        <DeFybLogo size={28} />
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Button
          small
          onClick={() => {
            trackEvent("cta_demo_click", { surface: "seo_nav", page: pageKey });
            onDemoStart(`seo_nav_${pageKey}`);
          }}
        >
          Try Demo
        </Button>
        <Button
          primary
          small
          onClick={() => {
            trackEvent("cta_practice_login_click", { surface: "seo_nav", page: pageKey });
            onClientLogin(`seo_nav_${pageKey}`);
          }}
        >
          Login
        </Button>
      </div>
    </nav>

    <div style={{ width: "100%", maxWidth: "980px", margin: "0 auto", padding: "110px 22px 40px" }}>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "11px",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: DS.colors.shock,
        marginBottom: "14px",
        padding: "6px 10px",
        borderRadius: "999px",
        border: `1px solid ${DS.colors.border}`,
        background: DS.colors.bgCard,
      }}>
        {kicker}
      </div>
      <h1 style={{
        fontFamily: DS.fonts.display,
        fontSize: "clamp(30px, 5vw, 56px)",
        lineHeight: 1.05,
        letterSpacing: "-0.03em",
        marginBottom: "14px",
      }}>
        {title}
      </h1>
      <p style={{ fontSize: "18px", color: DS.colors.textMuted, marginBottom: "20px", maxWidth: "860px" }}>
        {subtitle}
      </p>
      <HeartbeatLine width={240} style={{ marginBottom: "18px" }} />
      <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
        {bullets.map((item, idx) => (
          <Card key={idx} style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: "14px", color: DS.colors.textMuted }}>• {item}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "26px" }}>
        <Button
          primary
          onClick={() => {
            trackEvent("cta_demo_click", { surface: "seo_hero", page: pageKey });
            onDemoStart(`seo_hero_${pageKey}`);
          }}
        >
          Try 2-Minute Demo
        </Button>
        <Button
          onClick={() => {
            trackEvent("cta_practice_login_click", { surface: "seo_hero", page: pageKey });
            onClientLogin(`seo_hero_${pageKey}`);
          }}
        >
          Login to Start the Tool
        </Button>
      </div>
      <div style={{ fontSize: "12px", color: DS.colors.textDim, marginBottom: "10px" }}>
        Related pages:
        {" "}
        <span
          style={{ color: DS.colors.shock, cursor: "pointer" }}
          onClick={() => {
            trackEvent("cta_related_page_click", { from: pageKey, to: "multi_clinic" });
            window.location.href = "/multi-clinic-provider-coding";
          }}
        >
          Multi-clinic providers
        </span>
        {" · "}
        <span
          style={{ color: DS.colors.shock, cursor: "pointer" }}
          onClick={() => {
            trackEvent("cta_related_page_click", { from: pageKey, to: "ortho_capture" });
            window.location.href = "/orthopedic-coding-revenue-capture";
          }}
        >
          Orthopedic coding
        </span>
        {" · "}
        <span
          style={{ color: DS.colors.shock, cursor: "pointer" }}
          onClick={() => {
            trackEvent("cta_related_page_click", { from: pageKey, to: "underbilling_tool" });
            window.location.href = "/small-practice-underbilling-tool";
          }}
        >
          Underbilling tool
        </span>
      </div>

      <Card>
        <div style={{ fontWeight: 600, marginBottom: "10px" }}>FAQ</div>
        <div style={{ display: "grid", gap: "10px" }}>
          {faqs.map((faq, idx) => (
            <div key={idx}>
              <div style={{ fontWeight: 600, fontSize: "13px" }}>{faq.q}</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>{faq.a}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);
