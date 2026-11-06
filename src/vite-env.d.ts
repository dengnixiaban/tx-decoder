/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FOURBYTE_BASE?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
