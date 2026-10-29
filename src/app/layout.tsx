import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./fonts.css";
import "./tournament.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tournament.planary.ch"),
  title: { default: "Planary Tournament", template: "%s · Planary Tournament" },
  description: "Turniere mit Anmeldung, Bracket und Beamer.",
};

export const viewport: Viewport = { themeColor: "#0b0b0f" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
