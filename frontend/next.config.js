/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['localhost', 'ucanjuschill.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://juschill-go-api:8080'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
