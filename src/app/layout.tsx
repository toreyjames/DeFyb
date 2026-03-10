import type { Metadata } from "next";
import "./globals.css";
import BrandHeader from "@/components/BrandHeader";

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
            <BrandHeader />
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
