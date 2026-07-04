/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // pdfkit reads its AFM font metrics from disk relative to its own package
  // directory at runtime; letting webpack bundle it breaks that path resolution.
  serverExternalPackages: ["pdfkit", "fontkit"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
