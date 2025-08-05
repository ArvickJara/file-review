import { FileText, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
    return (
        <header className="border-b bg-card">
            <div className="flex h-16 items-center justify-between px-6">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <FileText className="h-8 w-8 text-primary" />
                        <div>
                            <h1 className="text-xl font-bold text-foreground">
                                Evaluador de Expedientes Técnicos
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Sistema IA de revisión y análisis
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Settings className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                Configuración
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <User className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                                <User className="mr-2 h-4 w-4" />
                                Perfil
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
};

export default Header;