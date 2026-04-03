import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

import Home from "@/pages/Home";
import Today from "@/pages/heute/Today";
import Plan from "@/pages/plan/Plan";
import PlanDetail from "@/pages/plan/PlanDetail";
import Shopping from "@/pages/einkauf/Shopping";
import Settings from "@/pages/einstellungen/Settings";
import RecipeList from "@/pages/rezepte/RecipeList";
import NewRecipe from "@/pages/rezepte/NewRecipe";
import RecipeEdit from "@/pages/rezepte/RecipeEdit";
import RecipeDetail from "@/pages/rezepte/RecipeDetail";
import Onboarding from "@/pages/Onboarding";
import KiKueche from "@/pages/ki/KiKueche";
import NotFound from "@/pages/not-found";

import { BottomNav } from "@/components/layout/BottomNav";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

function SignInPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8 text-center">
          <span className="font-display font-bold text-2xl text-primary">Mahlzeit+</span>
        </div>
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8 text-center">
          <span className="font-display font-bold text-2xl text-primary">Mahlzeit+</span>
        </div>
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function useHasUserSettings() {
  const { isSignedIn, isLoaded } = useUser();
  return useQuery({
    queryKey: ["user-settings-check"],
    enabled: isLoaded && isSignedIn === true,
    queryFn: async () => {
      const res = await fetch("/api/user-settings", { credentials: "include" });
      if (res.status === 404) return false;
      if (res.status === 401 || res.status >= 500) {
        throw new Error(`Settings check failed: ${res.status}`);
      }
      if (!res.ok) throw new Error(`Unexpected status: ${res.status}`);
      return true;
    },
    retry: false,
    staleTime: 60_000,
  });
}

function AuthErrorFallback() {
  const { signOut } = useClerk();
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-background text-foreground px-6 text-center">
      <p className="text-lg font-semibold">Verbindungsfehler</p>
      <p className="text-sm text-muted-foreground">Die Einstellungen konnten nicht geladen werden. Bitte versuche es erneut.</p>
      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Erneut versuchen
        </button>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 rounded-md border text-sm font-medium"
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { data: hasSettings, isPending, isError } = useHasUserSettings();

  return (
    <>
      <Show when="signed-in">
        {isError ? (
          <AuthErrorFallback />
        ) : isPending || hasSettings === undefined ? (
          <div className="min-h-[100dvh] flex items-center justify-center bg-background">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : hasSettings ? (
          <Redirect to="/heute" />
        ) : (
          <Redirect to="/onboarding" />
        )}
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-20">
      {children}
      <BottomNav />
    </div>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: hasSettings, isPending, isError } = useHasUserSettings();

  if (isError) return <AuthErrorFallback />;

  if (isPending || hasSettings === undefined) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasSettings === false) {
    return <Redirect to="/onboarding" />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <OnboardingGuard>
          <AuthenticatedLayout>
            <Component />
          </AuthenticatedLayout>
        </OnboardingGuard>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          
          <Route path="/onboarding">
            <Show when="signed-in"><Onboarding /></Show>
            <Show when="signed-out"><Redirect to="/" /></Show>
          </Route>

          <Route path="/heute" component={() => <ProtectedRoute component={Today} />} />
          <Route path="/plan" component={() => <ProtectedRoute component={Plan} />} />
          <Route path="/plan/:id" component={() => <ProtectedRoute component={PlanDetail} />} />
          <Route path="/einkauf" component={() => <ProtectedRoute component={Shopping} />} />
          <Route path="/rezepte" component={() => <ProtectedRoute component={RecipeList} />} />
          <Route path="/rezepte/neu" component={() => <ProtectedRoute component={NewRecipe} />} />
          <Route path="/rezepte/:id/bearbeiten" component={() => <ProtectedRoute component={RecipeEdit} />} />
          <Route path="/rezepte/:id" component={() => <ProtectedRoute component={RecipeDetail} />} />
          <Route path="/ki" component={() => <ProtectedRoute component={KiKueche} />} />
          <Route path="/einstellungen" component={() => <ProtectedRoute component={Settings} />} />

          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
