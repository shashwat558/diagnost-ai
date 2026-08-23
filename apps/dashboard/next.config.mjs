/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  outputFileTracingRoot: process.env.TURBO_ROOT ?? undefined,
};

export default nextConfig;
