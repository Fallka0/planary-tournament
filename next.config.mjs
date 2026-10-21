/** @type {import('next').NextConfig} */
const nextConfig = {
  // The legal pages live on planary.ch, one text for every Planary app.
  async redirects() {
    return [
      { source: '/impressum', destination: 'https://planary.ch/impressum', permanent: false },
      { source: '/datenschutz', destination: 'https://planary.ch/datenschutz', permanent: false },
    ];
  },
};

export default nextConfig;
