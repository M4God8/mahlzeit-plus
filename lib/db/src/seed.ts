import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import {
  nutritionProfilesTable,
  ingredientsTable,
  recipesTable,
  recipeIngredientsTable,
} from "./schema";

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
  { name: "Kartoffeln", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 75 },
  { name: "Möhren", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 80 },
  { name: "Zwiebeln", category: "Gemüse", defaultUnit: "g", bioRecommended: false, scoreBase: 70 },
  { name: "Knoblauch", category: "Gemüse", defaultUnit: "Zehe", bioRecommended: false, scoreBase: 72 },
  { name: "Tomaten", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 77 },
  { name: "Paprika", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 78 },
  { name: "Zucchini", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 73 },
  { name: "Spinat", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 85 },
  { name: "Brokkoli", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 88 },
  { name: "Blumenkohl", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 82 },
  { name: "Süßkartoffeln", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 86 },
  { name: "Sellerie", category: "Gemüse", defaultUnit: "g", bioRecommended: false, scoreBase: 70 },
  { name: "Porree", category: "Gemüse", defaultUnit: "g", bioRecommended: false, scoreBase: 73 },
  { name: "Gurken", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 65 },
  { name: "Auberginen", category: "Gemüse", defaultUnit: "g", bioRecommended: true, scoreBase: 72 },
  { name: "Champignons", category: "Pilze", defaultUnit: "g", bioRecommended: false, scoreBase: 75 },
  { name: "Steinpilze", category: "Pilze", defaultUnit: "g", bioRecommended: false, scoreBase: 82 },
  { name: "Kichererbsen", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 88 },
  { name: "Linsen (rot)", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 87 },
  { name: "Schwarze Bohnen", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 86 },
  { name: "Weiße Bohnen", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 84 },
  { name: "Tofu", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: true, scoreBase: 80 },
  { name: "Edamame", category: "Hülsenfrüchte", defaultUnit: "g", bioRecommended: false, scoreBase: 83 },
  { name: "Quinoa", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 90 },
  { name: "Vollkornnudeln", category: "Getreide", defaultUnit: "g", bioRecommended: false, scoreBase: 75 },
  { name: "Basmatireis", category: "Getreide", defaultUnit: "g", bioRecommended: false, scoreBase: 70 },
  { name: "Naturreis", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 78 },
  { name: "Dinkelmehl", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 76 },
  { name: "Haferflocken", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 85 },
  { name: "Buchweizen", category: "Getreide", defaultUnit: "g", bioRecommended: true, scoreBase: 88 },
  { name: "Hühnerbrust", category: "Fleisch & Fisch", defaultUnit: "g", bioRecommended: true, scoreBase: 72 },
  { name: "Lachs", category: "Fleisch & Fisch", defaultUnit: "g", bioRecommended: false, scoreBase: 85 },
  { name: "Thunfisch (Dose)", category: "Fleisch & Fisch", defaultUnit: "g", bioRecommended: false, scoreBase: 70 },
  { name: "Eier", category: "Milch & Eier", defaultUnit: "Stück", bioRecommended: true, scoreBase: 82 },
  { name: "Naturjoghurt", category: "Milch & Eier", defaultUnit: "g", bioRecommended: true, scoreBase: 78 },
  { name: "Mozzarella", category: "Milch & Eier", defaultUnit: "g", bioRecommended: false, scoreBase: 68 },
  { name: "Feta", category: "Milch & Eier", defaultUnit: "g", bioRecommended: false, scoreBase: 65 },
  { name: "Olivenöl", category: "Öle & Fette", defaultUnit: "EL", bioRecommended: true, scoreBase: 88 },
  { name: "Kokosöl", category: "Öle & Fette", defaultUnit: "EL", bioRecommended: false, scoreBase: 72 },
  { name: "Butter", category: "Öle & Fette", defaultUnit: "g", bioRecommended: true, scoreBase: 60 },
  { name: "Mandeln", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 87 },
  { name: "Walnüsse", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 89 },
  { name: "Chiasamen", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 90 },
  { name: "Kürbiskerne", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 86 },
  { name: "Erdnussbutter", category: "Nüsse & Saaten", defaultUnit: "g", bioRecommended: false, scoreBase: 78 },
  { name: "Zitrone", category: "Obst", defaultUnit: "Stück", bioRecommended: true, scoreBase: 80 },
  { name: "Banane", category: "Obst", defaultUnit: "Stück", bioRecommended: false, scoreBase: 75 },
  { name: "Äpfel", category: "Obst", defaultUnit: "Stück", bioRecommended: true, scoreBase: 80 },
  { name: "Kokosmilch", category: "Sonstiges", defaultUnit: "ml", bioRecommended: false, scoreBase: 70 },
  { name: "Gemüsebrühe", category: "Sonstiges", defaultUnit: "ml", bioRecommended: false, scoreBase: 60 },
  { name: "Tomaten (Dose)", category: "Sonstiges", defaultUnit: "g", bioRecommended: false, scoreBase: 72 },
  { name: "Sojasoße", category: "Sonstiges", defaultUnit: "EL", bioRecommended: false, scoreBase: 55 },
  { name: "Honig", category: "Sonstiges", defaultUnit: "EL", bioRecommended: true, scoreBase: 70 },
  { name: "Ahornsirup", category: "Sonstiges", defaultUnit: "EL", bioRecommended: false, scoreBase: 65 },
  { name: "Kurkuma", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 90 },
  { name: "Kreuzkümmel", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 82 },
  { name: "Paprikapulver", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 78 },
  { name: "Ingwer", category: "Gewürze", defaultUnit: "g", bioRecommended: false, scoreBase: 88 },
  { name: "Zimt", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 80 },
  { name: "Salz", category: "Gewürze", defaultUnit: "TL", bioRecommended: false, scoreBase: 50 },
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

  console.log("Seeding ingredients...");
  const insertedIngredients = await db
    .insert(ingredientsTable)
    .values(ingredients)
    .onConflictDoNothing()
    .returning();
  console.log(`Inserted ${insertedIngredients.length} ingredients`);

  const allIngredients = await db.select().from(ingredientsTable);
  const ingredientMap = new Map(allIngredients.map(i => [i.name, i.id]));

  console.log("Seeding recipes...");
  for (const recipe of recipeData) {
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
