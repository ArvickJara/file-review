// src/App.tsx
import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react';
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeToggle } from "./components/ThemeToggle";
import AppLayout from "./components/layout/AppLayout";
import Index from "./pages/Index";
import CostosPresupuestos from "./pages/CostosPresupuestos";
import NotFound from "./pages/NotFound";
import logoRegionalLight from "@/assets/logo-region-light.png";
import logoRegionalDark from "@/assets/logo-region-dark.png";
import { useState, useEffect } from "react";

const queryClient = new QueryClient();

// Configuración de appearance compartida
const clerkAppearance = {
    elements: {
        card: "shadow-lg border rounded-lg bg-card w-full transition-all duration-300 ease-in-out",
        headerTitle: "text-xl font-semibold text-center",
        headerSubtitle: "text-center text-muted-foreground",
        formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground w-full transition-all duration-200 ease-in-out",
        footerActionLink: "text-primary hover:text-primary/90 transition-colors duration-200",
        formFieldInput: "w-full transition-all duration-200 ease-in-out",
        socialButtonsBlockButton: "w-full transition-all duration-200 ease-in-out hover:scale-105",
        dividerText: "text-center",
        footer: "text-center",
        footerAction: "text-center",
        footerActionText: "text-center",
        logoBox: "!hidden"
    },
    layout: {
        logoPlacement: "none" as const,
        showOptionalFields: false
    }
} as const;

// Componente de animación de fade-in
const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [delay]);

    return (
        <div
            className={`transition-all duration-700 ease-out transform ${isVisible
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95'
                }`}
        >
            {children}
        </div>
    );
};

// Componente de layout para autenticación con animaciones
const AuthLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md mx-auto px-6 py-8">
            {/* Logo y título con animación */}
            <FadeIn delay={100}>
                <div className="text-center space-y-6 mb-8">
                    <div className="flex justify-center">
                        <div className="transition-all duration-500 ease-out hover:scale-105">
                            <img
                                src={logoRegionalLight}
                                alt="Logo Regional"
                                className="h-16 w-auto object-contain dark:hidden transition-all duration-300 ease-in-out"
                            />
                            <img
                                src={logoRegionalDark}
                                alt="Logo Regional"
                                className="h-16 w-auto object-contain hidden dark:block transition-all duration-300 ease-in-out"
                            />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground mb-2 transition-colors duration-300">
                            Eval-IA Expedientes
                        </h1>
                        <p className="text-muted-foreground transition-colors duration-300">
                            Inicia sesión para continuar
                        </p>
                    </div>
                </div>
            </FadeIn>

            {/* Formulario con animación */}
            <FadeIn delay={300}>
                <div className="w-full flex justify-center">
                    <div className="w-full max-w-sm">
                        {children}
                    </div>
                </div>
            </FadeIn>

            {/* Theme Toggle con animación */}
            <FadeIn delay={500}>
                <div className="flex justify-center mt-8">
                    <div className="transition-all duration-200 ease-in-out hover:scale-110">
                        <ThemeToggle />
                    </div>
                </div>
            </FadeIn>
        </div>
    </div>
);

// Componente que maneja la navegación entre SignIn y SignUp
const AuthContent = () => {
    const location = useLocation();
    const isSignUp = location.pathname.includes('/sign-up');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 200);

        return () => clearTimeout(timer);
    }, [location.pathname]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (isSignUp) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <SignUp
                    appearance={clerkAppearance}
                    signInUrl="/sign-in"
                    forceRedirectUrl="/"
                    fallbackRedirectUrl="/"
                />
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            <SignIn
                appearance={clerkAppearance}
                signUpUrl="/sign-up"
                forceRedirectUrl="/"
                fallbackRedirectUrl="/"
            />
        </div>
    );
};

// Loading Spinner Component
const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground animate-pulse">Cargando...</p>
        </div>
    </div>
);

const App = () => {
    const [isAppLoading, setIsAppLoading] = useState(true);

    useEffect(() => {
        // Simular carga inicial de la aplicación
        const timer = setTimeout(() => {
            setIsAppLoading(false);
        }, 800);

        return () => clearTimeout(timer);
    }, []);

    if (isAppLoading) {
        return (
            <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
                <LoadingSpinner />
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <div className="min-h-screen">
                        <Toaster />

                        <Routes>
                            {/* Rutas de autenticación */}
                            <Route
                                path="/sign-in"
                                element={
                                    <SignedOut>
                                        <AuthLayout>
                                            <AuthContent />
                                        </AuthLayout>
                                    </SignedOut>
                                }
                            />
                            <Route
                                path="/sign-up"
                                element={
                                    <SignedOut>
                                        <AuthLayout>
                                            <AuthContent />
                                        </AuthLayout>
                                    </SignedOut>
                                }
                            />

                            {/* Rutas principales */}
                            <Route
                                path="/*"
                                element={
                                    <>
                                        <SignedOut>
                                            <AuthLayout>
                                                <AuthContent />
                                            </AuthLayout>
                                        </SignedOut>
                                        <SignedIn>
                                            <FadeIn delay={200}>
                                                <AppLayout>
                                                    <Routes>
                                                        <Route path="/" element={<Index />} />
                                                        <Route path="*" element={<NotFound />} />
                                                        <Route path="/costos-presupuestos" element={<CostosPresupuestos />} />
                                                    </Routes>
                                                </AppLayout>
                                            </FadeIn>
                                        </SignedIn>
                                    </>
                                }
                            />
                        </Routes>
                    </div>
                </BrowserRouter>
            </QueryClientProvider>
        </ThemeProvider>
    );
};

export default App;