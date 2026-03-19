import { DS } from "../design/tokens";
import { DeFybLogo } from "../components/svg";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "48px" }}>
    <h2 style={{
      fontFamily: DS.fonts.display, fontSize: "20px", color: DS.colors.text,
      marginBottom: "16px", paddingBottom: "8px",
      borderBottom: `1px solid ${DS.colors.border}`,
    }}>
      {title}
    </h2>
    {children}
  </div>
);

const Paragraph = ({ children }) => (
  <p style={{ fontSize: "14px", color: DS.colors.textMuted, lineHeight: 1.7, marginBottom: "12px" }}>
    {children}
  </p>
);

const RetentionRow = ({ tier, period, scope, detail }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "140px 100px 1fr",
    gap: "16px", padding: "14px 0",
    borderBottom: `1px solid ${DS.colors.borderLight}`,
    fontSize: "13px", color: DS.colors.textMuted,
  }}>
    <div style={{ fontWeight: 600, color: DS.colors.text }}>{tier}</div>
    <div style={{ fontFamily: DS.fonts.mono, color: DS.colors.vital }}>{period}</div>
    <div>
      <div style={{ fontWeight: 500, color: DS.colors.text, marginBottom: "2px" }}>{scope}</div>
      <div style={{ lineHeight: 1.5 }}>{detail}</div>
    </div>
  </div>
);

const ControlRow = ({ icon, title, detail }) => (
  <div style={{
    display: "flex", gap: "16px", padding: "16px",
    background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
    borderRadius: DS.radius.md, marginBottom: "12px",
  }}>
    <div style={{ fontSize: "24px", flexShrink: 0, lineHeight: 1 }}>{icon}</div>
    <div>
      <div style={{ fontWeight: 600, fontSize: "14px", color: DS.colors.text, marginBottom: "4px" }}>{title}</div>
      <div style={{ fontSize: "13px", color: DS.colors.textMuted, lineHeight: 1.6 }}>{detail}</div>
    </div>
  </div>
);

export const SecurityPage = ({ onBack }) => (
  <div style={{
    minHeight: "100vh", background: DS.colors.bg, color: DS.colors.text,
    fontFamily: DS.fonts.body,
  }}>
    <div style={{ maxWidth: "780px", margin: "0 auto", padding: "48px 24px 80px" }}>

      {/* Header */}
      <div style={{ marginBottom: "48px" }}>
        <DeFybLogo size={28} />
        <h1 style={{
          fontFamily: DS.fonts.display, fontSize: "32px", color: DS.colors.text,
          marginTop: "20px", marginBottom: "8px",
        }}>
          Security & Compliance
        </h1>
        <p style={{ fontSize: "15px", color: DS.colors.textMuted, lineHeight: 1.6, maxWidth: "600px" }}>
          DeFyb is a coding intelligence and revenue capture tool for healthcare practices.
          This page details how we handle your data, what we store, and how long we keep it.
        </p>
      </div>

      {/* Data Handling Model */}
      <Section title="Data Handling Model">
        <Paragraph>
          DeFyb analyzes encounter documentation to suggest appropriate E/M coding levels,
          identify documentation gaps, and estimate revenue impact. Your electronic health record
          (EHR) remains the system of record for clinical data.
        </Paragraph>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px",
          marginTop: "16px",
        }}>
          <div style={{
            padding: "20px", background: DS.colors.bgCard,
            border: `1px solid ${DS.colors.vital}33`, borderRadius: DS.radius.md,
          }}>
            <div style={{ fontWeight: 600, fontSize: "13px", color: DS.colors.vital, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              What DeFyb stores
            </div>
            <ul style={{ fontSize: "13px", color: DS.colors.textMuted, lineHeight: 1.7, paddingLeft: "16px", margin: 0 }}>
              <li>Extracted billing signals (problem count, risk level, data elements)</li>
              <li>Code recommendations with rationale</li>
              <li>Revenue impact calculations</li>
              <li>Audit trail of every coding decision</li>
              <li>Practice configuration and billing profiles</li>
            </ul>
          </div>
          <div style={{
            padding: "20px", background: DS.colors.bgCard,
            border: `1px solid ${DS.colors.shock}33`, borderRadius: DS.radius.md,
          }}>
            <div style={{ fontWeight: 600, fontSize: "13px", color: DS.colors.shock, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              What stays in your EHR
            </div>
            <ul style={{ fontSize: "13px", color: DS.colors.textMuted, lineHeight: 1.7, paddingLeft: "16px", margin: 0 }}>
              <li>Patient demographics and identifiers</li>
              <li>Complete clinical notes (permanent record)</li>
              <li>Diagnosis codes and problem lists</li>
              <li>Medication records</li>
              <li>Insurance and claims submission data</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Retention Policy */}
      <Section title="Data Retention Policy">
        <Paragraph>
          DeFyb enforces a 3-tier retention policy. Each data category has a defined lifecycle
          aligned with federal requirements, state law, and payer audit lookback windows.
        </Paragraph>

        <div style={{
          border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md,
          padding: "4px 20px 16px", marginTop: "16px", background: DS.colors.bgCard,
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "140px 100px 1fr",
            gap: "16px", padding: "12px 0",
            borderBottom: `2px solid ${DS.colors.border}`,
            fontSize: "11px", color: DS.colors.textDim, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <div>Tier</div>
            <div>Retention</div>
            <div>Scope</div>
          </div>

          <RetentionRow
            tier="Clinical Notes"
            period="90 days"
            scope="Raw encounter note text"
            detail="Notes are processed for billing signal extraction then automatically scrubbed (NULLed). The encounter record and all derived intelligence remain intact."
          />
          <RetentionRow
            tier="Billing Intelligence"
            period="7 years"
            scope="Signals, recommendations, revenue impacts, claim outcomes"
            detail="Retained for audit defense and payer review. Covers the federal False Claims Act lookback period and most state medical record retention requirements."
          />
          <RetentionRow
            tier="Audit Trail"
            period="10 years"
            scope="Every encounter creation, analysis, code selection, and review"
            detail="Maintains a complete chain of custody for coding decisions. Covers the extended False Claims Act window for fraud allegations."
          />
        </div>

        <Paragraph>
          Practices may request full data deletion at any time. Deletion cascades across all
          encounter-related tables. Practices may also manually purge individual encounter notes
          before the 90-day window via the API.
        </Paragraph>
      </Section>

      {/* Access Controls */}
      <Section title="Access Controls">
        <ControlRow
          icon="🔐"
          title="Row-Level Security"
          detail="Every database query is scoped to the authenticated user's practice memberships. Clinic A cannot see Clinic B's encounters, even if both use the same DeFyb deployment."
        />
        <ControlRow
          icon="🧑‍⚕️"
          title="Role-Based Permissions"
          detail="Practice users are assigned roles (admin, provider, reviewer, office_manager) that control what actions they can perform. Team-level operations require separate authorization."
        />
        <ControlRow
          icon="🔑"
          title="Authentication"
          detail="Supabase Auth with email/password and optional Google or Microsoft OAuth. Team access is restricted to allowlisted domains and email addresses."
        />
        <ControlRow
          icon="📝"
          title="Full Audit Trail"
          detail="Every encounter creation, note upload, analysis run, code selection, and review is logged with actor identity and timestamp. Audit events are append-only and practice-scoped."
        />
      </Section>

      {/* Encryption */}
      <Section title="Encryption">
        <Paragraph>
          <strong>At rest:</strong> All data is stored in Supabase Postgres on AWS infrastructure
          with AES-256 encryption. Database backups are encrypted with the same standard.
        </Paragraph>
        <Paragraph>
          <strong>In transit:</strong> All connections use TLS 1.2 or higher. API calls between
          the frontend and Supabase Edge Functions are encrypted end-to-end.
        </Paragraph>
        <Paragraph>
          <strong>Secrets management:</strong> API keys, Stripe secrets, and internal tokens are
          stored as Supabase Edge Function secrets, never committed to source control.
        </Paragraph>
      </Section>

      {/* BAA */}
      <Section title="Business Associate Agreement">
        <Paragraph>
          DeFyb offers Business Associate Agreements (BAAs) for all engagements that involve
          access to protected health information. Supabase, our infrastructure provider, supports
          BAAs on their HIPAA-eligible plans.
        </Paragraph>
        <Paragraph>
          To request a BAA or discuss compliance requirements for your practice, contact{" "}
          <a href="mailto:torey@defyb.org" style={{ color: DS.colors.shock, textDecoration: "none" }}>
            torey@defyb.org
          </a>.
        </Paragraph>
      </Section>

      {/* Infrastructure */}
      <Section title="Infrastructure">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {[
            { label: "Database", value: "Supabase Postgres (AWS)" },
            { label: "Edge Functions", value: "Supabase / Deno Deploy" },
            { label: "Frontend Hosting", value: "Vercel" },
            { label: "Payments", value: "Stripe (PCI DSS Level 1)" },
            { label: "Auth Provider", value: "Supabase Auth (GoTrue)" },
            { label: "DNS / CDN", value: "Cloudflare" },
          ].map((item) => (
            <div key={item.label} style={{
              padding: "12px 16px", background: DS.colors.bgCard,
              border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
            }}>
              <div style={{ fontSize: "11px", color: DS.colors.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                {item.label}
              </div>
              <div style={{ fontSize: "14px", color: DS.colors.text, fontWeight: 500 }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Contact */}
      <div style={{
        padding: "24px", background: `${DS.colors.vital}11`,
        border: `1px solid ${DS.colors.vital}33`, borderRadius: DS.radius.lg,
        textAlign: "center",
      }}>
        <div style={{ fontSize: "15px", fontWeight: 600, color: DS.colors.text, marginBottom: "8px" }}>
          Questions about security or compliance?
        </div>
        <Paragraph>
          Reach out to{" "}
          <a href="mailto:torey@defyb.org" style={{ color: DS.colors.shock, textDecoration: "none" }}>
            torey@defyb.org
          </a>{" "}
          and we will respond within one business day.
        </Paragraph>
      </div>

      {/* Footer nav */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "24px",
        marginTop: "48px", paddingTop: "32px", borderTop: `1px solid ${DS.colors.border}`,
        fontSize: "13px",
      }}>
        <span onClick={onBack} style={{ color: DS.colors.textMuted, cursor: "pointer" }}>
          &larr; Back to site
        </span>
        <span
          onClick={() => {
            if (typeof window !== "undefined") {
              window.history.pushState({ defyb: true, view: "privacy" }, "", "/privacy");
              window.dispatchEvent(new PopStateEvent("popstate", { state: { defyb: true, view: "privacy" } }));
            }
          }}
          style={{ color: DS.colors.shock, cursor: "pointer" }}
        >
          Privacy Policy
        </span>
        <span
          onClick={() => {
            if (typeof window !== "undefined") {
              window.history.pushState({ defyb: true, view: "terms" }, "", "/terms");
              window.dispatchEvent(new PopStateEvent("popstate", { state: { defyb: true, view: "terms" } }));
            }
          }}
          style={{ color: DS.colors.shock, cursor: "pointer" }}
        >
          Terms of Service
        </span>
      </div>
    </div>
  </div>
);
