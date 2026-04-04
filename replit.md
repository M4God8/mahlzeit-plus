# Mahlzeit+ — Workspace

## Übersicht

Mahlzeit+ ist eine deutschsprachige Mahlzeitenplanungs-App für bewusste Esser. pnpm-Monorepo mit TypeScript. Jedes Paket verwaltet seine eigenen Abhängigkeiten.

## Architektur

```
/
├── artifacts/
│   ├── mahlzeit/         React + Vite Frontend (Port $PORT, Preview: /)
│   └── api-server/       Express API Server (Port 8080, Prefix: /api)
├── lib/
│   ├── db/               Drizzle ORM + PostgreSQL Schema
│   ├── api-spec/         OpenAPI 3.1 Spec → Codegen
│   ├── api-client-react/ Orval-generierte React Query Hooks
│   └── api-zod/          Orval-generierte Zod Schemas
```

## Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + shadcn/ui + wouter
- **Auth:** Clerk (VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, VITE_CLERK_PUBLISHABLE_KEY)
- **Backend:** Express + @clerk/express (clerkMiddleware)
- **Datenbank:** PostgreSQL + Drizzle ORM
- **API:** OpenAPI 3.1 → Orval codegen → React Query Hooks + Zod Schemas
- **Sprache:** Vollständig auf Deutsch

## Design-System

- **Primärfarbe:** #E07070 (Lachs/Warmrot) → HSL: `0 68% 66%`
- **Akzent/Gold:** #C9A84C → HSL: `44 55% 54%`
- **Hintergrund:** #F8F5F2 (warmes Weiß) → HSL: `30 27% 96%`
- **Text:** #1A1A1A → HSL: `0 0% 10%`
- **Display-Font:** Playfair Display (Überschriften)
- **Body-Font:** DM Sans (UI-Text)
- **Mono-Font:** JetBrains Mono (Zahlen, Zeiten)

## Datenbankschema (Drizzle)

Tabellen in `lib/db/src/schema/`:
- `nutrition_profiles` — 5 Ernährungsprofile (Vollwertig, Pflanzenbasiert, Mediterran, Kraftvoll, Leicht)
- `user_settings` — Benutzereinstellungen (activeProfileIds int[], Haushaltsgröße, Budget, Kochzeit, role, blocked, premiumUntil, createdAt)
- `ingredients` — 60 Zutaten mit Kategorien, Bio-Empfehlung und Preisfelder (price_min, price_max, price_avg, price_unit, price_updated_at)
- `recipes` + `recipe_ingredients` — Rezepte mit Zutaten (10 Starterrezepte)
- `meal_plans` + `meal_plan_days` + `meal_entries` — Mahlzeitenpläne
- `ai_generations` — KI-Anfragen-Log (userId, type, input, output, model, inputTokens, outputTokens, costEur)
- `meal_feedback` — Mahlzeit-Feedback (thumbs_up/thumbs_down)
- `user_settings` hat zusätzlich: role (user/admin), isPremium, premiumExpiresAt, isBlocked, createdAt

### DB-Befehle
```bash
pnpm --filter @workspace/db run push         # Schema pushen
npx tsx lib/db/src/seed.ts                  # Seed-Daten einspielen
npx tsx lib/db/src/seed-admin.ts <clerk-id> # User zum Admin machen
```

## API-Endpunkte

Alle Routes unter `/api/` (proxied durch Replit zu Port 8080):

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | /api/healthz | Nein | Health Check |
| GET | /api/nutrition-profiles | Nein | Alle Ernährungsprofile |
| GET | /api/nutrition-profiles/:id | Nein | Ein Profil |
| GET | /api/user-settings | Ja | Nutzereinstellungen |
| POST | /api/user-settings | Ja | Einstellungen speichern |
| GET | /api/ingredients | Nein | Zutaten (filter: category, search) |
| GET | /api/recipes | Ja | Rezepte: eigene + öffentliche (filter: energyType, search) |
| POST | /api/recipes | Ja | Rezept erstellen |
| GET | /api/recipes/:id | Ja | Einzelnes Rezept (öffentliche oder eigene) |
| PATCH | /api/recipes/:id | Ja | Rezept bearbeiten |
| DELETE | /api/recipes/:id | Ja | Rezept löschen |
| GET | /api/meal-plans | Ja | Mahlzeitenpläne des Nutzers |
| POST | /api/meal-plans | Ja | Plan erstellen (auto-creates day rows) |
| POST | /api/meal-plans/starter | Ja | Starter-Plan erstellen/abrufen (idempotent) |
| GET | /api/meal-plans/active | Ja | Aktiver Plan (mit days + entries) |
| GET | /api/meal-plans/:id | Ja | Plan-Detail (mit days + entries) |
| PATCH | /api/meal-plans/:id | Ja | Plan aktualisieren (title, repeatEnabled) |
| DELETE | /api/meal-plans/:id | Ja | Plan löschen |
| POST | /api/meal-plans/:id/activate | Ja | Plan aktivieren |
| POST | /api/meal-plans/:id/copy | Ja | Plan kopieren (optionaler setActive) |
| POST | /api/meal-plans/:id/swap-days | Ja | Zwei Tage eines Plans tauschen |
| POST | /api/meal-plans/:id/days | Ja | Tag zu Plan hinzufügen |
| POST | /api/meal-plans/:id/days/:dayId/entries | Ja | Mahlzeiteintrag hinzufügen |
| PATCH | /api/meal-plans/:id/days/:dayId/entries/:entryId | Ja | Eintrag aktualisieren |
| DELETE | /api/meal-plans/:id/days/:dayId/entries/:entryId | Ja | Eintrag löschen |
| GET | /api/today | Ja | Heutige Mahlzeiten |
| POST | /api/ai/generate-recipe | Ja | KI: Rezept generieren (Claude) |
| POST | /api/ai/generate-plan | Ja | KI: Wochenplan generieren (Claude) |
| POST | /api/ai/adjust-recipe | Ja | KI: Rezept anpassen (Claude) |
| POST | /api/ai/substitute-ingredient | Ja | KI: Zutatens-Alternativen (Claude) |
| POST | /api/ai/save-recipe | Ja | KI-Rezept in Rezeptbibliothek speichern |
| POST | /api/ai/feedback | Ja | Mahlzeit-Feedback (thumbs_up/down) |
| GET | /api/admin/me | Admin | Admin-Check |
| GET | /api/admin/stats | Admin | Dashboard-Statistiken |
| GET | /api/admin/users | Admin | User-Liste mit Filtern (Plan, Profil, Zeitraum, KI-Nutzung) + Email von Clerk |
| PATCH | /api/admin/users/:id/premium | Admin | Premium aktivieren/deaktivieren |
| PATCH | /api/admin/users/:id/block | Admin | User sperren/entsperren |
| GET | /api/admin/costs | Admin | KI-Kosten Übersicht mit Filtern (dateFrom/dateTo, userId, aiType, groupBy=day/week/month) |
| GET | /api/admin/health | Admin | System Health Check (DB, Claude API, Open Food Facts, Stripe placeholder) |
| GET | /api/costs/recipe/:id | Ja | Kostenberechnung für ein Rezept (?servings=N optional) |
| GET | /api/costs/shopping-list/:id | Ja | Wochenkosten für eine Einkaufsliste |
| GET | /api/costs/today | Ja | Tageskosten für heutige Mahlzeiten |

## Frontend-Seiten (wouter)

- `/` — Landing Page (nicht eingeloggt) / Redirect zu /heute (eingeloggt)
- `/sign-in` — Clerk Sign-In
- `/sign-up` — Clerk Sign-Up
- `/onboarding` — 3-Schritt Onboarding (Willkommen → Profil → Einstellungen)
- `/heute` — Heutige Mahlzeiten mit "Alternative"-Button (protected)
- `/plan` — Plan-Liste mit Liste/Kalender Tabs (protected)
- `/plan/:id` — Plan-Detail: Wochengrid, Rezept-Zuweisung, Aktivieren, Kopieren, Tauschen (protected)
- `/einkauf` — Einkaufsliste (protected, Phase 3)
- `/rezepte` — Rezeptbibliothek (protected)
- `/rezepte/neu` — Neues Rezept (protected)
- `/rezepte/:id` — Rezeptdetail mit Edit/Delete + KI-Werkzeuge (Anpassen, Alternativen) (protected)
- `/rezepte/:id/bearbeiten` — Rezept bearbeiten (protected)
- `/ki` — KI-Küche: Rezeptgenerator + Wochenplan-Generator via Claude AI (protected)
- `/einstellungen` — Einstellungen (protected)
- `/admin` — Admin-Panel (nur role=admin, sonst Redirect)

## Umgebungsvariablen (Secrets)

| Variable | Beschreibung |
|----------|-------------|
| DATABASE_URL | PostgreSQL Verbindungs-URL |
| CLERK_SECRET_KEY | Clerk Server-seitiger Key |
| CLERK_PUBLISHABLE_KEY | Clerk Publishable Key (Server) |
| VITE_CLERK_PUBLISHABLE_KEY | Clerk Publishable Key (Frontend) |
| SESSION_SECRET | Express Session Secret |

## Intentionale Abweichungen von der Originalspezifikation

| Aspekt | Spec | Implementiert | Grund |
|--------|------|---------------|-------|
| Auth | Supabase Auth | Clerk | Replit-native Integration, Nutzer bestätigt |
| Routing | React Router v6 | wouter | Leichtgewichtiger, SSR-fähiger Router; funktional äquivalent |
| Users-Tabelle | Separate `users` Tabelle | Keine (Clerk User-ID als FK) | Clerk verwaltet Nutzer zentral |
| Bottom Navigation | 4 Tabs | 5 Tabs (+ Rezepte) | Design-Subagent, sinnvolle Ergänzung |
| Heute-Seed | Nicht spezifiziert | Starter-Plan via POST /starter | Echte User-ID bekannt erst nach Login |

## Umgebungsvariablen (Phase 4 KI)

| Variable | Beschreibung |
|----------|-------------|
| AI_INTEGRATIONS_ANTHROPIC_BASE_URL | Replit AI Proxy URL für Anthropic |
| AI_INTEGRATIONS_ANTHROPIC_API_KEY | Replit AI Proxy API Key |

KI-Modell: `claude-sonnet-4-6`, max_tokens: 8192

## Projektphasen

- **Phase 1** ✅ Fundament: Auth, Datenbankschema, Basis-UI, API-Gerüst
- **Phase 2** ✅ Wochenplan-Builder: Plan-CRUD, Rezept-Zuweisung, Aktivierung, Kopieren, Tage tauschen, Loop, Kalenderansicht, RecipeEdit
- **Phase 3** ✅ Einkaufsliste: Auto-Generierung aus Plan, Kategorisierung, Mengen-Aggregation
- **Phase 4** ✅ KI-Layer: Claude AI (Rezeptgenerator, Wochenplaner, Rezept-Anpassung, Zutaten-Alternativen, Feedback)
- **Phase 5** ✅ Scanner: Barcode-Scanner für Zutaten
- **Phase 6** ✅ Lern-System: Personalisierung (abhängig von Phase 4)
- **Phase 7** ✅ Preislogik: Kostenschätzung, Soft-Budget-Logik in KI-Prompts, Auto-Update Cron (Open Food Facts)

## Wichtige Entwicklungshinweise

- API Client nutzt relative URLs (`/api/...`) — Replit Proxy leitet `/api` an Port 8080 weiter
- Clerk Proxy Middleware ist nur in Production aktiv (wird für Deployment benötigt)
- Frontend-Komponenten verwenden KEINE Emojis — ausschließlich Lucide Icons
- `data-testid` Attribute an allen interaktiven Elementen für E2E-Tests
- Codegen läuft mit `pnpm run --filter @workspace/api-spec codegen`
