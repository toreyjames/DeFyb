import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeFyb | Billing Intelligence MVP",
  description: "AI Scribe to Billing Intelligence to Revenue Optimization"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <div className="container">
            <header className="site-header">
              <p className="eyebrow">DeFyb MVP</p>
              <h2>AI Scribe to Billing Intelligence to Revenue Optimization</h2>
              <p className="subtitle">
                Current scope is encounter analysis, coding support, and revenue impact. DME and prior-auth modules
                are planned after MVP validation.
              </p>
            </header>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
