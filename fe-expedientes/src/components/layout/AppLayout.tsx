// src/components/layout/AppLayout.tsx
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from '@clerk/clerk-react';
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import logoRegionalLight from "@/assets/logo-region-light.png";
import logoRegionalDark from "@/assets/logo-region-dark.png";

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    return (
        <SidebarProvider defaultOpen={true}>
            <AppSidebar />
            <SidebarInset className="transition-all duration-300 ease-in-out">
                {/* Header más grande con animaciones */}
                <header className="sticky top-0 z-40 flex h-20 shrink-0 items-center gap-3 px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
                    <SidebarTrigger className="transition-all duration-200 ease-in-out hover:bg-accent hover:text-accent-foreground p-2 rounded-md" />
                    <Separator orientation="vertical" className="mr-3 h-6" />

                    {/* Logo más grande */}
                    <div className="flex items-center gap-4 flex-1">
                        <img
                            src={logoRegionalLight}
                            alt="Logo Regional"
                            className="h-12 w-auto object-contain dark:hidden transition-all duration-200 ease-in-out"
                        />
                        <img
                            src={logoRegionalDark}
                            alt="Logo Regional"
                            className="h-12 w-auto object-contain hidden dark:block transition-all duration-200 ease-in-out"
                        />

                    </div>

                    {/* Acciones del usuario con animaciones */}
                    <div className="ml-auto flex items-center space-x-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="transition-all duration-200 ease-in-out hover:bg-accent hover:text-accent-foreground h-10 w-10"
                        >
                            <Bell className="h-5 w-5" />
                        </Button>
                        <div className="transition-all duration-200 ease-in-out">
                            <ThemeToggle />
                        </div>
                        <div className="transition-all duration-200 ease-in-out hover:scale-105">
                            <UserButton
                                appearance={{
                                    elements: {
                                        avatarBox: "h-10 w-10"
                                    }
                                }}
                            />
                        </div>
                    </div>
                </header>

                {/* Contenido Principal con mejor spacing */}
                <main className="flex-1 overflow-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}