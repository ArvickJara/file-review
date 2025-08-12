import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoRegionalLight from "@/assets/logo-region-light.png";
import logoRegionalDark from "@/assets/logo-region-dark.png";
import { useState, useEffect } from 'react';

const Index = () => {
    const [displayText, setDisplayText] = useState('');
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
            {/* Page Header - Corregido */}
            <div className="relative flex justify-between items-center gap-4">
                {/* Izquierda: Logo */}
                <div className="flex-shrink-0">
                    <img
                        src={logoRegionalLight}
                        alt="Logo Regional"
                        className="h-12 sm:h-16 w-auto object-contain dark:hidden drop-shadow-lg"
                    />
                    <img
                        src={logoRegionalDark}
                        alt="Logo Regional"
                        className="h-12 sm:h-16 w-auto object-contain hidden dark:block drop-shadow-lg"
                    />
                </div>

                {/* Centro (solo en escritorio): Título */}
                <div className="hidden sm:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <h1 className="text-2xl md:text-3xl font-black text-foreground min-h-[2.5rem] whitespace-nowrap">
                        {displayText}
                    </h1>
                </div>

                {/* Derecha: Theme Toggle */}
                <div className="flex-shrink-0">
                    <ThemeToggle />
                </div>
            </div>

            {/* Título para vista móvil (debajo del header) */}
            <div className="sm:hidden text-center">
                <h1 className="text-2xl font-black text-foreground min-h-[2.5rem]">
                    {displayText}
                </h1>
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