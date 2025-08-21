// src/components/layout/AppLayout.tsx
import { AppSidebar } from "./AppSidebar";
import { Bell, Menu, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from '@clerk/clerk-react';
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";

interface AppLayoutProps {
    children: React.ReactNode;
}

function MainLayout({ children }: { children: React.ReactNode }) {
    const { isOpen, toggle } = useSidebar();

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar fijo */}
            <div className={`fixed left-0 top-0 h-screen z-30 transition-all duration-300 ease-in-out border-r bg-background ${isOpen ? 'w-64' : 'w-0'}`}>
                <AppSidebar />
            </div>

            <div className={`flex flex-col h-screen w-full transition-all duration-300 ease-in-out ${isOpen ? 'ml-64' : 'ml-0'}`}>
                <header className="sticky top-0 z-40 flex h-20 items-center px-6 border-b bg-background w-full shadow-sm">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggle}
                        className="hover:bg-accent/50 h-10 w-10 transition-all duration-200"
                    >
                        {isOpen ? (
                            <ChevronLeft className="h-6 w-6" />
                        ) : (
                            <Menu className="h-6 w-6" />
                        )}
                    </Button>

                    <div className="flex-1"></div>

                    <div className="flex items-center space-x-4">
                        {/* Campana de notificaciones */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full flex items-center justify-center"
                        >
                            <Bell className="h-5 w-5" />
                        </Button>

                        {/* Botón de tema - envuelto para asegurar tamaño consistente */}
                        <div className="flex items-center justify-center h-10 w-10">
                            <ThemeToggle />
                        </div>

                        {/* Contenedor para el UserButton con tamaño y estilo consistentes */}
                        <div className="flex items-center justify-center h-10 w-10 rounded-full overflow-hidden">
                            <UserButton
                                appearance={{
                                    elements: {
                                        userButtonAvatarBox: "h-9 w-9"
                                    }
                                }}
                            />
                        </div>
                    </div>
                </header>

                {/* Contenido scrolleable */}
                <main className="flex-1 overflow-auto w-full">
                    <div className="p-6 w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function AppLayout({ children }: AppLayoutProps) {
    return (
        <SidebarProvider>
            <MainLayout children={children} />
        </SidebarProvider>
    );
}