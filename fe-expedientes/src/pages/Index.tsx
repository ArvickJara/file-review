// src/pages/Index.tsx
import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardContent from "@/components/dashboard/DashboardContent";
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
        }, 63);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="space-y-6">
            {/* Título animado */}
            <div className="text-center sm:text-left">
                <h1 className="text-2xl md:text-3xl font-black text-foreground">
                    {displayText}
                    <span className="inline-block w-1 h-7 md:h-8 ml-1 bg-foreground animate-pulse"></span>
                </h1>
            </div>

            {/* Statistics */}
            <DashboardStats />

            {/* Dashboard Content */}
            <DashboardContent />
        </div>
    );
};

export default Index;