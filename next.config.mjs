/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/export/ckp': ['./src/export_templates/**/*'],
  }
};

export default nextConfig;