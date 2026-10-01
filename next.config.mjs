/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/export/ckp': ['./src/export_templates/**/*'],
  },
  experimental: {
    webpackBuildWorker: false,
  }
};

export default nextConfig;