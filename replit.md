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
- `user_settings` — Benutzereinstellungen (Haushaltsgröße, Budget, Kochzeit)
- `ingredients` — 60 Zutaten mit Kategorien und Bio-Empfehlung
- `recipes` + `recipe_ingredients` — Rezepte mit Zutaten (10 Starterrezepte)
- `meal_plans` + `meal_plan_days` + `meal_entries` — Mahlzeitenpläne

### DB-Befehle
```bash
pnpm --filter @workspace/db run push         # Schema pushen
npx tsx lib/db/src/seed.ts                  # Seed-Daten einspielen
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
| GET | /api/recipes | Nein | Rezepte (filter: energyType, search) |
| POST | /api/recipes | Ja | Rezept erstellen |
| GET | /api/recipes/:id | Nein | Einzelnes Rezept |
| PATCH | /api/recipes/:id | Ja | Rezept bearbeiten |
| DELETE | /api/recipes/:id | Ja | Rezept löschen |
| GET | /api/meal-plans | Ja | Mahlzeitenpläne des Nutzers |
| POST | /api/meal-plans | Ja | Plan erstellen |
| GET | /api/meal-plans/active | Ja | Aktiver Plan |
| GET | /api/today | Ja | Heutige Mahlzeiten |

## Frontend-Seiten (wouter)

- `/` — Landing Page (nicht eingeloggt) / Redirect zu /heute (eingeloggt)
- `/sign-in` — Clerk Sign-In
- `/sign-up` — Clerk Sign-Up
- `/onboarding` — 3-Schritt Onboarding (Willkommen → Profil → Einstellungen)
- `/heute` — Heutige Mahlzeiten (protected)
- `/plan` — Mahlzeitenpläne (protected)
- `/einkauf` — Einkaufsliste (protected, Phase 3)
- `/rezepte` — Rezeptbibliothek (protected)
- `/rezepte/neu` — Neues Rezept (protected)
- `/rezepte/:id` — Rezeptdetail (protected)
- `/einstellungen` — Einstellungen (protected)

## Umgebungsvariablen (Secrets)

| Variable | Beschreibung |
|----------|-------------|
| DATABASE_URL | PostgreSQL Verbindungs-URL |
| CLERK_SECRET_KEY | Clerk Server-seitiger Key |
| CLERK_PUBLISHABLE_KEY | Clerk Publishable Key (Server) |
| VITE_CLERK_PUBLISHABLE_KEY | Clerk Publishable Key (Frontend) |
| SESSION_SECRET | Express Session Secret |

## Projektphasen

- **Phase 1** ✅ Fundament: Auth, Datenbankschema, Basis-UI, API-Gerüst
- **Phase 2** Wochenplan-Builder: Drag&Drop, Mahlzeitenplanung
- **Phase 3** Einkaufsliste: Auto-Generierung aus Plan
- **Phase 4** KI-Layer: Claude AI für Rezeptvorschläge
- **Phase 5** Scanner: Barcode-Scanner für Zutaten
- **Phase 6** Lern-System: Personalisierung (abhängig von Phase 4)

## Wichtige Entwicklungshinweise

- API Client nutzt relative URLs (`/api/...`) — Replit Proxy leitet `/api` an Port 8080 weiter
- Clerk Proxy Middleware ist nur in Production aktiv (wird für Deployment benötigt)
- Frontend-Komponenten verwenden KEINE Emojis — ausschließlich Lucide Icons
- `data-testid` Attribute an allen interaktiven Elementen für E2E-Tests
- Codegen läuft mit `pnpm run --filter @workspace/api-spec codegen`
