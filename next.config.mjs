/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // pdfkit/fontkit and tesseract.js/tesseract.js-core all read binary assets
  // (font metrics, WASM cores) from disk relative to their own package
  // directory at runtime; letting webpack bundle them breaks that path
  // resolution, so they're required directly from node_modules instead.
  serverExternalPackages: ["pdfkit", "fontkit", "tesseract.js", "tesseract.js-core", "pdfjs-dist", "@napi-rs/canvas", "heic-convert", "libheif-js", "docx"],
  // The bundled English traineddata (assets/tessdata) isn't imported by any
  // JS module, so Next's file tracer won't pick it up on its own — force it
  // into every route's serverless output so OCR works wherever it's called from.
  //
  // pdfjs-dist's Node "fake worker" loads pdf.worker.mjs via
  // `import(this.workerSrc)` where workerSrc is a runtime variable, not a
  // static string — Next's tracer can't follow that, so pdf.worker.mjs was
  // silently missing from the deployed function (confirmed in production:
  // "Cannot find module '.../pdfjs-dist/legacy/build/pdf.worker.mjs'",
  // breaking both PDF text extraction and the rasterize+OCR fallback).
  //
  // tesseract.js-core ships four prebuilt WASM cores (plain/SIMD ×
  // base/LSTM) and its Emscripten glue reads the matching .wasm file off
  // disk by name at runtime based on feature detection done *in the
  // deployed function*, not at build time — so every variant has to be
  // present, not just whichever one happened to load during a local build.
  // Same untraceable-at-build-time class of bug as pdf.worker.mjs above
  // (confirmed in production: "ENOENT ... tesseract-core-simd.wasm" hard
  // aborting the whole function).
  outputFileTracingIncludes: {
    "/**": [
      "./assets/tessdata/**",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/tesseract.js-core/*.wasm",
      "./node_modules/libheif-js/libheif-wasm/libheif.wasm",
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
