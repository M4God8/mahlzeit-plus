import { db } from "@workspace/db";
import {
  nutritionProfilesTable,
  ingredientsTable,
} from "@workspace/db";
import { count } from "drizzle-orm";
import { logger } from "../lib/logger";

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

export async function ensureSeed(): Promise<void> {
  try {
    const [profileCount] = await db.select({ c: count() }).from(nutritionProfilesTable);
    const [ingredientCount] = await db.select({ c: count() }).from(ingredientsTable);

    const needProfiles = (profileCount?.c ?? 0) < nutritionProfiles.length;
    const needIngredients = (ingredientCount?.c ?? 0) < ingredients.length;

    if (!needProfiles && !needIngredients) {
      logger.info("Seed data already present, skipping");
      return;
    }

    logger.info(
      { needProfiles, needIngredients },
      "Seeding missing data...",
    );

    await db.transaction(async (tx) => {
      if (needProfiles) {
        for (const profile of nutritionProfiles) {
          await tx.insert(nutritionProfilesTable).values(profile).onConflictDoNothing();
        }
        logger.info({ count: nutritionProfiles.length }, "Seeded nutrition profiles");
      }

      if (needIngredients) {
        for (const ingredient of ingredients) {
          await tx.insert(ingredientsTable).values(ingredient).onConflictDoNothing();
        }
        logger.info({ count: ingredients.length }, "Seeded ingredients");
      }
    });

    logger.info("Seed complete");
  } catch (err) {
    logger.error({ err }, "Seed failed — app will start without seed data");
  }
}
