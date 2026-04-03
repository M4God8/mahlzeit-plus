import { Link, useLocation } from "wouter";
import { Calendar, Home, Settings, ShoppingBag, BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { name: "Heute", path: "/heute", icon: Home },
    { name: "Plan", path: "/plan", icon: Calendar },
    { name: "Einkauf", path: "/einkauf", icon: ShoppingBag },
    { name: "Rezepte", path: "/rezepte", icon: BookOpen },
    { name: "KI", path: "/ki", icon: Sparkles },
    { name: "Mehr", path: "/einstellungen", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t pb-safe border-border">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location === tab.path ||
            (tab.path === "/rezepte" && location.startsWith("/rezepte")) ||
            (tab.path === "/plan" && location.startsWith("/plan")) ||
            (tab.path === "/ki" && location.startsWith("/ki"));
          
          return (
            <Link 
              key={tab.path} 
              href={tab.path}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 text-xs transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${tab.name.toLowerCase()}`}
            >
              <Icon className={cn("w-5 h-5", isActive && "fill-primary/10")} />
              <span className="font-medium">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
