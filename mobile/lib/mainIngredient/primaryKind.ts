import type { RecipeIngredient } from '../../types/mealprep';
import { normalizeIngredientName, tokenizeIngredientName } from '../recipeMatch/normalize';

const PROTEIN_RE =
  /\b(chicken|beef|pork|turkey|lamb|bacon|sausage|ham|steak|salmon|tuna|shrimp|prawn|cod|fish|tofu|tempeh|egg|eggs|ground beef|ground turkey|ground pork|tofu|beans|lentils|chickpea)\b/i;

const STARCH_RE =
  /\b(rice|pasta|spaghetti|penne|noodles|macaroni|potato|potatoes|sweet potato|bread|tortilla|quinoa|couscous|polenta|cornmeal|flour tortilla)\b/i;

const PRIMARY_VEG_RE =
  /\b(broccoli|cauliflower|zucchini|squash|eggplant|mushroom|mushrooms|spinach|kale|cabbage|carrot|carrots|bell pepper|peppers|asparagus|green beans)\b/i;

export function isPrimaryIngredientType(ingredient: RecipeIngredient): boolean {
  const norm = normalizeIngredientName(ingredient.name);
  if (!norm) return false;
  const haystack = `${norm} ${tokenizeIngredientName(ingredient.name).join(' ')}`;
  return PROTEIN_RE.test(haystack) || STARCH_RE.test(haystack) || PRIMARY_VEG_RE.test(haystack);
}
