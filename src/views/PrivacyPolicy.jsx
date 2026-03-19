import { DS } from "../design/tokens";
import { DeFybLogo } from "../components/svg";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: "40px" }}>
    <h2 style={{
      fontFamily: DS.fonts.display, fontSize: "18px", color: DS.colors.text,
      marginBottom: "12px", paddingBottom: "8px",
      borderBottom: `1px solid ${DS.colors.border}`,
    }}>
      {title}
    </h2>
    {children}
  </div>
);

const P = ({ children }) => (
  <p style={{ fontSize: "14px", color: DS.colors.textMuted, lineHeight: 1.7, marginBottom: "10px" }}>
    {children}
  </p>
);

const Li = ({ children }) => (
  <li style={{ fontSize: "14px", color: DS.colors.textMuted, lineHeight: 1.7, marginBottom: "6px" }}>
    {children}
  </li>
);

const navigateTo = (path, view) => {
  if (typeof window !== "undefined") {
    window.history.pushState({ defyb: true, view }, "", path);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { defyb: true, view } }));
  }
};

export const PrivacyPolicy = ({ onBack }) => (
  <div style={{
    minHeight: "100vh", background: DS.colors.bg, color: DS.colors.text,
    fontFamily: DS.fonts.body,
  }}>
    <div style={{ maxWidth: "740px", margin: "0 auto", padding: "48px 24px 80px" }}>

      <div style={{ marginBottom: "40px" }}>
        <DeFybLogo size={28} />
        <h1 style={{
          fontFamily: DS.fonts.display, fontSize: "30px", color: DS.colors.text,
          marginTop: "20px", marginBottom: "4px",
        }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: "13px", color: DS.colors.textDim }}>
          Effective Date: March 15, 2026 &middot; DeFyb LLC
        </p>
      </div>

      <Section title="1. Who We Are">
        <P>
          DeFyb LLC ("DeFyb," "we," "us," or "our") operates the DeFyb platform at defyb.org.
          DeFyb provides coding intelligence, revenue capture analysis, and workflow tools for
          healthcare practices. This Privacy Policy describes how we collect, use, store, and
          protect information when you use our website and services.
        </P>
      </Section>

      <Section title="2. Information We Collect">
        <P><strong>Account information.</strong> When a practice account is created, we collect
          names, email addresses, practice name, and role assignments for authorized users.</P>
        <P><strong>Encounter data.</strong> When you use the coding analysis tool, you may submit
          encounter notes containing clinical documentation. We process this data to extract billing
          signals, generate coding recommendations, and calculate revenue impact. See Section 5
          for how we handle protected health information (PHI).</P>
        <P><strong>Billing information.</strong> Payment processing is handled by Stripe, Inc.
          We do not store credit card numbers, bank account numbers, or other payment credentials
          on our servers. We retain Stripe customer IDs, subscription status, and plan details to
          manage your account.</P>
        <P><strong>Usage data.</strong> We collect anonymized analytics (page views, feature usage,
          session duration) via privacy-respecting analytics tools. We do not sell or share this
          data with third-party advertisers.</P>
        <P><strong>Communications.</strong> If you contact us via email or the intake form, we
          retain the content of those communications to respond and improve our services.</P>
      </Section>

      <Section title="3. How We Use Information">
        <P>We use the information we collect to:</P>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <Li>Provide and improve the DeFyb coding intelligence and revenue capture services</Li>
          <Li>Generate E/M coding recommendations, documentation gap analysis, and revenue impact estimates</Li>
          <Li>Manage your account, billing, and subscription</Li>
          <Li>Send transactional emails (account setup, password resets, billing notices)</Li>
          <Li>Maintain audit trails for compliance and quality assurance</Li>
          <Li>Respond to support requests and communications</Li>
          <Li>Improve system reliability, security, and performance</Li>
        </ul>
        <P>We do not use your data to train machine learning models. We do not sell your data
          to third parties.</P>
      </Section>

      <Section title="4. Data Sharing">
        <P>We share information only in the following circumstances:</P>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <Li><strong>Infrastructure providers.</strong> Supabase (database and authentication on AWS),
            Vercel (frontend hosting), Stripe (payment processing), Resend (transactional email).
            Each provider processes data under their own privacy and security commitments.</Li>
          <Li><strong>Legal compliance.</strong> If required by law, subpoena, or regulatory investigation.</Li>
          <Li><strong>Business transfers.</strong> In connection with a merger, acquisition, or asset sale,
            with notice to affected users.</Li>
        </ul>
        <P>We do not share, sell, rent, or trade personal information with third parties for
          their marketing purposes.</P>
      </Section>

      <Section title="5. Protected Health Information (PHI)">
        <P>
          DeFyb may process encounter documentation that constitutes PHI under the Health Insurance
          Portability and Accountability Act (HIPAA). We handle PHI as follows:
        </P>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <Li><strong>Transient processing.</strong> Raw clinical note text submitted for analysis is
            automatically purged from our systems within 90 days. DeFyb is not a clinical note
            storage system; your EHR is the system of record.</Li>
          <Li><strong>Derived data retained.</strong> Extracted billing signals, coding recommendations,
            revenue impact calculations, and audit trails are retained for up to 7 years to support
            audit defense and compliance review.</Li>
          <Li><strong>Audit trail.</strong> Coding decision audit events are retained for 10 years.</Li>
          <Li><strong>Practice isolation.</strong> All data is scoped to individual practices via
            row-level security. One practice cannot access another practice's data.</Li>
          <Li><strong>BAA availability.</strong> We offer Business Associate Agreements for
            engagements involving PHI. Contact{" "}
            <a href="mailto:torey@defyb.org" style={{ color: DS.colors.shock, textDecoration: "none" }}>
              torey@defyb.org
            </a>{" "}to request a BAA.</Li>
          <Li><strong>Manual purge.</strong> Practices may request immediate deletion of raw note
            content for any encounter at any time, without waiting for the 90-day retention window.</Li>
        </ul>
        <P>
          For full details on our data handling, encryption, access controls, and retention tiers,
          see our{" "}
          <span
            onClick={() => navigateTo("/security", "security")}
            style={{ color: DS.colors.shock, cursor: "pointer", textDecoration: "underline" }}
          >
            Security & Compliance
          </span>{" "}page.
        </P>
      </Section>

      <Section title="6. Data Security">
        <P>We implement technical and organizational safeguards to protect your information:</P>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <Li>AES-256 encryption at rest for all stored data</Li>
          <Li>TLS 1.2+ encryption for all data in transit</Li>
          <Li>Row-level security policies enforced at the database level</Li>
          <Li>Role-based access control for practice users and team members</Li>
          <Li>Secrets management for API keys and service credentials (never stored in source control)</Li>
          <Li>Stripe PCI DSS Level 1 compliance for payment processing</Li>
        </ul>
      </Section>

      <Section title="7. Data Retention">
        <P>We retain data according to a 3-tier policy designed to minimize PHI exposure while
          preserving information needed for audit defense:</P>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <Li><strong>Raw clinical notes:</strong> Purged within 90 days of submission</Li>
          <Li><strong>Billing intelligence:</strong> Retained for 7 years (signals, recommendations, revenue impacts)</Li>
          <Li><strong>Audit trail:</strong> Retained for 10 years (coding decision history)</Li>
        </ul>
        <P>Account information is retained for the duration of your subscription and for a
          reasonable period thereafter to comply with legal obligations.</P>
      </Section>

      <Section title="8. Your Rights">
        <P>You may exercise the following rights by contacting us:</P>
        <ul style={{ paddingLeft: "20px", margin: "0 0 12px" }}>
          <Li><strong>Access.</strong> Request a copy of the data we hold about your practice.</Li>
          <Li><strong>Correction.</strong> Request correction of inaccurate account information.</Li>
          <Li><strong>Deletion.</strong> Request deletion of your practice's data. Deletion cascades
            across all encounter records, notes, recommendations, and audit events.</Li>
          <Li><strong>Data export.</strong> Request an export of your encounter analysis history
            and billing intelligence data.</Li>
        </ul>
        <P>To exercise any of these rights, contact{" "}
          <a href="mailto:torey@defyb.org" style={{ color: DS.colors.shock, textDecoration: "none" }}>
            torey@defyb.org
          </a>. We will respond within 30 days.
        </P>
      </Section>

      <Section title="9. Cookies and Tracking">
        <P>DeFyb uses minimal, privacy-respecting analytics. We do not use advertising cookies
          or third-party tracking pixels. We may use essential cookies for authentication session
          management. No data is shared with ad networks.</P>
      </Section>

      <Section title="10. Children's Privacy">
        <P>DeFyb is designed for use by healthcare professionals and practice staff. We do not
          knowingly collect information from individuals under the age of 18. If you believe a
          minor has provided us with personal information, contact us and we will delete it promptly.</P>
      </Section>

      <Section title="11. Changes to This Policy">
        <P>We may update this Privacy Policy from time to time. We will notify registered users
          of material changes via email or in-app notification. The effective date at the top of
          this page reflects the most recent revision.</P>
      </Section>

      <Section title="12. Contact">
        <P>
          DeFyb LLC<br />
          Email:{" "}
          <a href="mailto:torey@defyb.org" style={{ color: DS.colors.shock, textDecoration: "none" }}>
            torey@defyb.org
          </a>
        </P>
      </Section>

      {/* Footer nav */}
      <div style={{
        display: "flex", justifyContent: "center", gap: "24px",
        paddingTop: "32px", borderTop: `1px solid ${DS.colors.border}`,
        fontSize: "13px",
      }}>
        <span onClick={onBack} style={{ color: DS.colors.textMuted, cursor: "pointer" }}>
          &larr; Back to site
        </span>
        <span
          onClick={() => navigateTo("/terms", "terms")}
          style={{ color: DS.colors.shock, cursor: "pointer" }}
        >
          Terms of Service
        </span>
        <span
          onClick={() => navigateTo("/security", "security")}
          style={{ color: DS.colors.shock, cursor: "pointer" }}
        >
          Security
        </span>
      </div>
    </div>
  </div>
);
