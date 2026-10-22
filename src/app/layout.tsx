import type { Metadata, Viewport } from "next";
import { Manrope, Unbounded } from "next/font/google";
import { Providers } from "./providers";
import "./tournament.css";

const body = Manrope({ variable: "--font-body", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"] });
const disp = Unbounded({ variable: "--font-disp", subsets: ["latin", "latin-ext"], weight: ["300", "400"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tournament.planary.ch"),
  title: { default: "Planary Tournament", template: "%s · Planary Tournament" },
  description: "Turniere mit Anmeldung, Bracket und Beamer.",
};

export const viewport: Viewport = { themeColor: "#0b0b0f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${body.variable} ${disp.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
