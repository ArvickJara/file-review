import { useParams, useSearchParams } from 'react-router-dom';

const SELECTED_PROYECTO_KEY = 'selectedProyectoId';

/**
 * Obtiene el ID del proyecto desde la ruta, query string o el último valor persistido.
 * También sincroniza el valor activo en localStorage para que otras vistas lo reutilicen.
 */
export function useProyectoIdFromRoute() {
    const params = useParams<{ proyectoId?: string }>();
    const [search] = useSearchParams();
    const fromRoute = params.proyectoId || search.get('proyectoId') || '';

    if (fromRoute) {
        try {
            if (typeof window !== 'undefined') {
                localStorage.setItem(SELECTED_PROYECTO_KEY, fromRoute);
            }
        } catch {
            // Intencionalmente ignorado: localStorage puede no existir (SSR/tests)
        }
        return fromRoute;
    }

    try {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(SELECTED_PROYECTO_KEY) || '';
        }
    } catch {
        // Ignorado
    }

    return '';
}

export function persistProyectoId(proyectoId: string) {
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(SELECTED_PROYECTO_KEY, proyectoId);
        }
    } catch {
        // noop
    }
}
