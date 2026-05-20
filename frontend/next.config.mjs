/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We deploy to Amplify Hosting. SSR is required for the password
  // middleware (cookie checks must run server-side).
  output: "standalone",
  experimental: {
    // typedRoutes is now top-level in Next 15.5+ but keeping it in experimental
    // is still accepted; promote here once we lock to >= 15.5.
  },
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
