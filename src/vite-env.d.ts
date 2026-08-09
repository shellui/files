/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
