import { useMemo } from "react";
import { useGetUserSettings } from "@workspace/api-client-react";
import type { NutritionProfile } from "@workspace/api-client-react";

export interface CombinedProfileRules {
  excludedIngredients: string[];
  preferredCategories: string[];
  energyLabel: string;
  mealStyle: string;
  bioRecommended: boolean;
}

export function useActiveProfiles() {
  const { data: settings, isLoading, isError } = useGetUserSettings();

  const activeProfileIds = settings?.activeProfileIds ?? [];
  const profiles: NutritionProfile[] = settings?.profiles ?? [];

  const combinedRules = useMemo<CombinedProfileRules | null>(() => {
    if (!profiles.length) return null;

    const excludedSet = new Set<string>();
    const preferredSet = new Set<string>();
    let bioRecommended = false;

    for (const p of profiles) {
      for (const ing of p.excludedIngredients) excludedSet.add(ing);
      for (const cat of p.preferredCategories) preferredSet.add(cat);
      if (p.energyLabel === "bio" || p.mealStyle === "bio") {
        bioRecommended = true;
      }
    }

    return {
      excludedIngredients: Array.from(excludedSet),
      preferredCategories: Array.from(preferredSet),
      energyLabel: profiles[0].energyLabel,
      mealStyle: profiles[0].mealStyle,
      bioRecommended,
    };
  }, [profiles]);

  return {
    activeProfileIds,
    profiles,
    combinedRules,
    isLoading,
    isError,
  };
}
