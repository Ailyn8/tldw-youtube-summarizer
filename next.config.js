/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['youtube-captions-scraper'],
  },
};

module.exports = nextConfig;
