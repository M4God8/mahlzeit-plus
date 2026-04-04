import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarDays, ShoppingCart, Sun, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const TOUR_SCREENS = [
  {
    icon: CalendarDays,
    title: "Plan erstellen",
    subtitle: "Dein Wochenplan",
    description:
      "Erstelle deinen persönlichen Essensplan für die Woche. Die App schlägt dir passende Rezepte vor — abgestimmt auf dein Profil und deine Vorlieben.",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: ShoppingCart,
    title: "Einkaufen",
    subtitle: "Automatische Liste",
    description:
      "Aus deinem Wochenplan wird automatisch eine Einkaufsliste erstellt. Hake Produkte beim Einkaufen ab — einfach und übersichtlich.",
    color: "bg-accent/20 text-accent-foreground",
  },
  {
    icon: Sun,
    title: "Dein Tag",
    subtitle: "Heute auf einen Blick",
    description:
      "Sieh auf einen Blick, was heute auf dem Plan steht. Bewerte Mahlzeiten und die App lernt mit der Zeit, was dir schmeckt.",
    color: "bg-amber-100 text-amber-700",
  },
] as const;

const STORAGE_KEY = "mahlzeit_intro_seen";
const ONBOARDED_KEY = "mahlzeit_onboarded";

export function hasSeenIntroTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroTourSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, "1");
  } catch {}
}

export function needsIntroTour(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1" && localStorage.getItem(STORAGE_KEY) !== "1";
  } catch {
    return false;
  }
}

interface IntroTourProps {
  onComplete: () => void;
}

export default function IntroTour({ onComplete }: IntroTourProps) {
  const [step, setStep] = useState(0);
  const screen = TOUR_SCREENS[step];
  const isLast = step === TOUR_SCREENS.length - 1;
  const Icon = screen.icon;

  const handleNext = () => {
    if (isLast) {
      markIntroTourSeen();
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    markIntroTourSeen();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="intro-tour">
      <div className="flex justify-end px-6 pt-12">
        {!isLast && (
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="btn-skip-tour"
          >
            Überspringen
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div
          className={cn(
            "w-28 h-28 rounded-full flex items-center justify-center mb-8 transition-all duration-500",
            screen.color
          )}
        >
          <Icon className="w-14 h-14" />
        </div>

        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
          {screen.subtitle}
        </p>
        <h2 className="font-display text-4xl font-bold mb-4">{screen.title}</h2>
        <p className="text-muted-foreground text-lg leading-relaxed max-w-sm">
          {screen.description}
        </p>
      </div>

      <div className="px-8 pb-12 space-y-6">
        <div className="flex justify-center gap-2">
          {TOUR_SCREENS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === step ? "w-8 bg-primary" : "w-2 bg-muted-foreground/20"
              )}
            />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={() => setStep(step - 1)}
              data-testid="btn-tour-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1 rounded-full text-base shadow-md"
            onClick={handleNext}
            data-testid={isLast ? "btn-tour-start" : "btn-tour-next"}
          >
            {isLast ? "Loslegen" : "Weiter"}
            {!isLast && <ChevronRight className="w-5 h-5 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
