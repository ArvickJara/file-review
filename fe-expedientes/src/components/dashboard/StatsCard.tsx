import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon: LucideIcon;
    variant?: 'default' | 'success' | 'warning' | 'error';
}

const StatsCard = ({ title, value, description, icon: Icon, variant = 'default' }: StatsCardProps) => {
    const getIconColor = () => {
        switch (variant) {
            case 'success':
                return 'text-success';
            case 'warning':
                return 'text-warning';
            case 'error':
                return 'text-error';
            default:
                return 'text-primary';
        }
    };

    return (
        <Card className="transition-all hover:shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <Icon className={`h-5 w-5 ${getIconColor()}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-foreground">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {description}
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

export default StatsCard;