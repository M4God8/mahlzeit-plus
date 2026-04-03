import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nutritionProfilesRouter from "./nutritionProfiles";
import userSettingsRouter from "./userSettings";
import ingredientsRouter from "./ingredients";
import recipesRouter from "./recipes";
import mealPlansRouter from "./mealPlans";
import todayRouter from "./today";
import shoppingListsRouter from "./shoppingLists";
import aiRouter from "./ai";
import scannerRouter from "./scanner";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nutritionProfilesRouter);
router.use(userSettingsRouter);
router.use(ingredientsRouter);
router.use(recipesRouter);
router.use(mealPlansRouter);
router.use(todayRouter);
router.use(shoppingListsRouter);
router.use(aiRouter);
router.use(scannerRouter);

export default router;
