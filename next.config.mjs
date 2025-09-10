/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['@upstash/redis'] }
};
export default nextConfig;
