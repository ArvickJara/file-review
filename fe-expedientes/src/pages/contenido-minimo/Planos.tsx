import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useProyectoIdFromRoute } from '@/hooks/useProyectoId';

export default function Planos() {
    const proyectoId = useProyectoIdFromRoute();

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">Contenidos mínimos</p>
                <h1 className="text-2xl font-bold text-gray-900">Planos</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Proyecto activo: <strong>{proyectoId || 'sin seleccionar'}</strong>
                </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-sm text-blue-900 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <p>Pronto habilitaremos los checks específicos para Planos.</p>
                </div>
                <p>
                    Si necesitas avanzar, guarda tus pendientes desde{' '}
                    <Link to="/contenido-minimo/admisibilidad" className="underline font-medium">
                        Admisibilidad
                    </Link>{' '}
                    o usa la vista general de{' '}
                    <Link to="/contenido-minimo" className="underline font-medium">
                        Contenido mínimo
                    </Link>
                    .
                </p>
            </div>
        </div>
    );
}
