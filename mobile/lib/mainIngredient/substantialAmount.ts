import type { RecipeIngredient } from '../../types/mealprep';
import { normalizeIngredientName } from '../recipeMatch/normalize';

const PROTEIN_RE =
  /\b(chicken|beef|pork|turkey|lamb|bacon|sausage|ham|steak|salmon|tuna|shrimp|prawn|cod|fish|tofu|tempeh|egg|eggs|ground beef|ground turkey|ground pork|beans|lentils|chickpea)\b/i;

const STARCH_RE =
  /\b(rice|pasta|spaghetti|penne|noodles|macaroni|potato|potatoes|sweet potato|bread|tortilla|quinoa|couscous|polenta)\b/i;

const PRIMARY_VEG_RE =
  /\b(broccoli|cauliflower|zucchini|squash|eggplant|mushroom|mushrooms|spinach|kale|cabbage|carrot|carrots|bell pepper|peppers|asparagus|green beans|lettuce|greens)\b/i;

const MIN_PROTEIN_GRAMS = 170;
const MIN_STARCH_GRAMS = 120;
const MIN_PRIMARY_VEG_GRAMS = 150;
const MIN_OTHER_GRAMS = 100;

export function isSubstantialMainAmount(ingredient: RecipeIngredient, grams: number | null): boolean {
  if (grams == null || grams <= 0) return false;
  const norm = normalizeIngredientName(ingredient.name);
  if (PROTEIN_RE.test(norm)) return grams >= MIN_PROTEIN_GRAMS;
  if (STARCH_RE.test(norm)) return grams >= MIN_STARCH_GRAMS;
  if (PRIMARY_VEG_RE.test(norm)) return grams >= MIN_PRIMARY_VEG_GRAMS;
  return grams >= MIN_OTHER_GRAMS;
}
