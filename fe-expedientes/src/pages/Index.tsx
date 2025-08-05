import AppLayout from "@/components/layout/AppLayout";
import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoRegionalLight from "@/assets/logo-region-light.png";
import logoRegionalDark from "@/assets/logo-region-dark.png";
import { useState, useEffect } from 'react';

const Index = () => {
    const [displayText, setDisplayText] = useState('');
    const [showCursor, setShowCursor] = useState(true);
    const fullText = 'Plataforma de Análisis de Expedientes con IA';

    useEffect(() => {
        let i = 0;
        const timer = setInterval(() => {
            if (i < fullText.length) {
                setDisplayText(fullText.slice(0, i + 1));
                i++;
            } else {
                clearInterval(timer);
            }
        }, 63); // Velocidad de escritura

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Page Header */}
            <div className="flex justify-between items-center">
                <div className="">
                    <img
                        src={logoRegionalLight}
                        alt="Logo Regional"
                        className="h-16 w-auto object-contain dark:hidden drop-shadow-lg"
                    />
                    {/* Logo para tema oscuro (letras blancas) */}
                    <img
                        src={logoRegionalDark}
                        alt="Logo Regional"
                        className="h-16 w-auto object-contain hidden dark:block drop-shadow-lg"
                    />
                </div>
                <div className="text-center flex-1">
                    <h1 className="text-3xl font-black text-foreground">
                        {displayText}
                    </h1>
                </div>
                <ThemeToggle />
            </div>

            {/* Statistics */}
            <DashboardStats />

            {/* Kanban Board */}
            <div className="flex-1 min-h-0">
                <DashboardContent />
            </div>
        </div>
    );
};

export default Index;