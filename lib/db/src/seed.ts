import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import {
  nutritionProfilesTable,
  ingredientsTable,
  recipesTable,
  recipeIngredientsTable,
} from "./schema";
import { eq, and } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const nutritionProfiles = [
  {
    name: "Natürlich & Clean",
    description: "Natürliche, unverarbeitete Lebensmittel aus allen Gruppen. Kein Zucker, keine Zusatzstoffe — nur echte Zutaten, die du kennst und aussprechen kannst.",
    excludedIngredients: ["Zucker", "Süßungsmittel", "Fertigprodukte"],
    preferredCategories: ["Gemüse", "Getreide", "Hülsenfrüchte", "Nüsse"],
    mealStyle: "simple",
    energyLabel: "leicht",
  },
  {
    name: "Proteinreich & Fokus",
    description: "Viel Protein, wenig leere Kohlenhydrate. Für Menschen mit aktivem Lebensstil und klarem Kopf. Hülsenfrüchte, Eier, mageres Fleisch und Nüsse stehen im Mittelpunkt.",
    excludedIngredients: ["Weißmehl", "Zucker"],
    preferredCategories: ["Fleisch", "Hülsenfrüchte", "Eier", "Nüsse"],
    mealStyle: "high-protein",
    energyLabel: "kraftvoll",
  },
  {
    name: "Warm & Bekömmlich",
    description: "Warme, schonend zubereitete Mahlzeiten. Ideal bei empfindlichem Magen, kalten Jahreszeiten oder wenn du dich nach innen wenden willst. Viel Suppen, Eintöpfe und Gedünstetes.",
    excludedIngredients: ["Rohkost", "Eiskost"],
    preferredCategories: ["Gemüse", "Hülsenfrüchte", "Gewürze"],
    mealStyle: "gentle",
    energyLabel: "ruhig",
  },
  {
    name: "Vegetarisch & Vollwertig",
    description: "Überwiegend pflanzliche Kost aus vollwertigen Zutaten. Viel Gemüse, Hülsenfrüchte, Vollkorngetreide, Nüsse und Saaten. Milchprodukte und Eier in Maßen.",
    excludedIngredients: ["Fleisch", "Wurst", "Fisch"],
    preferredCategories: ["Gemüse", "Hülsenfrüchte", "Vollkorn", "Nüsse"],
    mealStyle: "varied",
    energyLabel: "leicht",
  },
  {
    name: "Ruhig & Leicht",
    description: "Leichte, leicht verdauliche Mahlzeiten ohne Schwere. Wenig Fett, viel Frisches. Für ruhige Tage, abends oder wenn du dich etwas fein und klar fühlen möchtest.",
    excludedIngredients: ["Fettes Fleisch", "Frittiertes"],
    preferredCategories: ["Gemüse", "Fisch", "Salat", "Obst"],
    mealStyle: "simple",
    energyLabel: "ruhig",
  },
];

const ingredients = [
  { name: "Kartoffeln", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 75, priceMin: "0.99", priceMax: "1.99", priceAvg: "1.49", priceUnit: "pro kg" },
  { name: "Möhren", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 80, priceMin: "0.89", priceMax: "1.79", priceAvg: "1.29", priceUnit: "pro kg" },
  { name: "Zwiebeln", category: "Gemüse", defaultUnit: "g", bioRecommended: false, scoreBase: 70, priceMin: "0.99", priceMax: "1.99", priceAvg: "1.49", priceUnit: "pro kg" },
  { name: "Knoblauch", category: "Gemüse", defaultUnit: "Zehe", bioRecommended: false, scoreBase: 72, priceMin: "0.49", priceMax: "1.29", priceAvg: "0.89", priceUnit: "pro Stück" },
  { name: "Tomaten", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 77, priceMin: "1.99", priceMax: "3.99", priceAvg: "2.99", priceUnit: "pro kg" },
  { name: "Paprika", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 78, priceMin: "2.49", priceMax: "4.99", priceAvg: "3.49", priceUnit: "pro kg" },
  { name: "Zucchini", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 73, priceMin: "1.49", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro kg" },
  { name: "Spinat", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 85, priceMin: "1.29", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro kg" },
  { name: "Brokkoli", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 88, priceMin: "1.99", priceMax: "3.49", priceAvg: "2.49", priceUnit: "pro kg" },
  { name: "Blumenkohl", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 82, priceMin: "1.49", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro kg" },
  { name: "Süßkartoffeln", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 86, priceMin: "2.49", priceMax: "4.49", priceAvg: "3.49", priceUnit: "pro kg" },
  { name: "Sellerie", category: "Gemüse", defaultUnit: "g", bioRecommended: false, scoreBase: 70, priceMin: "1.29", priceMax: "2.49", priceAvg: "1.79", priceUnit: "pro kg" },
  { name: "Porree", category: "Gemüse", defaultUnit: "g", bioRecommended: false, scoreBase: 73, priceMin: "1.49", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro kg" },
  { name: "Gurken", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 65, priceMin: "0.49", priceMax: "0.99", priceAvg: "0.69", priceUnit: "pro Stück" },
  { name: "Auberginen", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 72, priceMin: "1.99", priceMax: "3.99", priceAvg: "2.99", priceUnit: "pro kg" },
  { name: "Champignons", category: "Pilze", defaultUnit: "g", bioRecommended: false, scoreBase: 75, priceMin: "2.49", priceMax: "4.99", priceAvg: "3.49", priceUnit: "pro kg" },
  { name: "Steinpilze", category: "Pilze", defaultUnit: "g", bioRecommended: false, scoreBase: 82, priceMin: "19.90", priceMax: "39.90", priceAvg: "29.90", priceUnit: "pro kg" },
  { name: "Kichererbsen", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 88, priceMin: "1.29", priceMax: "2.49", priceAvg: "1.79", priceUnit: "pro kg" },
  { name: "Linsen (rot)", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 87, priceMin: "2.49", priceMax: "4.49", priceAvg: "3.29", priceUnit: "pro kg" },
  { name: "Schwarze Bohnen", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 86, priceMin: "1.49", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro kg" },
  { name: "Weiße Bohnen", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 84, priceMin: "1.49", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro kg" },
  { name: "Tofu", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 80, priceMin: "4.99", priceMax: "8.99", priceAvg: "6.49", priceUnit: "pro kg" },
  { name: "Edamame", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: false, scoreBase: 83, priceMin: "5.99", priceMax: "9.99", priceAvg: "7.99", priceUnit: "pro kg" },
  { name: "Quinoa", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 90, priceMin: "4.99", priceMax: "9.99", priceAvg: "6.99", priceUnit: "pro kg" },
  { name: "Vollkornnudeln", category: "Getreide", defaultUnit: "g", bioRecommended: false, scoreBase: 75, priceMin: "1.29", priceMax: "2.49", priceAvg: "1.79", priceUnit: "pro kg" },
  { name: "Basmatireis", category: "Getreide", defaultUnit: "g", bioRecommended: false, scoreBase: 70, priceMin: "2.49", priceMax: "4.99", priceAvg: "3.49", priceUnit: "pro kg" },
  { name: "Naturreis", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 78, priceMin: "1.99", priceMax: "3.99", priceAvg: "2.79", priceUnit: "pro kg" },
  { name: "Dinkelmehl", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 76, priceMin: "1.49", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro kg" },
  { name: "Haferflocken", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 85, priceMin: "1.19", priceMax: "2.49", priceAvg: "1.69", priceUnit: "pro kg" },
  { name: "Buchweizen", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 88, priceMin: "3.49", priceMax: "5.99", priceAvg: "4.49", priceUnit: "pro kg" },
  { name: "Hühnerbrust", category: "Fleisch & Fisch", defaultUnit: "g", bioRecommended: true, scoreBase: 72, priceMin: "7.99", priceMax: "14.99", priceAvg: "10.99", priceUnit: "pro kg" },
  { name: "Lachs", category: "Fleisch & Fisch", defaultUnit: "g", bioRecommended: false, scoreBase: 85, priceMin: "19.99", priceMax: "29.99", priceAvg: "24.99", priceUnit: "pro kg" },
  { name: "Thunfisch (Dose)", category: "Fleisch & Fisch", defaultUnit: "g", bioRecommended: false, scoreBase: 70, priceMin: "1.29", priceMax: "2.49", priceAvg: "1.79", priceUnit: "pro Stück" },
  { name: "Eier", category: "Milch & Eier", defaultUnit: "Stück", bioRecommended: true, scoreBase: 82, priceMin: "0.20", priceMax: "0.45", priceAvg: "0.30", priceUnit: "pro Stück" },
  { name: "Naturjoghurt", category: "Milch & Eier", defaultUnit: "g", bioRecommended: true, scoreBase: 78, priceMin: "1.49", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro kg" },
  { name: "Mozzarella", category: "Milch & Eier", defaultUnit: "g", bioRecommended: false, scoreBase: 68, priceMin: "4.99", priceMax: "9.99", priceAvg: "7.49", priceUnit: "pro kg" },
  { name: "Feta", category: "Milch & Eier", defaultUnit: "g", bioRecommended: false, scoreBase: 65, priceMin: "5.99", priceMax: "11.99", priceAvg: "7.99", priceUnit: "pro kg" },
  { name: "Olivenöl", category: "Öle & Fette", defaultUnit: "EL", bioRecommended: true, scoreBase: 88, priceMin: "5.99", priceMax: "12.99", priceAvg: "8.99", priceUnit: "pro L" },
  { name: "Kokosöl", category: "Öle & Fette", defaultUnit: "EL", bioRecommended: false, scoreBase: 72, priceMin: "4.99", priceMax: "9.99", priceAvg: "6.99", priceUnit: "pro L" },
  { name: "Butter", category: "Öle & Fette", defaultUnit: "g", bioRecommended: true, scoreBase: 60, priceMin: "1.59", priceMax: "2.99", priceAvg: "2.19", priceUnit: "pro Stück" },
  { name: "Mandeln", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 87, priceMin: "9.99", priceMax: "17.99", priceAvg: "13.99", priceUnit: "pro kg" },
  { name: "Walnüsse", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 89, priceMin: "11.99", priceMax: "19.99", priceAvg: "15.99", priceUnit: "pro kg" },
  { name: "Chiasamen", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 90, priceMin: "9.99", priceMax: "19.99", priceAvg: "14.99", priceUnit: "pro kg" },
  { name: "Kürbiskerne", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 86, priceMin: "8.99", priceMax: "16.99", priceAvg: "12.99", priceUnit: "pro kg" },
  { name: "Erdnussbutter", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 78, priceMin: "2.99", priceMax: "5.99", priceAvg: "3.99", priceUnit: "pro kg" },
  { name: "Zitrone", category: "Obst", defaultUnit: "Stück", bioRecommended: true, scoreBase: 80, priceMin: "0.29", priceMax: "0.59", priceAvg: "0.39", priceUnit: "pro Stück" },
  { name: "Banane", category: "Obst", defaultUnit: "Stück", bioRecommended: false, scoreBase: 75, priceMin: "0.15", priceMax: "0.35", priceAvg: "0.25", priceUnit: "pro Stück" },
  { name: "Äpfel", category: "Obst", defaultUnit: "Stück", bioRecommended: true, scoreBase: 80, priceMin: "0.25", priceMax: "0.59", priceAvg: "0.39", priceUnit: "pro Stück" },
  { name: "Kokosmilch", category: "Sonstiges", defaultUnit: "ml", bioRecommended: false, scoreBase: 70, priceMin: "1.29", priceMax: "2.49", priceAvg: "1.79", priceUnit: "pro Stück" },
  { name: "Gemüsebrühe", category: "Sonstiges", defaultUnit: "ml", bioRecommended: false, scoreBase: 60, priceMin: "0.79", priceMax: "1.99", priceAvg: "1.29", priceUnit: "pro L" },
  { name: "Tomaten (Dose)", category: "Sonstiges", defaultUnit: "g", bioRecommended: false, scoreBase: 72, priceMin: "0.49", priceMax: "1.29", priceAvg: "0.79", priceUnit: "pro Stück" },
  { name: "Sojasoße", category: "Sonstiges", defaultUnit: "EL", bioRecommended: false, scoreBase: 55, priceMin: "1.99", priceMax: "4.99", priceAvg: "2.99", priceUnit: "pro L" },
  { name: "Honig", category: "Sonstiges", defaultUnit: "EL", bioRecommended: true, scoreBase: 70, priceMin: "3.99", priceMax: "8.99", priceAvg: "5.99", priceUnit: "pro kg" },
  { name: "Ahornsirup", category: "Sonstiges", defaultUnit: "EL", bioRecommended: false, scoreBase: 65, priceMin: "6.99", priceMax: "14.99", priceAvg: "9.99", priceUnit: "pro L" },
  { name: "Kurkuma", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 90, priceMin: "1.49", priceMax: "3.99", priceAvg: "2.49", priceUnit: "pro Stück" },
  { name: "Kreuzkümmel", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 82, priceMin: "1.29", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro Stück" },
  { name: "Paprikapulver", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 78, priceMin: "0.99", priceMax: "2.49", priceAvg: "1.49", priceUnit: "pro Stück" },
  { name: "Ingwer", category: "Gewürze", defaultUnit: "g", bioRecommended: false, scoreBase: 88, priceMin: "3.99", priceMax: "7.99", priceAvg: "5.99", priceUnit: "pro kg" },
  { name: "Zimt", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 80, priceMin: "1.29", priceMax: "2.99", priceAvg: "1.99", priceUnit: "pro Stück" },
  { name: "Salz", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 50, priceMin: "0.29", priceMax: "0.99", priceAvg: "0.49", priceUnit: "pro kg" },
];

const recipeData = [
  {
    title: "Dhal mit roten Linsen",
    description: "Cremiges indisches Linsen-Gericht mit Kokosmilch und Gewürzen. Sättigend, wärmend und unglaublich einfach.",
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    instructions: "Zwiebeln und Knoblauch in Öl anschwitzen. Gewürze rösten. Linsen und Gemüsebrühe dazugeben, 20 Min köcheln. Kokosmilch einrühren, abschmecken.",
    tags: ["vegan", "glutenfrei", "sättigend"],
    energyType: "sättigend",
    isPublic: true,
    ingredients: [
      { name: "Linsen (rot)", amount: "300", unit: "g" },
      { name: "Zwiebeln", amount: "2", unit: "Stück" },
      { name: "Knoblauch", amount: "3", unit: "Zehe" },
      { name: "Kokosmilch", amount: "400", unit: "ml" },
      { name: "Gemüsebrühe", amount: "500", unit: "ml" },
      { name: "Kurkuma", amount: "1", unit: "TL" },
      { name: "Kreuzkümmel", amount: "1", unit: "TL" },
      { name: "Ingwer", amount: "20", unit: "g" },
      { name: "Olivenöl", amount: "2", unit: "EL" },
    ],
  },
  {
    title: "Quinoa-Bowl mit Röstzgemüse",
    description: "Bunte Bowl mit knackigem Ofengemüse, Quinoa und Tahini-Dressing. Schnell, nährstoffreich und vielfältig variierbar.",
    prepTime: 15,
    cookTime: 30,
    servings: 2,
    instructions: "Quinoa nach Packungsanweisung kochen. Gemüse in Stücke schneiden, mit Olivenöl und Gewürzen 25 Min rösten. Alles in einer Bowl anrichten, mit Tahini beträufeln.",
    tags: ["vegan", "glutenfrei", "meal-prep"],
    energyType: "leicht",
    isPublic: true,
    ingredients: [
      { name: "Quinoa", amount: "150", unit: "g" },
      { name: "Süßkartoffeln", amount: "300", unit: "g" },
      { name: "Brokkoli", amount: "200", unit: "g" },
      { name: "Paprika", amount: "1", unit: "Stück" },
      { name: "Olivenöl", amount: "3", unit: "EL" },
      { name: "Kurkuma", amount: "1", unit: "TL" },
      { name: "Kürbiskerne", amount: "30", unit: "g" },
    ],
  },
  {
    title: "Overnight Oats mit Beeren",
    description: "Über Nacht gequollene Haferflocken mit Naturjoghurt und frischen Früchten. Kein Kochen, maximale Wirkung.",
    prepTime: 5,
    cookTime: 0,
    servings: 1,
    instructions: "Haferflocken mit Joghurt, Milch und Honig verrühren. Im Kühlschrank über Nacht quellen lassen. Morgens mit Früchten und Chiasamen servieren.",
    tags: ["schnell", "frühstück", "meal-prep"],
    energyType: "schnell",
    isPublic: true,
    ingredients: [
      { name: "Haferflocken", amount: "80", unit: "g" },
      { name: "Naturjoghurt", amount: "150", unit: "g" },
      { name: "Chiasamen", amount: "15", unit: "g" },
      { name: "Honig", amount: "1", unit: "EL" },
      { name: "Banane", amount: "1", unit: "Stück" },
    ],
  },
  {
    title: "Mediterrane Kichererbsen-Pfanne",
    description: "Kichererbsen mit Tomaten, Paprika und Feta. In 20 Minuten fertig — typisch mediterran.",
    prepTime: 5,
    cookTime: 20,
    servings: 2,
    instructions: "Zwiebeln und Knoblauch anschwitzen. Paprika dazugeben, 5 Min mitbraten. Kichererbsen und Tomaten dazu, 10 Min köcheln. Mit Feta bestreuen und servieren.",
    tags: ["vegetarisch", "schnell", "mediterran"],
    energyType: "leicht",
    isPublic: true,
    ingredients: [
      { name: "Kichererbsen", amount: "400", unit: "g" },
      { name: "Tomaten (Dose)", amount: "400", unit: "g" },
      { name: "Paprika", amount: "2", unit: "Stück" },
      { name: "Zwiebeln", amount: "1", unit: "Stück" },
      { name: "Knoblauch", amount: "2", unit: "Zehe" },
      { name: "Feta", amount: "100", unit: "g" },
      { name: "Olivenöl", amount: "2", unit: "EL" },
    ],
  },
  {
    title: "Gebackener Lachs mit Brokkoli",
    description: "Einfaches One-Pan-Gericht mit Lachs und Ofenbrokkoli. Reich an Omega-3-Fettsäuren und Protein.",
    prepTime: 10,
    cookTime: 20,
    servings: 2,
    instructions: "Brokkoli in Röschen teilen, mit Olivenöl und Salz mischen. Lachs mit Zitrone belegen. Alles zusammen bei 200°C 18-20 Min backen.",
    tags: ["glutenfrei", "high-protein", "schnell"],
    energyType: "leicht",
    isPublic: true,
    ingredients: [
      { name: "Lachs", amount: "300", unit: "g" },
      { name: "Brokkoli", amount: "400", unit: "g" },
      { name: "Zitrone", amount: "1", unit: "Stück" },
      { name: "Olivenöl", amount: "2", unit: "EL" },
      { name: "Knoblauch", amount: "2", unit: "Zehe" },
      { name: "Salz", amount: "1", unit: "TL" },
    ],
  },
  {
    title: "Rote Bete Suppe",
    description: "Cremige Rote Bete Suppe mit Ingwer und einem Hauch Kokosmilch. Wunderschöne Farbe, intensive Wärme.",
    prepTime: 15,
    cookTime: 30,
    servings: 4,
    instructions: "Rote Bete schälen und würfeln. Mit Zwiebeln und Ingwer in Brühe weich kochen. Fein pürieren, Kokosmilch einrühren, abschmecken.",
    tags: ["vegan", "suppe", "warm"],
    energyType: "warm",
    isPublic: true,
    ingredients: [
      { name: "Möhren", amount: "200", unit: "g" },
      { name: "Zwiebeln", amount: "1", unit: "Stück" },
      { name: "Ingwer", amount: "30", unit: "g" },
      { name: "Kokosmilch", amount: "200", unit: "ml" },
      { name: "Gemüsebrühe", amount: "800", unit: "ml" },
      { name: "Olivenöl", amount: "2", unit: "EL" },
    ],
  },
  {
    title: "Gemüse-Curry mit Süßkartoffeln",
    description: "Sämiges Curry mit Süßkartoffeln, Kichererbsen und Spinat in Kokosmilch. Herzhaft, wärmend und vegan.",
    prepTime: 10,
    cookTime: 30,
    servings: 4,
    instructions: "Zwiebeln, Knoblauch und Ingwer anbraten. Gewürze rösten. Süßkartoffeln und Kichererbsen hinzufügen, mit Kokosmilch aufgießen. 20 Min köcheln, Spinat unterrühren.",
    tags: ["vegan", "glutenfrei", "sättigend"],
    energyType: "sättigend",
    isPublic: true,
    ingredients: [
      { name: "Süßkartoffeln", amount: "400", unit: "g" },
      { name: "Kichererbsen", amount: "300", unit: "g" },
      { name: "Spinat", amount: "200", unit: "g" },
      { name: "Kokosmilch", amount: "400", unit: "ml" },
      { name: "Zwiebeln", amount: "1", unit: "Stück" },
      { name: "Knoblauch", amount: "3", unit: "Zehe" },
      { name: "Ingwer", amount: "20", unit: "g" },
      { name: "Kurkuma", amount: "1", unit: "TL" },
      { name: "Kreuzkümmel", amount: "1", unit: "TL" },
    ],
  },
  {
    title: "Spinat-Feta-Rührei",
    description: "Schnelles, proteinreiches Frühstück mit Spinat, Feta und Eiern. Fertig in 10 Minuten.",
    prepTime: 5,
    cookTime: 10,
    servings: 2,
    instructions: "Eier aufschlagen und würzen. Spinat in Butter anwelken. Eiermasse dazu, weich rühren. Feta darüber bröckeln.",
    tags: ["vegetarisch", "frühstück", "high-protein", "schnell"],
    energyType: "schnell",
    isPublic: true,
    ingredients: [
      { name: "Eier", amount: "4", unit: "Stück" },
      { name: "Spinat", amount: "150", unit: "g" },
      { name: "Feta", amount: "80", unit: "g" },
      { name: "Butter", amount: "15", unit: "g" },
      { name: "Salz", amount: "0.5", unit: "TL" },
    ],
  },
  {
    title: "Zucchini-Nudeln mit Pesto",
    description: "Leichte Alternative zu klassischer Pasta — Zucchini-Spiralen mit hausgemachtem Basilikum-Pesto.",
    prepTime: 15,
    cookTime: 5,
    servings: 2,
    instructions: "Zucchini spiralisieren. Walnüsse, Basilikum, Knoblauch und Olivenöl zu Pesto pürieren. Zucchini kurz in Olivenöl schwenken, mit Pesto vermengen.",
    tags: ["vegan", "glutenfrei", "leicht"],
    energyType: "leicht",
    isPublic: true,
    ingredients: [
      { name: "Zucchini", amount: "600", unit: "g" },
      { name: "Walnüsse", amount: "50", unit: "g" },
      { name: "Knoblauch", amount: "2", unit: "Zehe" },
      { name: "Olivenöl", amount: "4", unit: "EL" },
      { name: "Zitrone", amount: "0.5", unit: "Stück" },
    ],
  },
  {
    title: "Hähnchen-Bowl mit Naturreis",
    description: "Proteinreiche Bowl mit saftigem Hähnchen, Naturreis und buntem Gemüse. Meal-Prep tauglich.",
    prepTime: 15,
    cookTime: 25,
    servings: 3,
    instructions: "Naturreis kochen. Hähnchenbrust würzen und in Olivenöl anbraten, 5 Min ruhen lassen. Gemüse in der gleichen Pfanne sautieren. Alles anrichten.",
    tags: ["high-protein", "meal-prep", "glutenfrei"],
    energyType: "sättigend",
    isPublic: true,
    ingredients: [
      { name: "Hühnerbrust", amount: "400", unit: "g" },
      { name: "Naturreis", amount: "200", unit: "g" },
      { name: "Brokkoli", amount: "200", unit: "g" },
      { name: "Möhren", amount: "150", unit: "g" },
      { name: "Olivenöl", amount: "2", unit: "EL" },
      { name: "Paprikapulver", amount: "1", unit: "TL" },
      { name: "Knoblauch", amount: "2", unit: "Zehe" },
    ],
  },
];

async function seed() {
  console.log("Seeding nutrition profiles...");
  const insertedProfiles = await db
    .insert(nutritionProfilesTable)
    .values(nutritionProfiles)
    .onConflictDoNothing()
    .returning();
  console.log(`Inserted ${insertedProfiles.length} nutrition profiles`);

  console.log("Seeding ingredients (with prices)...");
  for (const ing of ingredients) {
    const existing = await db
      .select({ id: ingredientsTable.id })
      .from(ingredientsTable)
      .where(eq(ingredientsTable.name, ing.name))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(ingredientsTable)
        .set({
          priceMin: ing.priceMin,
          priceMax: ing.priceMax,
          priceAvg: ing.priceAvg,
          priceUnit: ing.priceUnit,
          priceUpdatedAt: new Date(),
        })
        .where(eq(ingredientsTable.name, ing.name));
      console.log(`  ~ ${ing.name} (prices updated)`);
    } else {
      await db.insert(ingredientsTable).values({
        name: ing.name,
        category: ing.category,
        defaultUnit: ing.defaultUnit,
        bioRecommended: ing.bioRecommended,
        scoreBase: ing.scoreBase,
        priceMin: ing.priceMin,
        priceMax: ing.priceMax,
        priceAvg: ing.priceAvg,
        priceUnit: ing.priceUnit,
        priceUpdatedAt: new Date(),
      });
      console.log(`  + ${ing.name} (inserted with prices)`);
    }
  }

  const allIngredients = await db.select().from(ingredientsTable);
  const ingredientMap = new Map(allIngredients.map(i => [i.name, i.id]));

  console.log("Seeding recipes...");
  for (const recipe of recipeData) {
    const existing = await db
      .select({ id: recipesTable.id })
      .from(recipesTable)
      .where(and(eq(recipesTable.title, recipe.title), eq(recipesTable.isPublic, true)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ~ ${recipe.title} (skipped, already exists)`);
      continue;
    }

    const [inserted] = await db
      .insert(recipesTable)
      .values({
        title: recipe.title,
        description: recipe.description,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        instructions: recipe.instructions,
        tags: recipe.tags,
        energyType: recipe.energyType,
        isPublic: recipe.isPublic,
        aiGenerated: false,
      })
      .returning();

    const recipeIngredientValues = recipe.ingredients
      .map(ing => ({
        recipeId: inserted.id,
        ingredientId: ingredientMap.get(ing.name) ?? null,
        customName: ingredientMap.get(ing.name) ? null : ing.name,
        amount: ing.amount,
        unit: ing.unit,
        optional: false,
      }));

    if (recipeIngredientValues.length > 0) {
      await db.insert(recipeIngredientsTable).values(recipeIngredientValues);
    }
    console.log(`  + ${inserted.title}`);
  }

  console.log("Seed complete!");
  await pool.end();
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
