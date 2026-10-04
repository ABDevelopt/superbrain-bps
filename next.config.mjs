/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/export/ckp': ['./src/export_templates/**/*'],
  },
  experimental: {
    webpackBuildWorker: false,
    cpus: 1,
  }
};

export default nextConfig;