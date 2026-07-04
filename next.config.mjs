/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // pdfkit/fontkit and tesseract.js/tesseract.js-core all read binary assets
  // (font metrics, WASM cores) from disk relative to their own package
  // directory at runtime; letting webpack bundle them breaks that path
  // resolution, so they're required directly from node_modules instead.
  serverExternalPackages: ["pdfkit", "fontkit", "tesseract.js", "tesseract.js-core", "pdfjs-dist", "@napi-rs/canvas"],
  // The bundled English traineddata (assets/tessdata) isn't imported by any
  // JS module, so Next's file tracer won't pick it up on its own — force it
  // into every route's serverless output so OCR works wherever it's called from.
  outputFileTracingIncludes: {
    "/**": ["./assets/tessdata/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
