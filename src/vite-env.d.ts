/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTOLOAD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
