import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useGetUserSettings, useListNutritionProfiles, useCreateOrUpdateUserSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, LogOut, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  
  const { data: settings, isLoading: isLoadingSettings } = useGetUserSettings();
  const { data: profiles, isLoading: isLoadingProfiles } = useListNutritionProfiles();
  const updateSettings = useCreateOrUpdateUserSettings();

  const [profileId, setProfileId] = useState<string>("");
  const [householdSize, setHouseholdSize] = useState<number>(2);
  const [budgetLevel, setBudgetLevel] = useState<string>("medium");
  const [cookTimeLimit, setCookTimeLimit] = useState<number>(30);
  useEffect(() => {
    if (settings) {
      setProfileId(settings.profileId?.toString() || "");
      setHouseholdSize(settings.householdSize);
      setBudgetLevel(settings.budgetLevel);
      setCookTimeLimit(settings.cookTimeLimit);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      data: {
        profileId: profileId ? parseInt(profileId) : null,
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
                <Label>Ernährungsprofil</Label>
                <Select value={profileId} onValueChange={setProfileId}>
                  <SelectTrigger className="h-12 rounded-xl" data-testid="select-profile">
                    <SelectValue placeholder="Profil wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                disabled={isSaving}
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
