/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_OPERATOR_LOGIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
