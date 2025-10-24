const getApiBaseUrl = (): string => {
    return (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
};

export const BASE_URL = getApiBaseUrl() + '/';
export const API_BASE_URL = getApiBaseUrl() + '/api/';

// ==============================
// ENDPOINTS CENTRALIZADOS
// ==============================

export const API_ENDPOINTS = {
    // Proyectos
    PROYECTOS: '/api/proyectos',

    // Expedientes técnicos
    SUBIR_TDR: '/api/expedientes_tecnicos/subir-tdr',
    EVALUAR_EXPEDIENTE: '/api/expedientes_tecnicos/evaluar-expediente',
    EVALUAR_CONTENIDO_MINIMO: '/api/expedientes_tecnicos/evaluar-contenido-minimo',
    DOCUMENTOS: (proyectoId: string) => `/api/expedientes_tecnicos/documentos/${proyectoId}`,
    TDRS: (proyectoId: string) => `/api/expedientes_tecnicos/tdrs/${proyectoId}`,
};

// Helper para construir URLs completas
export const buildApiUrl = (endpoint: string): string => {
    return `${BASE_URL.replace(/\/$/, '')}${endpoint}`;
};

// ==============================
// CONSTANTES DE STORAGE
// ==============================

export const STORAGE_KEYS = {
    SELECTED_PROYECTO: 'selectedProyectoId',
} as const;

// ==============================
// UTILIDADES BÁSICAS
// ==============================

// Formatear tamaños de archivo
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Formatear fechas
export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};