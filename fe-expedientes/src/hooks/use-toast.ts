import { toast as sonnerToast } from "sonner"
import type { ExternalToast } from "sonner"

// Tipos para mantener compatibilidad con la API anterior
export interface ToastProps extends ExternalToast {
    title?: string
    description?: string
    variant?: "default" | "destructive" | "success" | "warning" | "info"
}

// Función principal de toast que usa Sonner
function toast({ title, description, variant = "default", ...props }: ToastProps) {
    const message = title || description || ""
    const options: ExternalToast = {
        description: title && description ? description : undefined,
        ...props,
    }

    switch (variant) {
        case "destructive":
            return sonnerToast.error(message, options)
        case "success":
            return sonnerToast.success(message, options)
        case "warning":
            return sonnerToast.warning(message, options)
        case "info":
            return sonnerToast.info(message, options)
        default:
            return sonnerToast(message, options)
    }
}

// Hook simplificado que aprovecha la API de Sonner
function useToast() {
    return {
        toast,
        dismiss: (toastId?: string | number) => {
            if (toastId) {
                sonnerToast.dismiss(toastId)
            } else {
                sonnerToast.dismiss()
            }
        },
        // Métodos de conveniencia
        success: (message: string, options?: ExternalToast) =>
            sonnerToast.success(message, options),
        error: (message: string, options?: ExternalToast) =>
            sonnerToast.error(message, options),
        warning: (message: string, options?: ExternalToast) =>
            sonnerToast.warning(message, options),
        info: (message: string, options?: ExternalToast) =>
            sonnerToast.info(message, options),
    }
}

export { useToast, toast }