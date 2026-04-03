import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useGetUserSettings, useListNutritionProfiles, useCreateOrUpdateUserSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, Loader2, LogOut, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  
  const { data: settings, isLoading: isLoadingSettings } = useGetUserSettings();
  const { data: profiles, isLoading: isLoadingProfiles } = useListNutritionProfiles();
  const updateSettings = useCreateOrUpdateUserSettings();

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [householdSize, setHouseholdSize] = useState<number>(2);
  const [budgetLevel, setBudgetLevel] = useState<string>("medium");
  const [cookTimeLimit, setCookTimeLimit] = useState<number>(30);

  useEffect(() => {
    if (settings) {
      setSelectedIds(settings.activeProfileIds ?? []);
      setHouseholdSize(settings.householdSize);
      setBudgetLevel(settings.budgetLevel);
      setCookTimeLimit(settings.cookTimeLimit);
    }
  }, [settings]);

  const toggleProfile = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          toast({ title: "Mindestens 1 Profil", description: "Du brauchst mindestens ein aktives Ernährungsprofil.", variant: "destructive" });
          return prev;
        }
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 3) {
        toast({ title: "Maximal 3 Profile", description: "Du kannst höchstens 3 Ernährungsprofile auswählen.", variant: "destructive" });
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSave = () => {
    updateSettings.mutate({
      data: {
        activeProfileIds: selectedIds,
        householdSize,
        budgetLevel,
        cookTimeLimit,
        bioPreferred: settings?.bioPreferred || false
      }
    }, {
      onSuccess: () => {
        toast({ title: "Gespeichert", description: "Deine Einstellungen wurden aktualisiert." });
      },
      onError: () => {
        toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" });
      }
    });
  };

  const isSaving = updateSettings.isPending;

  return (
    <div className="flex flex-col min-h-[100dvh] pb-24 animate-in fade-in duration-500 bg-background text-foreground">
      <header className="px-6 pt-10 pb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10">
        <h2 className="font-display text-4xl font-bold text-primary">Einstellungen</h2>
        <p className="text-muted-foreground mt-1">Dein Profil und Präferenzen</p>
      </header>

      <main className="flex-1 px-4 space-y-6">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 border border-primary/20">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-xl font-bold truncate">{user?.fullName || "Benutzer"}</h3>
              <p className="text-muted-foreground text-sm truncate">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </CardContent>
        </Card>

        {(isLoadingSettings || isLoadingProfiles) ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Präferenzen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Ernährungsprofile</Label>
                  <span className="text-sm text-muted-foreground">{selectedIds.length}/3 ausgewählt</span>
                </div>
                <div className="grid gap-2">
                  {profiles?.map(p => {
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProfile(p.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}
                        data-testid={`settings-profile-${p.id}`}
                      >
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{p.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.energyLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Haushaltsgröße</Label>
                  <span className="font-mono text-primary font-bold">{householdSize} Personen</span>
                </div>
                <Slider 
                  value={[householdSize]} 
                  min={1} max={6} step={1} 
                  onValueChange={v => setHouseholdSize(v[0])}
                  className="py-2"
                  data-testid="slider-household-settings"
                />
              </div>

              <div className="space-y-3">
                <Label>Budget-Niveau</Label>
                <RadioGroup value={budgetLevel} onValueChange={setBudgetLevel} className="flex gap-4">
                  {['low', 'medium', 'high'].map(level => (
                    <div key={level} className="flex items-center space-x-2">
                      <RadioGroupItem value={level} id={`set-budget-${level}`} data-testid={`radio-set-budget-${level}`} />
                      <Label htmlFor={`set-budget-${level}`} className="font-normal cursor-pointer">
                        {level === 'low' ? 'Günstig' : level === 'medium' ? 'Mittel' : 'Premium'}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Max. Kochzeit (Minuten)</Label>
                <RadioGroup value={cookTimeLimit.toString()} onValueChange={v => setCookTimeLimit(parseInt(v))} className="flex gap-4">
                  {[15, 30, 60].map(time => (
                    <div key={time} className="flex items-center space-x-2">
                      <RadioGroupItem value={time.toString()} id={`set-time-${time}`} data-testid={`radio-set-time-${time}`} />
                      <Label htmlFor={`set-time-${time}`} className="font-mono cursor-pointer">{time}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button 
                className="w-full h-12 rounded-full" 
                onClick={handleSave} 
                disabled={isSaving || selectedIds.length === 0}
                data-testid="btn-save-settings"
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Änderungen speichern
              </Button>
            </CardContent>
          </Card>
        )}

        <Button 
          variant="ghost" 
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-12 rounded-full"
          onClick={() => signOut()}
          data-testid="btn-signout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Abmelden
        </Button>
      </main>
    </div>
  );
}
