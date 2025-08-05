import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AppLayoutProps {
    children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    return (
        <SidebarProvider>
            <div className="min-h-screen flex w-full">
                <AppSidebar />

                <div className="flex-1 flex flex-col">
                    {/* Top Header */}
                    <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <SidebarTrigger />
                            <div className="flex items-center space-x-2 max-w-md">
                                <Search className="h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar expedientes..."
                                    className="border-0 bg-muted/50 focus:bg-background"
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <Button variant="ghost" size="icon">
                                <Bell className="h-5 w-5" />
                            </Button>
                        </div>
                    </header>

                    {/* Main Content */}
                    <main className="flex-1 p-6">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}