/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/directory/pdf': ['./assets/thapar-connect-directory.pdf'],
  },
}

export default nextConfig

