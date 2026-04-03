import { useState } from "react";
import { useCreateMealPlan } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlanCreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (planId: number) => void;
}

const CYCLE_OPTIONS = [
  { label: "7 Tage", value: 7 },
  { label: "10 Tage", value: 10 },
  { label: "14 Tage", value: 14 },
];

export default function PlanCreate({ open, onOpenChange, onCreated }: PlanCreateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createPlan = useCreateMealPlan();

  const [title, setTitle] = useState("Mein Wochenplan");
  const [cycleLengthDays, setCycleLengthDays] = useState(7);
  const [repeatEnabled, setRepeatEnabled] = useState(true);

  const handleCreate = () => {
    if (!title.trim()) {
      toast({ title: "Bitte einen Titel eingeben", variant: "destructive" });
      return;
    }
    createPlan.mutate(
      { data: { title: title.trim(), cycleLengthDays, repeatEnabled } },
      {
        onSuccess: (plan) => {
          queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
          toast({ title: "Plan erstellt", description: `„${plan.title}" wurde angelegt.` });
          onOpenChange(false);
          setTitle("Mein Wochenplan");
          if (onCreated && "id" in plan) onCreated((plan as { id: number }).id);
        },
        onError: () => {
          toast({ title: "Fehler", description: "Plan konnte nicht erstellt werden.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Neuer Plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label htmlFor="plan-title">Planname</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Gesunde Woche"
              className="rounded-xl h-12"
              data-testid="input-plan-title"
            />
          </div>

          <div className="space-y-2">
            <Label>Länge</Label>
            <div className="flex gap-2">
              {CYCLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCycleLengthDays(opt.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    cycleLengthDays === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                  data-testid={`btn-cycle-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card">
            <div>
              <p className="font-medium text-sm">Loop aktivieren</p>
              <p className="text-xs text-muted-foreground">Automatisch als nächste Woche wiederholen</p>
            </div>
            <Switch
              checked={repeatEnabled}
              onCheckedChange={setRepeatEnabled}
              data-testid="switch-repeat"
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={createPlan.isPending}
            className="w-full h-12 rounded-xl font-semibold"
            data-testid="btn-create-plan"
          >
            {createPlan.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Plan erstellen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
