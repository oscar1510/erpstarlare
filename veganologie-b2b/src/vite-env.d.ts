/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_PASSWORD?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
