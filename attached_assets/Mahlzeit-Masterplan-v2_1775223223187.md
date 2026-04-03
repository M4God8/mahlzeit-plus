# 🍽️ MAHLZEIT+ — Masterplan v2.0
**Replit Build-Fahrplan — April 2026**
*Überarbeitet nach GPT-Review*

---

## 🎯 Produktkern (1 Satz)

> **"Mahlzeit+ hilft dir, deinen Alltag mit einem wiederholbaren Essensplan, automatischer Einkaufsliste und intelligenten Rezeptvorschlägen zu vereinfachen — für Menschen, die bewusster und natürlicher leben wollen."**

---

## ⚡ MVP-Philosophie

```
Erst: brillante Wiederholungs-Meal-Plan-App + Einkaufsliste
Dann: KI
Dann: Scanner
Dann: tiefes Profiling + Coach
```

**Die eine Frage vor allem anderen:**
> Nutzen Leute den Plan und die Einkaufsliste regelmäßig?
> Wenn nicht, rettet kein Feature die App.

---

## 🏗️ Tech-Stack (Replit — Variante A: pragmatisch)

```
Frontend:    React + TypeScript + Vite
Styling:     Tailwind CSS + shadcn/ui
Backend:     Supabase (DB + Auth + Edge Functions)
ORM:         Drizzle ORM oder Supabase Client direkt
KI:          Claude API (Anthropic) — via eigene Edge Function
Validierung: Zod (für alle KI-Outputs zwingend)
Barcode:     Open Food Facts API
Kalender:    FullCalendar.js
State:       Zustand
Deployment:  Replit (Dev) → Supabase Hosting / Vercel
```

**Warum Supabase-First:**
Weniger bewegliche Teile. Kein eigener Express-Server im MVP nötig.
Auth, DB, Storage, Edge Functions = alles aus einer Hand.

---

## 📐 Datenmodell V1 (nur was V1 wirklich braucht)

```sql
-- Benutzer (via Supabase Auth)
users
  id, email, name, created_at

-- Ernährungsprofil (wählbar, 5 vordefinierte)
nutrition_profiles
  id, name, description,
  excluded_ingredients TEXT[],    -- klar strukturiert, kein wildes JSON
  preferred_categories TEXT[],
  meal_style TEXT,                -- 'simple' | 'varied' | 'prep'
  energy_label TEXT               -- 'leicht' | 'kraftvoll' | 'ruhig' | 'fokussiert'

-- Nutzer-Einstellungen
user_settings
  user_id, profile_id, household_size (1-6),
  budget_level (low/medium/high),
  cook_time_limit (15/30/60 min),
  bio_preferred BOOLEAN

-- Zutaten (interne Kochzutaten — GETRENNT von Scan-Produkten!)
ingredients
  id, name, category, default_unit, bio_recommended, score_base

-- Rezepte
recipes
  id, user_id, title, description,
  prep_time, cook_time, servings,
  instructions TEXT,
  tags TEXT[],
  ai_generated BOOLEAN,
  energy_type TEXT,    -- 'leicht' | 'sättigend' | 'schnell' | 'warm'
  is_public BOOLEAN,
  created_at

-- Rezept-Zutaten
recipe_ingredients
  id, recipe_id, ingredient_id, custom_name,
  amount DECIMAL, unit TEXT, optional BOOLEAN

-- Mahlzeitenpläne
meal_plans
  id, user_id, title,
  cycle_length_days INT,    -- 7, 10 oder 14
  repeat_enabled BOOLEAN,
  active BOOLEAN,
  created_at

-- Tage im Plan
meal_plan_days
  id, meal_plan_id, day_number

-- Mahlzeit-Einträge
meal_entries
  id, meal_plan_day_id,
  meal_type TEXT,   -- 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipe_id,
  custom_note TEXT,
  time_slot TIME

-- Einkaufslisten
shopping_lists
  id, user_id, week_start DATE, title TEXT,
  generated_from_plan_id, status TEXT

-- Einkaufslisten-Items
shopping_list_items
  id, list_id, ingredient_id, custom_name,
  quantity DECIMAL, unit TEXT, category TEXT,
  is_checked BOOLEAN, is_bio_preferred BOOLEAN

-- Meal-Feedback (Lern-System)
meal_feedback
  id, user_id, recipe_id, date DATE,
  rating INT (1-3),    -- 1=👎 2=😐 3=👍
  replaced BOOLEAN,    -- wurde Gericht ersetzt?
  notes TEXT

-- ⚡ NEU: Lernprofil (aus Feedback aggregiert)
user_learned_preferences
  user_id,
  avg_preferred_prep_time INT,
  frequently_replaced_recipes TEXT[],
  preferred_meal_complexity TEXT,   -- 'simple' | 'varied'
  last_updated

-- Gescannte Produkte (GETRENNT von ingredients!)
scanned_products
  id, barcode, name, brand,
  ingredients_text TEXT,
  nutriments_json JSONB,
  naturalness_score INT (0-25),
  nutrient_score INT (0-25),
  profile_fit_score INT (0-25),
  quality_score INT (0-25),
  total_score INT (0-100),
  cached_at

-- KI-Generierungen (Log)
ai_generations
  id, user_id, type TEXT,
  -- 'recipe_from_fridge' | 'plan_generate' | 'recipe_adjust' | 'ingredient_sub'
  input_json JSONB,
  output_json JSONB,
  saved_as_recipe_id,
  created_at
```

---

## 🗺️ Screen-Priorität (wichtigste Einsicht aus GPT-Review)

```
PRIMÄR (täglich genutzt):        SEKUNDÄR (wichtig aber nicht täglich):
┌─────────────┐                  ┌─────────────┐
│  1. HEUTE   │ ← Retention      │  4. Rezepte │
│  2. PLAN    │ ← Core-Value     │  5. KI      │ (Phase 4)
│  3. EINKAUF │ ← Killer-Feature │  6. Scanner │ (Phase 5)
└─────────────┘                  └─────────────┘
```

**V1 baut nur die 3 primären Screens perfekt.**

---

## 🔄 Die Wiederholungslogik (stärkstes Feature!)

Das ist laut GPT-Review der **eigentliche Hebel** — wichtiger als Scanner, KI oder Score.

```
Plan als Vorlage → "Diese Woche erneut" → anpassen
         ↓
Aktionen pro Tag:
  ├── "Tag tauschen" (Mo ↔ Mi)
  ├── "Gericht ersetzen" (einzelnes Gericht swappen)
  ├── "Einkaufsliste aktualisieren" (nach Änderung)
  └── "Woche kopieren + anpassen"

Plan-Modi:
  ├── Manuell (selbst befüllen)
  ├── KI-generiert ("Mach mir 14 Tage Clean Eating")
  └── Vorlage (eigene gespeicherte Pläne)

Zyklus-Optionen: 7 / 10 / 14 Tage
Wiederholung: Loop aktivierbar
```

---

## 🌱 Ernährungsprofile V2 (sprachlich zugänglicher)

```json
[
  {
    "id": 1,
    "name": "Natürlich & Clean",
    "description": "Wenig verarbeitet, keine Zusatzstoffe, bio bevorzugt",
    "exclude": ["Industriezucker", "Konservierungsstoffe", "E-Nummern"],
    "prefer": ["Bio", "Regional", "Vollkorn", "Frisch"],
    "energy_label": "klar & leicht"
  },
  {
    "id": 2,
    "name": "Proteinreich & Fokus",
    "description": "Sättigend, kraft- und nährstoffdicht, Meal-Prep-tauglich",
    "note": "Intern: 'Maskuline Klarheit' — wenig Erdnüsse, Bananen, kein Schweinefleisch",
    "exclude": ["Schweinefleisch", "Leere Kalorien", "Industriezucker"],
    "limit": ["Erdnüsse", "Bananen"],
    "prefer": ["Huhn", "Eier", "Hülsenfrüchte", "Butterschmalz", "Wurzelgemüse"],
    "energy_label": "kraftvoll & geerdet"
  },
  {
    "id": 3,
    "name": "Warm & Bekömmlich",
    "description": "Ayurveda-inspiriert, verdauungsfreundlich, gewürzt",
    "note": "Intern: Ayurveda-Profil",
    "exclude": ["Industriezucker", "Rohkost abends"],
    "prefer": ["Ghee", "Gewürze", "Hülsenfrüchte", "Gegarte Speisen"],
    "energy_label": "warm & beruhigend"
  },
  {
    "id": 4,
    "name": "Vegetarisch & Vollwertig",
    "description": "Pflanzlich, nährstoffreich, abwechslungsreich",
    "exclude": ["Fleisch", "Fisch"],
    "prefer": ["Hülsenfrüchte", "Nüsse", "Vollkorn", "Fermentiertes"],
    "energy_label": "leicht & vital"
  },
  {
    "id": 5,
    "name": "Ruhig & Leicht",
    "description": "Wenig, einfach, bekömmlich — für sensible Tage",
    "exclude": ["Schweres", "Fett", "Rohkost abends"],
    "prefer": ["Gedünstetes", "Suppen", "Einfache Zutaten"],
    "energy_label": "sanft & ruhig"
  }
]
```

**Hinweis:** Spirituelle Tiefe (energetische Ausrichtung, bewusstes Profil) lebt in der Markenkommunikation und im Onboarding — nicht als harte UI-Labels.

---

## 📊 Score-System V2 (mehrdimensional, kein falscher Absolutwert)

Nicht "Gesundheitsscore = absolute Wahrheit", sondern:

```
┌─────────────────────────────────────────────┐
│          MAHLZEIT+ PRODUKTCHECK             │
├──────────────────┬──────────────────────────┤
│ Zutatenklarheit  │ ████████░░  78/100        │
│ Profil-Fit       │ █████████░  90/100        │
│ Verarbeitungsgrad│ Mittel                    │
│ Alltagsempfehlung│ ✅ Gut für Clean Eating   │
└──────────────────┴──────────────────────────┘
```

```typescript
// Score-Berechnung (Zod-validiert)
const ScoreBreakdown = z.object({
  naturalness:    z.number().min(0).max(25),  // Zutatenklarheit
  nutrientBalance:z.number().min(0).max(25),  // Nährwert-Balance
  profileFit:     z.number().min(0).max(25),  // Profil-Kompatibilität
  qualityBonus:   z.number().min(0).max(25),  // Bio/Regional/Vollwert
  total:          z.number().min(0).max(100),
  label:          z.enum(['sehr empfehlenswert', 'gut', 'mit bedacht', 'lieber vermeiden']),
  profileMatch:   z.boolean(),
  betterAlternative: z.string().optional()
})

// Labels:
// 85-100: 🟢 Sehr empfehlenswert
// 65-84:  🟡 Gut — gelegentlich
// 40-64:  🟠 Mit Bedacht genießen
// 0-39:   🔴 Lieber vermeiden
```

---

## 🤖 KI-System (technisch sauber — Zod-Pflicht)

### 4 getrennte Output-Typen (kein universeller Prompt!)

```typescript
// 1. Rezept aus Kühlschrank generieren
const RecipeOutput = z.object({
  title: z.string(),
  description: z.string(),
  prep_time: z.number(),
  cook_time: z.number(),
  servings: z.number(),
  instructions: z.array(z.string()),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    unit: z.string(),
    bio_recommended: z.boolean()
  })),
  tags: z.array(z.string()),
  energy_type: z.enum(['leicht', 'sättigend', 'schnell', 'warm'])
})

// 2. Plan generieren
const PlanOutput = z.object({
  days: z.array(z.object({
    day_number: z.number(),
    breakfast: z.string(),
    lunch: z.string(),
    dinner: z.string()
  }))
})

// 3. Rezept anpassen
const RecipeAdjustOutput = z.object({
  original_title: z.string(),
  adjusted_title: z.string(),
  changes_made: z.array(z.string()),
  recipe: RecipeOutput
})

// 4. Zutat ersetzen
const IngredientSubOutput = z.object({
  original: z.string(),
  substitute: z.string(),
  reason: z.string(),
  flavor_impact: z.enum(['gleich', 'ähnlich', 'anders'])
})
```

### System-Prompt (modular)

```
Du bist der Mahlzeit+ Ernährungs-Assistent.

CHARAKTER: Warmherzig, klar, alltagsnah. Kein Diät-Coach.
Keine Belehrungen. Kein Moralizing. Hilfreich und konkret.

NUTZER-KONTEXT:
- Profil: {{profile_name}}
- Ausschlüsse: {{excluded_ingredients}}
- Bevorzugt: {{preferred_categories}}
- Haushalt: {{household_size}} Personen
- Kochzeit: max. {{cook_time}} Minuten
- Lernprofil: {{learned_preferences}}

REGELN:
- Keine Zusatzstoffe, keine E-Nummern
- Bio bevorzugen wenn möglich
- Portionen realistisch
- Einfache, klare Sprache
- Immer auf Deutsch
- IMMER als gültiges JSON — kein Markdown, kein Fließtext
- Schema: {{output_schema}}
```

### Fallback-Handling

```typescript
async function safeKICall<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
  try {
    const raw = await callClaude(prompt)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    return schema.parse(JSON.parse(cleaned))
  } catch (e) {
    // Repair-Versuch: nochmal mit explizitem "Nur JSON"-Hinweis
    const repaired = await callClaude(prompt + '\n\nWICHTIG: Antworte NUR mit JSON, kein Text.')
    return schema.parse(JSON.parse(repaired.replace(/```json|```/g, '').trim()))
  }
}
```

---

## 🧠 Lern-System (Retention-Motor)

```
Nach jeder Mahlzeit: 👍 / 😐 / 👎

Aggregation (wöchentlich):
  ├── Welche Rezepte werden wiederholt gewählt?
  ├── Welche werden ersetzt?
  ├── Welche Kochzeiten sind realistisch?
  └── Komplexität: simpel oder abwechslungsreich?

Ausgabe in der App:
  "Du bevorzugst schnelle Mittagessen (unter 20 Min) —
   soll ich den Plan nächste Woche vereinfachen?"

Beeinflusst:
  ├── KI-Vorschläge (weighted by feedback)
  ├── Plan-Generator
  └── "Heute"-Screen Alternative
```

---

## 🚀 BUILD-PHASEN V2

---

### PHASE 1 — Fundament (Woche 1)
**Ziel: Replit läuft, Auth, DB, Shell**

```
✅ Replit-Projekt Setup (React + TypeScript + Vite)
✅ Tailwind CSS + shadcn/ui
✅ Supabase Projekt anlegen (Auth + DB)
✅ Drizzle ORM konfigurieren
✅ Migrations: users, nutrition_profiles, user_settings,
              ingredients, recipes, recipe_ingredients
✅ Seed: 5 Ernährungsprofile + 60 Basis-Zutaten + 10 Starter-Rezepte
✅ React Router v6 + Bottom-Nav (4 Tabs)
✅ Farbschema: Primary #E07070, Gold #C9A84C, BG #F8F5F2
✅ Login + Onboarding (Profil-Auswahl)
```

**Deliverable:** Login → Profilwahl → leere App

---

### PHASE 2 — Core V1: Plan + Kalender (Wochen 2-3)
**Ziel: Planen und Kalender sehen**

```
✅ Migrations: meal_plans, meal_plan_days, meal_entries
✅ Plan-Builder (manuell, 7/10/14 Tage)
✅ Wiederholungslogik (Loop aktivieren)
✅ "Tag tauschen" Funktion
✅ "Gericht ersetzen" Funktion
✅ Kalender-Screen (Monatsansicht)
✅ Heute-Screen (Basis: zeigt heute's Mahlzeiten)
✅ Rezept-CRUD (erstellen, bearbeiten, löschen)
```

**Deliverable:** Vollständiger Meal-Planner ohne KI

---

### PHASE 3 — Core V1: Einkaufsliste (Woche 4)
**Ziel: Auto-Einkaufsliste — der Killer-Flow**

```
✅ Migrations: shopping_lists, shopping_list_items
✅ Auto-Generierung: aktiver Plan → Einkaufsliste
✅ Smart Merge: gleiche Zutaten zusammenführen
✅ Kategorien-Gruppierung (Gemüse, Obst, Protein...)
✅ Abhaken-Funktion (Einkaufsmodus)
✅ Bio-Flag pro Item
✅ Manuelle Items hinzufügen
✅ "Einkaufsliste für diese Woche" Button auf Heute-Screen
```

**Deliverable: V1 ist jetzt vollständig benutzbar**
→ Jetzt testen: Nutzt jemand Plan + Einkaufsliste regelmäßig?

---

### PHASE 4 — KI-Layer (Wochen 5-6)
**Ziel: Claude API eingebunden, 4 KI-Typen**

```
✅ Claude API Setup (Supabase Edge Function)
✅ Zod-Schemas für alle 4 Output-Typen
✅ Safe KI-Call mit Fallback-Repair
✅ KI-Küche Screen (Kühlschrank-Generator)
✅ Freie Anfragen ("15 Min, leicht, für 2 Personen")
✅ KI-Rezept direkt speichern / in Plan einfügen
✅ KI-Plan-Generator (Plan-Builder Integration)
✅ Rezept-Anpassung per KI ("mach es günstiger")
✅ Migrations: ai_generations (Log)
✅ Feedback-System (👍😐👎) + meal_feedback Tabelle
```

**Deliverable:** KI-Küche voll funktionsfähig

---

### PHASE 5 — Lern-System (Woche 7)
**Ziel: App lernt aus Nutzungsverhalten**

```
✅ Feedback-Aggregation (wöchentlicher Job)
✅ user_learned_preferences Tabelle befüllen
✅ KI-Prompts mit Lernprofil anreichern
✅ Heute-Screen: "Dein Profil sagt..." Hinweis
✅ Plan-Vorschlag basierend auf Präferenzen
```

**Deliverable:** Personalisierung aktiv

---

### PHASE 6 — Scanner & Score (Woche 8)
**Ziel: Barcode → Produkt-Bewertung**

```
✅ Open Food Facts API Integration
✅ Barcode-Scanner (react-zxing)
✅ Score-Berechnung (4 Teilwerte, Zod-validiert)
✅ Score-UI: mehrdimensionale Anzeige (nicht nur Zahl)
✅ Profil-Check: passt / passt nicht
✅ "Bessere Alternative" Vorschlag
✅ Produkt-Cache (scanned_products Tabelle)
✅ Migrations: scanned_products
```

**Deliverable:** Scanner produktionsbereit

---

### PHASE 7 — Polish, Freemium, Launch (Wochen 9-10)

```
✅ Onboarding-Flow (3-Screen Wizard)
✅ Freemium-Logik implementieren
✅ Stripe Integration (7,99€/Monat | 59€/Jahr)
✅ Push-Benachrichtigungen (Meal-Erinnerungen)
✅ Wochenexport PDF
✅ Performance-Optimierung
✅ Mobile-Responsive / PWA
✅ Dark Mode (optional)
✅ "Realitätsmodus" Button (schnell / günstig / Reste / Gäste)
```

**Deliverable: Launch-ready MVP**

---

## 💎 Free vs. Premium V2 (GPT-Empfehlung: Free nicht zu dünn!)

| Feature | Free | Premium |
|---|---|---|
| Heute-Screen | ✅ | ✅ |
| 7-Tage-Plan | ✅ | ✅ |
| Kalender | ✅ | ✅ |
| Einkaufsliste | ✅ | ✅ |
| Eigene Rezepte (5) | ✅ | ✅ |
| 1 Ernährungsprofil | ✅ | ✅ |
| KI-Generator (5/Monat) | ✅ | ✅ |
| 14-Tage + Wiederholung | ❌ | ✅ |
| KI-Generator (unbegrenzt) | ❌ | ✅ |
| KI-Plan-Generator | ❌ | ✅ |
| Rezept-Anpassung per KI | ❌ | ✅ |
| Scanner + Score | ❌ | ✅ |
| Alle 5 Profile | ❌ | ✅ |
| Lern-System | ❌ | ✅ |
| Export PDF | ❌ | ✅ |
| Realitätsmodus | ❌ | ✅ |

**Preis:** 7,99€/Monat | 59€/Jahr

---

## 🎨 Design-System

```css
/* Primärfarben */
--primary:      #E07070   /* Salmon/Warmrot */
--primary-dark: #C85050
--gold:         #C9A84C   /* Grundgericht-Tags, Akzente */
--bg:           #F8F5F2
--surface:      #FFFFFF
--text:         #1A1A1A
--muted:        #888888

/* Score-Farben */
--score-green:  #5A9E6F   /* 85-100 */
--score-gold:   #C9A84C   /* 65-84  */
--score-orange: #E0A030   /* 40-64  */
--score-red:    #C85050   /* 0-39   */

/* Typografie */
--font-display: 'Playfair Display'  (Überschriften)
--font-body:    'DM Sans'           (Fließtext)
--font-mono:    'JetBrains Mono'    (Zahlen, Scores)
```

---

## 📁 Projektstruktur (Replit + Supabase)

```
mahlzeit-plus/
├── src/
│   ├── components/
│   │   ├── ui/           (shadcn)
│   │   ├── layout/       (BottomNav, Header, PageShell)
│   │   ├── meals/        (MealCard, MealEntry, FeedbackButtons)
│   │   ├── calendar/     (CalendarView, DayDetail)
│   │   ├── plan/         (PlanBuilder, DayRow, RepeatToggle)
│   │   ├── recipes/      (RecipeCard, RecipeForm, RecipeFilter)
│   │   ├── shopping/     (ShoppingList, ShoppingItem, ShopMode)
│   │   ├── scanner/      (BarcodeScanner, ScoreCard, ScoreBreakdown)
│   │   └── ai/           (KitchenGenerator, PlanGenerator, RecipeAdjuster)
│   ├── pages/
│   │   ├── Today.tsx          ← PRIMÄR
│   │   ├── PlanBuilder.tsx    ← PRIMÄR
│   │   ├── Shopping.tsx       ← PRIMÄR
│   │   ├── Calendar.tsx
│   │   ├── Recipes.tsx
│   │   ├── AIKitchen.tsx
│   │   ├── Scanner.tsx
│   │   └── Settings.tsx
│   ├── store/            (Zustand — global state)
│   ├── hooks/            (useAuth, usePlan, useShopping, useAI)
│   ├── lib/
│   │   ├── supabase.ts   (Client)
│   │   ├── claude.ts     (KI-Service mit safe call)
│   │   ├── score.ts      (Score-Berechnung)
│   │   ├── openfoodfacts.ts
│   │   ├── shopping-generator.ts  (Plan → Liste, Smart Merge)
│   │   └── plan-utils.ts (Wiederholung, Tag-Tausch, Zyklus)
│   ├── schemas/          (Zod-Schemas für alle KI-Outputs)
│   └── types/
├── supabase/
│   ├── migrations/
│   └── functions/        (Edge Functions für KI-Calls)
└── public/
```

---

## ▶️ PHASE 1 — Replit Start-Prompt

```
Erstelle eine React + TypeScript + Vite App namens "Mahlzeit+" mit:

SETUP:
- Tailwind CSS + shadcn/ui
- React Router v6
- Supabase Client (@supabase/supabase-js)
- Drizzle ORM
- Zustand für State-Management
- Zod für Validierung

DESIGN:
- Primary Color: #E07070
- Gold Accent: #C9A84C
- Background: #F8F5F2
- Font: DM Sans (Google Fonts)

NAVIGATION:
Bottom Navigation mit 4 Tabs:
  🍽️ Menü (Today.tsx)
  📅 Kalender (Calendar.tsx) 
  🛒 Liste (Shopping.tsx)
  ⚙️ Einstellungen (Settings.tsx)

DATENBANK (Supabase SQL):
Folgende Tabellen anlegen:
  users, nutrition_profiles (5 Profile seed),
  user_settings, ingredients (60 Zutaten seed),
  recipes, recipe_ingredients,
  meal_plans, meal_plan_days, meal_entries,
  shopping_lists, shopping_list_items

HEUTE-SCREEN:
Header "Mahlzeit+" mit aktuellem Datum.
3 Karten: Frühstück / Mittag / Abendessen.
Jede Karte zeigt: Name, Kochzeit, "Alternative" Button.
Unten: Banner "Einkaufsliste für diese Woche →"

Alle Platzhalter-Daten aus Seed verwenden.
```

---

## 📊 Meilensteine

| Phase | Inhalt | Dauer | Priorität |
|---|---|---|---|
| 1 | Fundament + Auth + DB | 1 Woche | 🔴 Kritisch |
| 2 | Plan + Kalender + Wiederholung | 2 Wochen | 🔴 Kritisch |
| 3 | Einkaufsliste Auto-Gen | 1 Woche | 🔴 Kritisch |
| **→** | **V1 Test: Werden Plan + Einkauf genutzt?** | | |
| 4 | KI-Integration + Feedback | 2 Wochen | 🟡 Wichtig |
| 5 | Lern-System | 1 Woche | 🟡 Wichtig |
| 6 | Scanner + Score | 1 Woche | 🟢 Erweiterung |
| 7 | Polish + Freemium + Launch | 2 Wochen | 🟢 Launch |
| **MVP** | **App live** | **~10 Wochen** | |

---

## 🔮 Phase 8+ (Post-Launch)

```
⬜ Realitätsmodus (schnell / günstig / Reste / Gäste)
⬜ Autopilot-Woche (vollautomatisch)
⬜ Kalender-Sync (Google / Apple)
⬜ Family/Partner Sharing
⬜ Community-Pläne teilen
⬜ Budget-Modus ("10 Tage für 60€")
⬜ Meal Prep Modus
⬜ Coach-Modus (Ziel → Plan)
⬜ Native App (React Native / Expo)
⬜ Wochenexport PDF teilen
```

---

## GPT-Bewertung (ehrlich)

| Bereich | V1 | V2 |
|---|---|---|
| Strategie | 8.5/10 | 9/10 |
| Machbarkeit | 8/10 | 9/10 |
| Fokus | 7/10 | 8.5/10 |
| USP-Potenzial | 9/10 | 9/10 |
| MVP-Schärfe | 6.5/10 | 8.5/10 |

---

*Mahlzeit+ v2.0 — bewusst essen. einfach planen. klar leben.*
