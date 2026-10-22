import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      // The legal pages live on planary.ch, one text for every Planary app.
      { source: "/impressum", destination: "https://planary.ch/impressum", permanent: false },
      { source: "/datenschutz", destination: "https://planary.ch/datenschutz", permanent: false },
      // Routes of the old app.
      { source: "/tournaments/new", destination: "/neu", permanent: true },
      { source: "/tournaments/:path*", destination: "/", permanent: true },
      { source: "/organizers/:path*", destination: "/", permanent: true },
      { source: "/profile", destination: "/profil", permanent: true },
      { source: "/auth", destination: "/", permanent: true },
      { source: "/admin", destination: "https://admin.planary.ch/tournament", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;
