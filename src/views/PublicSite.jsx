import React, { useState, useEffect, useRef } from "react";
import { DS } from "../design/tokens";
import { Tag, Button, Card, SectionTitle } from "../components/ui";
import { HeartbeatLine, DeFybLogo } from "../components/svg";
import { FAILURE_POINTS, PROTOCOL_STEPS } from "../data/constants";
import { trackEvent } from "../lib/analytics";
import { supabase, isSupabaseConfigured } from "../supabase";

export const PublicSite = ({ onLogin, onClientLogin, onDemoStart }) => {
  const intakeRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);
  const [baselineRan, setBaselineRan] = useState(false);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [baseline, setBaseline] = useState({
    providers: "5",
    visitsPerProviderPerDay: "20",
    undercodedRate: "30",
    avgMissedPerVisit: "58",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});
  const [logoClicks, setLogoClicks] = useState(0);
  const logoClickTimer = useRef(null);
  const scrollToIntake = () => intakeRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);

    // Reset after 2 seconds of no clicks
    clearTimeout(logoClickTimer.current);
    logoClickTimer.current = setTimeout(() => setLogoClicks(0), 2000);

    // 3 clicks = team access
    if (newClicks >= 3) {
      setLogoClicks(0);
      onLogin();
    }
  };

  // Minimal front page: short message + direct login CTA.
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px clamp(16px, 4vw, 80px)",
        background: `${DS.colors.bg}ee`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${DS.colors.border}`,
      }}>
        <div onClick={handleLogoClick} style={{ cursor: "pointer" }}>
          <DeFybLogo size={28} />
        </div>
        <Button
          primary
          small
          onClick={() => {
            trackEvent("cta_practice_login_click", { surface: "home_nav" });
            onClientLogin("home_nav");
          }}
        >
          Login
        </Button>
      </nav>

      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "120px 24px 60px",
      }}>
        <div style={{ width: "100%", maxWidth: "920px", textAlign: "center" }}>
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
            Revenue Capture OS for Private Practices
          </div>
          <h1 style={{
            fontFamily: DS.fonts.display, fontSize: "clamp(34px, 6vw, 64px)",
            lineHeight: 1.03, marginBottom: "18px", letterSpacing: "-0.03em", fontWeight: 650,
          }}>
            Defying the death of small practices.
          </h1>
          <p style={{ fontSize: "18px", color: DS.colors.textMuted, marginBottom: "28px" }}>
            DeFyb catches underbilling from encounter documentation and shows exactly what to fix, so doctors protect margin without adding clicks.
          </p>
          <HeartbeatLine width={220} style={{ margin: "0 auto 24px" }} />
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
            <Button
              primary
              onClick={() => {
                trackEvent("cta_practice_login_click", { surface: "home_hero" });
                onClientLogin("home_hero");
              }}
            >
              Login to Start the Tool →
            </Button>
            <Button
              onClick={() => {
                trackEvent("cta_demo_click", { surface: "home_hero" });
                onDemoStart("home_hero");
              }}
            >
              Try 2-Minute Demo (No Login)
            </Button>
            <Button
              onClick={() => {
                trackEvent("cta_practice_access_request_click", { surface: "home_hero" });
                window.location.href = "mailto:torey@defyb.org?subject=DeFyb%20Practice%20Access";
              }}
            >
              Request Practice Access
            </Button>
          </div>
          <div style={{ marginTop: "12px", display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", fontSize: "12px" }}>
            <span
              style={{ color: DS.colors.shock, cursor: "pointer" }}
              onClick={() => {
                trackEvent("cta_related_page_click", { from: "home", to: "multi_clinic" });
                window.location.href = "/multi-clinic-provider-coding";
              }}
            >
              Multi-clinic provider workflow
            </span>
            <span
              style={{ color: DS.colors.shock, cursor: "pointer" }}
              onClick={() => {
                trackEvent("cta_related_page_click", { from: "home", to: "ortho_capture" });
                window.location.href = "/orthopedic-coding-revenue-capture";
              }}
            >
              Orthopedic revenue capture
            </span>
            <span
              style={{ color: DS.colors.shock, cursor: "pointer" }}
              onClick={() => {
                trackEvent("cta_related_page_click", { from: "home", to: "underbilling_tool" });
                window.location.href = "/small-practice-underbilling-tool";
              }}
            >
              Small-practice underbilling tool
            </span>
          </div>

          <div style={{
            marginTop: "34px",
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}>
            <Card style={{ textAlign: "left", padding: "16px" }}>
              <div style={{ fontSize: "11px", color: DS.colors.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Baseline Plan
              </div>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "30px", lineHeight: 1.1, margin: "6px 0" }}>
                $299<span style={{ fontSize: "16px", color: DS.colors.textMuted }}>/provider/mo</span>
              </div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                Tiered core pricing: $299 (1-5), $279 (6-20), $249 (21+) with a $599 clinic minimum.
              </div>
              <div style={{ marginTop: "10px", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: DS.colors.shock }}>
                One-time core implementation: $2,500
              </div>
            </Card>

            <Card style={{ textAlign: "left", padding: "16px" }}>
              <div style={{ fontSize: "11px", color: DS.colors.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Typical ROI Range
              </div>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "30px", lineHeight: 1.1, margin: "6px 0", color: DS.colors.vital }}>
                10x-30x
              </div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                Based on underbilling recovery signal in early reviews and faster billing clarification.
              </div>
            </Card>

            <Card style={{ textAlign: "left", padding: "16px" }}>
              <div style={{ fontSize: "11px", color: DS.colors.textDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Optional Add-Ons
              </div>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "24px", lineHeight: 1.1, margin: "8px 0 10px" }}>
                Claims, Prior Auth, DME, Scribe Connector
              </div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                Claims $99, Prior Auth $149, DME $199, Scribe Connector $49 (all per provider/month).
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );

  const baselineNumbers = (() => {
    const providerCount = Math.max(1, parseInt(baseline.providers || "0", 10) || 0);
    const visitsPerDay = Math.max(1, parseInt(baseline.visitsPerProviderPerDay || "0", 10) || 0);
    const undercodedRate = Math.max(0, parseFloat(baseline.undercodedRate || "0") || 0) / 100;
    const avgMissed = Math.max(0, parseFloat(baseline.avgMissedPerVisit || "0") || 0);
    const annualVisits = providerCount * visitsPerDay * 240;
    const undercodedVisits = Math.round(annualVisits * undercodedRate);
    const annualRecovery = Math.round(undercodedVisits * avgMissed);
    const monthlyRecovery = Math.round(annualRecovery / 12);

    return { providerCount, visitsPerDay, undercodedVisits, annualRecovery, monthlyRecovery };
  })();

  const handleSubmit = async () => {
    setError(null);

    // Validate required fields
    const required = ['name', 'specialty', 'providers', 'contact', 'email'];
    const missing = required.filter(key => !form[key]?.trim?.() && !form[key]);
    if (missing.length > 0) {
      setError('Please fill in all required fields (marked with *)');
      return;
    }

    // Basic email validation
    if (form.email && !form.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.error('Supabase not configured');
      setError('Form submission is temporarily unavailable. Please email us directly at torey@defyb.org');
      setSubmitting(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('practices')
        .insert({
          name: form.name,
          address: form.address,
          city_state_zip: form.cityStateZip,
          specialty: form.specialty,
          ehr: form.ehr,
          provider_count: form.providers,
          contact_name: form.contact,
          contact_email: form.email,
          contact_phone: form.phone,
          contact_role: form.role,
          pain_points: form.pains || [],
          interest_drivers: form.interestDrivers || [],
          stage: 'lead',
        });

      if (insertError) throw insertError;

      // Send notification email (fire and forget)
      fetch('https://ijuhtxskfixsdqindcjd.supabase.co/functions/v1/notify-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contact_name: form.contact,
          contact_email: form.email,
          specialty: form.specialty,
          provider_count: form.providers,
          pain_points: form.pains,
          interest_drivers: form.interestDrivers,
        }),
      }).catch(console.error);

      setSubmitted(true);
      trackEvent("intake_submitted", {
        source: "home_assessment",
        specialty: form.specialty || "unknown",
      });
    } catch (err) {
      console.error('Submission error:', err);
      setError('Something went wrong. Please try again or email us directly at torey@defyb.org');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px clamp(16px, 4vw, 80px)",
        background: `${DS.colors.bg}ee`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${DS.colors.border}`,
      }}>
        <div onClick={handleLogoClick} style={{ cursor: "pointer" }}>
          <DeFybLogo size={28} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {[
            { label: "Baseline", id: "intake" },
            { label: "ROI", id: "roi" },
            { label: "FAQ", id: "faq" },
          ].map((link) => (
            <span
              key={link.id}
              onClick={() => document.getElementById(link.id)?.scrollIntoView({ behavior: "smooth" })}
              style={{
                fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer",
                padding: "6px 10px", borderRadius: DS.radius.sm,
                transition: "color 0.2s",
              }}
              onMouseOver={(e) => e.target.style.color = DS.colors.text}
              onMouseOut={(e) => e.target.style.color = DS.colors.textMuted}
            >
              {link.label}
            </span>
          ))}
          <span onClick={onClientLogin} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer", padding: "6px 10px" }}>Portal</span>
          <Button primary small onClick={scrollToIntake}>Run Baseline</Button>
        </div>
      </nav>

      <div style={{ padding: "0 clamp(20px, 5vw, 80px)", maxWidth: "1200px", margin: "0 auto" }}>
        {/* HERO */}
        <section style={{ paddingTop: "140px", paddingBottom: "80px" }}>
          <HeartbeatLine width={280} style={{ marginBottom: "32px", opacity: 0.6 }} />
          <h1 style={{
            fontFamily: DS.fonts.display, fontSize: "clamp(36px, 6vw, 64px)",
            color: DS.colors.text, fontWeight: 400, lineHeight: 1.1, maxWidth: "700px",
            marginBottom: "24px",
          }}>
            We help doctors code correctly,
            <br />get paid fully, and save time.
          </h1>

          <div style={{ marginBottom: "36px", maxWidth: "720px" }}>
            <p style={{ color: DS.colors.textMuted, fontSize: "17px", marginBottom: "14px" }}>
              DeFyb reviews encounter documentation, flags underbilling, and shows exactly what to fix.
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Tag type="time" />
              <Tag type="revenue" />
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Button primary onClick={scrollToIntake}>Start Free Coding Baseline →</Button>
            <Button onClick={onClientLogin}>Watch 2-Min Demo</Button>
          </div>
        </section>

        {/* TAGLINE */}
        <div style={{
          textAlign: "center", padding: "48px 0", borderTop: `1px solid ${DS.colors.border}`,
          borderBottom: `1px solid ${DS.colors.border}`,
        }}>
          <p style={{
            fontFamily: DS.fonts.display, fontSize: "clamp(20px, 3vw, 28px)",
            color: DS.colors.textMuted, fontStyle: "italic",
          }}>
            Simple workflow. Real coding lift.
          </p>
          <p style={{ fontSize: "14px", color: DS.colors.textDim, marginTop: "8px" }}>
            Run a baseline first. Book a full assessment only if the numbers are compelling.
          </p>
        </div>

        {/* CODING LEAKS */}
        <section style={{ padding: "80px 0" }}>
          <SectionTitle sub="We focus frontend workflow on coding intelligence first. Add-on modules remain available in your backend roadmap.">
            The 5 coding leaks draining revenue
          </SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
            {FAILURE_POINTS.map((fp) => (
              <div key={fp.id} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto",
                alignItems: "center", gap: "16px",
                padding: "16px 20px", background: DS.colors.bgCard,
                border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md,
              }}>
                <div style={{
                  fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.textDim,
                  width: "24px", textAlign: "center",
                }}>
                  {String(fp.id).padStart(2, "0")}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{fp.name}</span>
                    <Tag type={fp.tag} />
                  </div>
                  <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>{fp.stat}</div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>
                    <span style={{ color: DS.colors.shock }}>→</span>{" "}
                    <span style={{ color: DS.colors.text, fontWeight: 500 }}>{fp.tool}</span>{" "}
                    <span style={{ color: DS.colors.textDim }}>({fp.toolCost})</span>
                  </div>
                </div>
                <div style={{
                  fontSize: "11px", color: DS.colors.vital, background: DS.colors.vitalDim,
                  padding: "4px 8px", borderRadius: "4px", whiteSpace: "nowrap",
                }}>
                  {fp.fix}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: "24px", padding: "16px 20px", borderRadius: DS.radius.md,
            background: `${DS.colors.shock}12`, border: `1px solid ${DS.colors.shock}30`,
            display: "flex", alignItems: "center", gap: "12px",
          }}>
            <span style={{ fontSize: "20px" }}>🔊</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>Workflow & Revenue Baseline — included in every assessment</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                We start with coding capture. DME, prior-auth, and broader workflow modules are layered in phase two
                after baseline coding lift is proven.
              </div>
            </div>
          </div>
        </section>

        {/* ROI SECTION */}
        <section id="roi" style={{ padding: "80px 0" }}>
          <SectionTitle sub="Coding-first projections based on published benchmarks. Results vary by specialty and payer mix.">
            What revenue capture can look like for a 5-provider practice
          </SectionTitle>

          {/* SIMPLE PAY → GET */}
          <div className="roi-grid" style={{
            display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "32px",
            alignItems: "center", marginBottom: "48px",
          }}>
            {/* YOU PAY */}
            <Card style={{ textAlign: "center", padding: "40px 32px" }}>
              <div style={{
                fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: "12px",
              }}>Typical investment</div>
              <div style={{
                fontFamily: DS.fonts.display, fontSize: "clamp(36px, 5vw, 48px)",
                color: DS.colors.text, lineHeight: 1,
              }}>~$146K</div>
              <div style={{ fontSize: "14px", color: DS.colors.textDim, marginTop: "8px" }}>
                per year — DeFyb core coding platform
              </div>
            </Card>

            {/* ARROW */}
            <div className="roi-arrow" style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: DS.colors.shock, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "24px", boxShadow: DS.shadow.glow,
            }}>→</div>

            {/* YOU GET */}
            <Card style={{ textAlign: "center", padding: "40px 32px", borderColor: DS.colors.vital + "44" }}>
              <div style={{
                fontSize: "12px", color: DS.colors.vital, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: "12px",
              }}>Potential return</div>
              <div style={{
                fontFamily: DS.fonts.display, fontSize: "clamp(36px, 5vw, 48px)",
                color: DS.colors.vital, lineHeight: 1,
              }}>$400K–1M+</div>
              <div style={{ fontSize: "14px", color: DS.colors.textDim, marginTop: "8px" }}>
                per year — underbilling recovery potential
              </div>
            </Card>
          </div>

          {/* WHERE IT COMES FROM */}
          <div className="roi-breakdown" style={{ marginBottom: "40px" }}>
            <div style={{
              fontSize: "13px", color: DS.colors.textMuted, marginBottom: "16px",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>Where practices are seeing returns (published data)</div>
            <div style={{ display: "grid", gap: "2px" }}>
              {[
                { source: "Coding uplift", amount: "up to $625K", note: "11-14% wRVU increase reported in published studies" },
                { source: "Denial prevention", amount: "$60-96K", note: "Cleaner documentation reduces preventable denials" },
                { source: "Faster review cycles", amount: "high impact", note: "Billing teams spend less time clarifying notes" },
                { source: "Audit-ready claims", amount: "risk reduction", note: "Each recommendation includes evidence bullets" },
                { source: "Phase 2 add-ons", amount: "optional", note: "DME and prior-auth modules can layer in later" },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "160px 120px 1fr",
                  alignItems: "center", gap: "16px", padding: "14px 20px",
                  background: DS.colors.bgCard,
                  borderRadius: i === 0 ? `${DS.radius.md} ${DS.radius.md} 0 0` : i === 4 ? `0 0 ${DS.radius.md} ${DS.radius.md}` : "0",
                }}>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{row.source}</span>
                  <span style={{ fontFamily: DS.fonts.mono, fontSize: "14px", color: DS.colors.vital }}>{row.amount}</span>
                  <span style={{ fontSize: "13px", color: DS.colors.textMuted }}>{row.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM LINE */}
          <div className="bottom-stats" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px",
            padding: "24px", background: DS.colors.bgCard, borderRadius: DS.radius.lg,
            border: `1px solid ${DS.colors.border}`,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.vital }}>3–5x</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>typical coding ROI range</div>
            </div>
            <div style={{ textAlign: "center", borderLeft: `1px solid ${DS.colors.border}`, borderRight: `1px solid ${DS.colors.border}` }}>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.shock }}>60–90 days</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>to measurable coding impact</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.blue }}>Daily</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>underbilling visibility</div>
            </div>
          </div>

          <p style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "20px", maxWidth: "700px" }}>
            Sources: Riverside Health (PMC); UCSF/JAMA Jan 2026; Texas Oncology; Healio; Health Catalyst.
            These are industry benchmarks — we'll build a realistic projection specific to your practice during the assessment.
          </p>
        </section>

        {/* PROJECTED OUTCOMES */}
        <section style={{ padding: "80px 0", borderTop: `1px solid ${DS.colors.border}` }}>
          <SectionTitle sub="Front-end focus is coding and revenue capture.">
            Expected coding outcomes
          </SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
            {[
              { metric: "11-14%", label: "coding uplift potential", icon: "📈", color: DS.colors.vital, sub: "from undercoding correction" },
              { metric: "60-90 days", label: "to trend visibility", icon: "📊", color: DS.colors.blue, sub: "for measured capture rates" },
              { metric: "Defensible", label: "claim rationale quality", icon: "🧾", color: DS.colors.warn, sub: "evidence-linked recommendations" },
              { metric: "Phase 2", label: "add-on modules", icon: "⚙️", color: DS.colors.shock, sub: "DME and prior-auth available later" },
            ].map((item, i) => (
              <Card key={i} style={{ textAlign: "center", padding: "32px 24px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>{item.icon}</div>
                <div style={{ fontFamily: DS.fonts.display, fontSize: "36px", color: item.color, lineHeight: 1 }}>
                  {item.metric}
                </div>
                <div style={{ fontSize: "14px", color: DS.colors.text, marginTop: "8px", fontWeight: 500 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginTop: "4px" }}>
                  {item.sub}
                </div>
              </Card>
            ))}
          </div>

          <div style={{
            marginTop: "32px", padding: "20px 24px", borderRadius: DS.radius.lg,
            background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
            display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
          }}>
            <div style={{ fontSize: "24px" }}>💡</div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>
                These are projections, not guarantees
              </div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                Every practice is different. We validate coding opportunity first, then phase in DME, prior-auth,
                and additional automations as optional expansion modules.
              </div>
            </div>
          </div>
        </section>

        {/* INTEGRATIONS */}
        <section style={{ padding: "80px 0", borderTop: `1px solid ${DS.colors.border}` }}>
          <SectionTitle sub="Coding-first implementation on your existing stack, with optional add-on modules.">
            Integrations & Partners
          </SectionTitle>

          <div style={{ marginBottom: "40px" }}>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
              EHR Systems
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {["athenahealth", "Epic", "eClinicalWorks", "NextGen", "AdvancedMD", "Allscripts", "Veradigm", "ModMed"].map((ehr) => (
                <div key={ehr} style={{
                  padding: "12px 20px", background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
                  borderRadius: DS.radius.md, fontSize: "14px", fontWeight: 500,
                }}>
                  {ehr}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
              Tool Partners
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {[
                { name: "Suki", category: "Scribe" },
                { name: "Ambience", category: "Scribe" },
                { name: "HealOS", category: "Scribe" },
                { name: "Thoughtful AI", category: "RCM" },
                { name: "Infinitus", category: "Prior Auth (Add-On)" },
                { name: "Assort Health", category: "Phone AI (Add-On)" },
              ].map((tool) => (
                <div key={tool.name} style={{
                  padding: "12px 20px", background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
                  borderRadius: DS.radius.md, display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{tool.name}</span>
                  <span style={{ fontSize: "11px", color: DS.colors.textMuted, background: DS.colors.bg, padding: "2px 6px", borderRadius: "4px" }}>
                    {tool.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROTOCOL */}
        <section id="protocol" style={{ padding: "80px 0" }}>
          <SectionTitle sub="Simple, coding-first rollout.">
            The Revenue Capture Protocol
          </SectionTitle>

          <div style={{ display: "grid", gap: "2px" }}>
            {PROTOCOL_STEPS.map((step, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "60px 1fr auto",
                alignItems: "center", gap: "20px",
                padding: "20px 24px", background: DS.colors.bgCard,
                borderRadius: i === 0 ? `${DS.radius.lg} ${DS.radius.lg} 0 0` :
                  i === PROTOCOL_STEPS.length - 1 ? `0 0 ${DS.radius.lg} ${DS.radius.lg}` : "0",
              }}>
                <div style={{
                  fontFamily: DS.fonts.display, fontSize: "28px",
                  color: i === PROTOCOL_STEPS.length - 1 ? DS.colors.vital : DS.colors.shock,
                }}>
                  {step.num}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "2px" }}>{step.title}</div>
                  <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>{step.desc}</div>
                </div>
                <div style={{
                  fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.textDim,
                  background: DS.colors.bg, padding: "4px 10px", borderRadius: "4px",
                }}>
                  {step.time}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" style={{ padding: "80px 0" }}>
          <SectionTitle>Common questions</SectionTitle>
          <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
            {[
              {
                q: "Is this a coding tool or a full automation platform?",
                a: "The frontend experience is intentionally coding-first for MVP. We prioritize underbilling detection, claim rationale, and documentation completion."
              },
              {
                q: "Do you still support DME and prior-auth automation?",
                a: "Yes. Those capabilities remain in the backend roadmap and can be activated as phase-two add-on modules after coding capture is stable."
              },
              {
                q: "What does it actually cost?",
                a: "Core MVP pricing is centered on coding intelligence and revenue capture workflows. We provide expansion pricing for DME, prior-auth, and claims modules separately."
              },
              {
                q: "How long until we see results?",
                a: "Most practices see coding trend visibility within 2-4 weeks and measurable revenue impact within 60-90 days."
              },
              {
                q: "Will this replace my billing team?",
                a: "No. It augments your billing team with better evidence, cleaner documentation, and prioritized correction opportunities."
              },
            ].map((faq, i) => (
              <Card key={i} style={{ padding: "20px 24px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>{faq.q}</div>
                <div style={{ fontSize: "14px", color: DS.colors.textMuted, lineHeight: 1.6 }}>{faq.a}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* BASELINE + ASSESSMENT */}
        <section id="intake" ref={intakeRef} style={{ padding: "80px 0" }}>
          <SectionTitle sub="Run a fast estimate first. Book a full assessment only if the coding opportunity is worth it.">
            Start your free coding baseline
          </SectionTitle>

          <Card style={{ maxWidth: "900px", marginBottom: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              {[
                { label: "Providers", key: "providers" },
                { label: "Visits/provider/day", key: "visitsPerProviderPerDay" },
                { label: "Estimated undercoded %", key: "undercodedRate" },
                { label: "Avg missed $/visit", key: "avgMissedPerVisit" },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {field.label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={baseline[field.key]}
                    onChange={(e) => setBaseline({ ...baseline, [field.key]: e.target.value })}
                    style={{
                      width: "100%", padding: "10px 12px", background: DS.colors.bg,
                      border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                      color: DS.colors.text, fontSize: "14px", outline: "none",
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              <Button primary onClick={() => setBaselineRan(true)}>Run Baseline Estimate</Button>
              <Button onClick={() => setShowAssessmentForm((v) => !v)}>
                {showAssessmentForm ? "Hide Assessment Form" : "Book Full Assessment"}
              </Button>
              <Button onClick={onClientLogin}>Watch Demo</Button>
            </div>

            {baselineRan && (
              <div style={{
                padding: "16px 18px", borderRadius: DS.radius.md, background: DS.colors.bg,
                border: `1px solid ${DS.colors.borderLight}`, display: "grid", gap: "8px",
              }}>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>Baseline Result</div>
                <div style={{ fontFamily: DS.fonts.display, fontSize: "34px", color: DS.colors.vital }}>
                  ${baselineNumbers.monthlyRecovery.toLocaleString()}/mo
                </div>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  Estimated recoverable revenue from {baselineNumbers.undercodedVisits.toLocaleString()} potentially undercoded encounters/year.
                </div>
              </div>
            )}
          </Card>

          {showAssessmentForm && (
            <>
              {submitted ? (
                <div style={{ textAlign: "center", padding: "40px 0 60px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚡</div>
                  <h2 style={{ fontFamily: DS.fonts.display, fontSize: "32px", color: DS.colors.vital, marginBottom: "8px" }}>
                    Assessment request received.
                  </h2>
                  <p style={{ color: DS.colors.textMuted, maxWidth: "520px", margin: "0 auto" }}>
                    We'll follow up within 48 hours with a coding-focused review plan and next steps.
                  </p>
                </div>
              ) : (
                <Card style={{ maxWidth: "700px" }}>
                  <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontWeight: 600, fontSize: "16px" }}>Book Full Assessment</div>
                    <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                      Use this after baseline if you want a full workflow and implementation plan.
                    </div>
                  </div>
                {[
                  // Practice Info (feeds baseline)
                  { label: "Practice Name", key: "name", type: "text", required: true },
                  { label: "Practice Address", key: "address", type: "text", placeholder: "Street address" },
                  { label: "City, State, ZIP", key: "cityStateZip", type: "text", placeholder: "City, ST 12345" },
                  { label: "Specialty", key: "specialty", type: "select", required: true, options: [
                    "Family Medicine / Primary Care",
                    "Internal Medicine",
                    "Cardiology",
                    "Gastroenterology",
                    "Psychiatry / Behavioral Health",
                    "Orthopedic Surgery",
                    "OB/GYN",
                    "Urology",
                    "Endocrinology",
                    "Dermatology",
                    "Pediatrics",
                    "Pain Management",
                    "General Surgery",
                    "Other"
                  ]},
                  { label: "Number of Providers", key: "providers", type: "select", required: true, options: ["1-2", "3-5", "6-10", "11-20", "20+"] },
                  { label: "Current EHR", key: "ehr", type: "select", options: ["athenahealth", "Epic", "eClinicalWorks", "NextGen", "AdvancedMD", "Allscripts/Veradigm", "Other / Not sure"] },
                  // Contact Info
                  { label: "Your Full Name", key: "contact", type: "text", required: true },
                  { label: "Your Role", key: "role", type: "select", options: ["Practice Owner / Partner", "Office Manager", "Provider (MD/DO/PA/NP)", "Billing Manager", "Other"] },
                  { label: "Email", key: "email", type: "email", required: true },
                  { label: "Phone", key: "phone", type: "tel" },
                ].map((field) => (
                  <div key={field.key} style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {field.label}{field.required && <span style={{ color: DS.colors.shock }}> *</span>}
                    </label>
                    {field.type === "select" ? (
                      <select
                        value={form[field.key] || ""}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        style={{
                          width: "100%", padding: "10px 12px", background: DS.colors.bg,
                          border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                          color: DS.colors.text, fontSize: "14px", outline: "none",
                        }}
                      >
                        <option value="">Select...</option>
                        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type} placeholder={field.placeholder || ""}
                        value={form[field.key] || ""}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        style={{
                          width: "100%", padding: "10px 12px", background: DS.colors.bg,
                          border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                          color: DS.colors.text, fontSize: "14px", outline: "none",
                        }}
                      />
                    )}
                  </div>
                ))}

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Top 3 Pain Points
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {["Documentation time", "Phone/missed calls", "Coding accuracy", "Prior auth", "Claim denials", "Staffing shortages", "DME revenue loss", "Patient no-shows"].map((p) => (
                      <label key={p} style={{
                        display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px",
                        background: (form.pains || []).includes(p) ? DS.colors.shockGlow : DS.colors.bg,
                        border: `1px solid ${(form.pains || []).includes(p) ? DS.colors.shock : DS.colors.borderLight}`,
                        borderRadius: DS.radius.sm, cursor: "pointer", fontSize: "13px",
                        color: (form.pains || []).includes(p) ? DS.colors.shock : DS.colors.textMuted,
                      }}>
                        <input type="checkbox" style={{ display: "none" }}
                          checked={(form.pains || []).includes(p)}
                          onChange={() => {
                            const pains = form.pains || [];
                            setForm({ ...form, pains: pains.includes(p) ? pains.filter((x) => x !== p) : [...pains, p].slice(0, 3) });
                          }}
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    What's driving your interest? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(select up to 3)</span>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {[
                      { label: "Providers working late", icon: "🌙", maps: "doc_time" },
                      { label: "Missing/losing calls", icon: "📞", maps: "call_rate" },
                      { label: "High denial rate", icon: "❌", maps: "denial_rate" },
                      { label: "Under-coding concerns", icon: "📊", maps: "coding" },
                      { label: "Prior auth burden", icon: "📋", maps: "prior_auth" },
                      { label: "Staffing struggles", icon: "👥", maps: "staffing" },
                      { label: "Want to bring DME in-house", icon: "🏥", maps: "dme" },
                      { label: "Stay independent", icon: "🛡️", maps: "independence" },
                    ].map((driver) => (
                      <label key={driver.label} style={{
                        display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px",
                        background: (form.interestDrivers || []).includes(driver.label) ? DS.colors.shockGlow : DS.colors.bg,
                        border: `1px solid ${(form.interestDrivers || []).includes(driver.label) ? DS.colors.shock : DS.colors.borderLight}`,
                        borderRadius: DS.radius.md, cursor: "pointer", fontSize: "14px",
                        color: (form.interestDrivers || []).includes(driver.label) ? DS.colors.text : DS.colors.textMuted,
                        transition: "all 0.2s ease",
                      }}>
                        <input type="checkbox" style={{ display: "none" }}
                          checked={(form.interestDrivers || []).includes(driver.label)}
                          onChange={() => {
                            const drivers = form.interestDrivers || [];
                            setForm({
                              ...form,
                              interestDrivers: drivers.includes(driver.label)
                                ? drivers.filter((x) => x !== driver.label)
                                : [...drivers, driver.label].slice(0, 3)
                            });
                          }}
                        />
                        <span>{driver.icon}</span>
                        <span>{driver.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div style={{
                    padding: "12px 16px", marginBottom: "16px", borderRadius: DS.radius.sm,
                    background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
                  }}>
                    {error}
                  </div>
                )}

                <Button
                  primary
                  onClick={handleSubmit}
                  style={{ width: "100%", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Submitting..." : "⚡ Submit Full Assessment Request"}
                </Button>
                </Card>
              )}
            </>
          )}
        </section>

        {/* CONTACT */}
        <section style={{
          padding: "48px 0", borderTop: `1px solid ${DS.colors.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "24px",
        }}>
          <div>
            <div style={{ fontSize: "14px", color: DS.colors.textMuted, marginBottom: "4px" }}>
              Rather just talk?
            </div>
            <a href="mailto:torey@defyb.org" style={{
              fontFamily: DS.fonts.display, fontSize: "20px", color: DS.colors.shock,
              textDecoration: "none",
            }}>
              torey@defyb.org
            </a>
          </div>
          <Button primary onClick={scrollToIntake}>Run Baseline →</Button>
        </section>

        {/* TRUST & COMPLIANCE */}
        <section style={{ padding: "60px 0", borderTop: `1px solid ${DS.colors.border}` }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h3 style={{ fontFamily: DS.fonts.display, fontSize: "24px", color: DS.colors.text, marginBottom: "8px" }}>
              Built for Healthcare
            </h3>
            <p style={{ fontSize: "14px", color: DS.colors.textMuted, maxWidth: "500px", margin: "0 auto" }}>
              We take data security seriously. Your practice information is protected.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", maxWidth: "900px", margin: "0 auto" }}>
            {[
              {
                icon: "🔒",
                title: "HIPAA Compliant",
                desc: "Architecture designed to meet HIPAA technical safeguards. BAA available for qualifying engagements.",
              },
              {
                icon: "🛡️",
                title: "Transient PHI Only",
                desc: "Clinical notes are processed for analysis then automatically purged within 90 days. Your EHR remains the system of record.",
              },
              {
                icon: "🔐",
                title: "Secure Infrastructure",
                desc: "AES-256 encryption at rest, TLS 1.2+ in transit. Row-level security isolates each practice's data.",
              },
              {
                icon: "📋",
                title: "3-Tier Retention",
                desc: "90-day note purge. 7-year billing intelligence for audit defense. 10-year audit trail for compliance.",
              },
            ].map((item, i) => (
              <div key={i} style={{
                padding: "24px", background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
                borderRadius: DS.radius.lg, textAlign: "center",
              }}>
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>{item.icon}</div>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px" }}>{item.title}</div>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <span
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.history.pushState({ defyb: true, view: "security" }, "", "/security");
                  window.dispatchEvent(new PopStateEvent("popstate", { state: { defyb: true, view: "security" } }));
                }
              }}
              style={{ fontSize: "14px", color: DS.colors.shock, cursor: "pointer", textDecoration: "underline" }}
            >
              View full security and compliance details
            </span>
          </div>

          <div style={{
            marginTop: "32px", textAlign: "center", padding: "20px",
            background: `${DS.colors.vital}11`, border: `1px solid ${DS.colors.vital}33`,
            borderRadius: DS.radius.lg, maxWidth: "700px", margin: "32px auto 0",
          }}>
            <div style={{ fontSize: "14px", color: DS.colors.vital, fontWeight: 500 }}>
              Clinician-Founded & Operated
            </div>
            <div style={{ fontSize: "13px", color: DS.colors.textMuted, marginTop: "4px" }}>
              DeFyb was built by practicing physicians who understand the unique challenges of private practice.
              We're not just vendors — we're partners in your success.
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{
          padding: "40px 0 32px", borderTop: `1px solid ${DS.colors.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "32px", marginBottom: "32px" }}>
            <div>
              <DeFybLogo size={24} />
              <p style={{ fontSize: "13px", color: DS.colors.textMuted, marginTop: "12px", maxWidth: "280px" }}>
                Revenue capture, coding intelligence, and workflow automation for private practices.
              </p>
            </div>
            <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Contact</div>
                <a href="mailto:torey@defyb.org" style={{ fontSize: "14px", color: DS.colors.text, textDecoration: "none", display: "block", marginBottom: "6px" }}>torey@defyb.org</a>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Legal</div>
                <span
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.history.pushState({ defyb: true, view: "privacy" }, "", "/privacy");
                      window.dispatchEvent(new PopStateEvent("popstate", { state: { defyb: true, view: "privacy" } }));
                    }
                  }}
                  style={{ fontSize: "14px", color: DS.colors.text, display: "block", marginBottom: "6px", cursor: "pointer" }}
                >Privacy Policy</span>
                <span
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.history.pushState({ defyb: true, view: "terms" }, "", "/terms");
                      window.dispatchEvent(new PopStateEvent("popstate", { state: { defyb: true, view: "terms" } }));
                    }
                  }}
                  style={{ fontSize: "14px", color: DS.colors.text, display: "block", marginBottom: "6px", cursor: "pointer" }}
                >Terms of Service</span>
                <span
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.history.pushState({ defyb: true, view: "security" }, "", "/security");
                      window.dispatchEvent(new PopStateEvent("popstate", { state: { defyb: true, view: "security" } }));
                    }
                  }}
                  style={{ fontSize: "14px", color: DS.colors.text, display: "block", cursor: "pointer" }}
                >Security</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", paddingTop: "24px", borderTop: `1px solid ${DS.colors.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "11px", color: DS.colors.textDim, padding: "4px 8px", background: DS.colors.bgCard, borderRadius: "4px" }}>🔒 HIPAA</span>
              <span style={{ fontSize: "11px", color: DS.colors.textDim, padding: "4px 8px", background: DS.colors.bgCard, borderRadius: "4px" }}>🛡️ 90-Day PHI Purge</span>
              <span style={{ fontSize: "11px", color: DS.colors.textDim, padding: "4px 8px", background: DS.colors.bgCard, borderRadius: "4px" }}>📋 BAA Ready</span>
            </div>
            <p style={{ fontSize: "12px", color: DS.colors.textDim }}>
              © 2026 DeFyb. Clinician-led. Vendor-neutral.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
