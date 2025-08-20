/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CLERK_PUBLISHABLE_KEY: string
    // Agrega aquí otras variables de entorno que uses
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}