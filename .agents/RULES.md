# MAHLZEIT+ AGENT RULES
# Lies diese Datei VOR jedem Task.

## 🚨 NEVER TOUCH A RUNNING SYSTEM
Funktionierende Features sind EINGEFROREN:
- Scanner (Scanner.tsx + offService + obfService)
- Auth/Login Flow
- Einkaufslisten Smart Merge
- KI-Service (safeKICall + Zod-Schemas)
- DB-Migrationen (bestehende Spalten)

Regel: Neues NEBEN bestehendem bauen.
Nie bestehenden Code überschreiben.
Bei Änderung an gefrorenem Bereich → STOPP, fragen.

## 📋 DIFF VOR APPLY (IMMER)
Vor jeder Änderung:
1. Zeige exakten Diff (+ grün, - rot)
2. Warte auf "OK" von Martin
3. Erst dann bauen

## 🌍 CROSS-PLATFORM FIRST
Jedes Feature muss funktionieren auf:
- iOS Safari ✅
- iOS Chrome ✅
- Android Chrome ✅
- Desktop ✅
Keine Lösung die nur auf einem Browser läuft.

## 🏗️ STACK
Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
Backend: Express + PostgreSQL + Drizzle ORM
Auth: Clerk
KI: Claude API (Anthropic)
Scanner: @zxing/browser + @zxing/library
Barcode-APIs: OFF → OBF → OPF → UPCitemdb

## 🎨 DESIGN SYSTEM
Primary: #E07070
Gold: #C9A84C  
Background: #F8F5F2
Fonts: Playfair Display + DM Sans

## 🤖 KI-REGELN
- Zod-Schema für JEDEN KI-Output
- safeKICall mit Fallback-Repair
- Tokens loggen in ai_generations
- System-Prompt immer mit Nutzerkontext
- Claude Haiku für kurze/günstige Calls
- Claude Sonnet für komplexe Calls

## ✅ NACH JEDER MIGRATION
Server-Health prüfen bevor "needs approval":
GET /api/user-settings → muss 200 geben

## 💡 BEST SOLUTION FIRST
Immer die beste Cross-Platform Lösung.
Nie erst zweitbeste, dann nach Nachhaken die gute.
