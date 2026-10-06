import { normalizeIngredientName } from '../recipeMatch/normalize';
import { convertQuantity, normalizeUnit, unitKind, unitsAreConvertible } from './conversion';

const CLOVES_PER_GARLIC_HEAD = 10;
const CUPS_CHOPPED_PER_MEDIUM_ONION = 1;
const DRY_RICE_CUPS_PER_LB = 2.5;
const TBSP_PER_STICK = 8;
const STICKS_PER_LB_BUTTER = 4;

const EGG_SIZE_UNITS = new Set(['large', 'medium', 'small', 'extra large', 'extra-large', 'xl']);
const CARROT_SIZE_UNITS = new Set(['large', 'medium', 'small']);

function ingredientKey(name: string): string {
  return normalizeIngredientName(name);
}

function isEggIngredient(name: string): boolean {
  const key = ingredientKey(name);
  return key === 'egg' || key === 'eggs' || key.includes(' egg');
}

function isOnionIngredient(name: string): boolean {
  const key = ingredientKey(name);
  return key.includes('onion') && !key.includes('green onion') && !key.includes('scallion');
}

function isGarlicIngredient(name: string): boolean {
  const key = ingredientKey(name);
  return key === 'garlic' || key.startsWith('garlic ');
}

function isButterIngredient(name: string): boolean {
  const key = ingredientKey(name);
  return key === 'butter' || (key.includes('butter') && !key.includes('peanut'));
}

function isRiceIngredient(name: string): boolean {
  const key = ingredientKey(name);
  return key === 'rice' || key.endsWith(' rice') || key.includes('jasmine') || key.includes('basmati');
}

function isCarrotIngredient(name: string): boolean {
  const key = ingredientKey(name);
  return key === 'carrot' || key === 'carrots' || key.startsWith('carrot ');
}

function normalizeCountishUnit(unit: string): string {
  const u = normalizeUnit(unit);
  if (EGG_SIZE_UNITS.has(u) || CARROT_SIZE_UNITS.has(u)) return 'each';
  return u;
}

function butterLbToUnit(quantityLb: number, toUnit: string): number | null {
  const to = normalizeUnit(toUnit);
  if (to === 'lb' || to === 'lbs' || to === 'pound' || to === 'pounds') return quantityLb;
  if (to === 'stick' || to === 'sticks') return quantityLb * STICKS_PER_LB_BUTTER;
  if (to === 'tbsp' || to === 'tablespoon' || to === 'tablespoons') {
    return quantityLb * STICKS_PER_LB_BUTTER * TBSP_PER_STICK;
  }
  if (to === 'cup' || to === 'cups') {
    const tbsp = butterLbToUnit(quantityLb, 'tbsp');
    if (tbsp === null) return null;
    return convertQuantity(tbsp, 'tbsp', 'cup');
  }
  if (to === 'oz' || to === 'ounce' || to === 'ounces') {
    return convertQuantity(quantityLb, 'lb', 'oz');
  }
  return null;
}

function butterFromUnitToLb(quantity: number, fromUnit: string): number | null {
  const from = normalizeUnit(fromUnit);
  if (from === 'lb' || from === 'lbs' || from === 'pound' || from === 'pounds') return quantity;
  if (from === 'stick' || from === 'sticks') return quantity / STICKS_PER_LB_BUTTER;
  if (from === 'tbsp' || from === 'tablespoon' || from === 'tablespoons') {
    return (quantity / TBSP_PER_STICK) / STICKS_PER_LB_BUTTER;
  }
  if (from === 'cup' || from === 'cups') {
    const tbsp = convertQuantity(quantity, 'cup', 'tbsp');
    if (tbsp === null) return null;
    return butterFromUnitToLb(tbsp, 'tbsp');
  }
  if (from === 'oz' || from === 'ounce' || from === 'ounces') {
    const lb = convertQuantity(quantity, 'oz', 'lb');
    return lb;
  }
  return null;
}

export function ingredientUnitsConvertible(ingredientName: string, unitA: string, unitB: string): boolean {
  const a = normalizeCountishUnit(unitA);
  const b = normalizeCountishUnit(unitB);
  if (unitsAreConvertible(a, b)) return true;

  const name = ingredientName;
  if (isEggIngredient(name) && (EGG_SIZE_UNITS.has(normalizeUnit(unitA)) || EGG_SIZE_UNITS.has(normalizeUnit(unitB)))) {
    return true;
  }
  if (isCarrotIngredient(name) && (CARROT_SIZE_UNITS.has(normalizeUnit(unitA)) || CARROT_SIZE_UNITS.has(normalizeUnit(unitB)))) {
    return true;
  }
  if (isOnionIngredient(name) && ((a === 'cup' || a === 'cups') !== (b === 'cup' || b === 'cups'))) {
    if (a === 'each' || b === 'each' || a === 'cup' || a === 'cups' || b === 'cup' || b === 'cups') return true;
  }
  if (isGarlicIngredient(name)) {
    const garlicUnits = new Set(['head', 'heads', 'clove', 'cloves', 'each']);
    if (garlicUnits.has(a) && garlicUnits.has(b)) return true;
  }
  if (isButterIngredient(name)) {
    const butterUnits = new Set(['lb', 'lbs', 'pound', 'pounds', 'oz', 'ounce', 'ounces', 'tbsp', 'tablespoon', 'tablespoons', 'cup', 'cups', 'stick', 'sticks']);
    if (butterUnits.has(a) && butterUnits.has(b)) return true;
  }
  if (isRiceIngredient(name)) {
    const mass = unitKind(a) === 'mass' || unitKind(b) === 'mass';
    const volume = unitKind(a) === 'volume' || unitKind(b) === 'volume';
    if (mass && volume) return true;
  }
  return false;
}

export function convertIngredientQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  ingredientName: string,
): number | null {
  const from = normalizeCountishUnit(fromUnit);
  const to = normalizeCountishUnit(toUnit);

  const direct = convertQuantity(quantity, from, to);
  if (direct !== null) return direct;

  const name = ingredientName;
  if (isEggIngredient(name)) {
    return convertQuantity(quantity, from, to);
  }
  if (isCarrotIngredient(name) && (CARROT_SIZE_UNITS.has(normalizeUnit(fromUnit)) || CARROT_SIZE_UNITS.has(normalizeUnit(toUnit)))) {
    return convertQuantity(quantity, from, to);
  }

  if (isOnionIngredient(name)) {
    if ((from === 'cup' || from === 'cups') && to === 'each') {
      return quantity / CUPS_CHOPPED_PER_MEDIUM_ONION;
    }
    if (from === 'each' && (to === 'cup' || to === 'cups')) {
      return quantity * CUPS_CHOPPED_PER_MEDIUM_ONION;
    }
  }

  if (isGarlicIngredient(name)) {
    if ((from === 'clove' || from === 'cloves') && (to === 'head' || to === 'heads')) {
      return quantity / CLOVES_PER_GARLIC_HEAD;
    }
    if ((from === 'head' || from === 'heads') && (to === 'clove' || to === 'cloves')) {
      return quantity * CLOVES_PER_GARLIC_HEAD;
    }
    if ((from === 'clove' || from === 'cloves') && to === 'each') {
      return quantity;
    }
    if (from === 'each' && (to === 'clove' || to === 'cloves')) {
      return quantity;
    }
  }

  if (isButterIngredient(name)) {
    const lb = butterFromUnitToLb(quantity, from);
    if (lb === null) return null;
    return butterLbToUnit(lb, to);
  }

  if (isRiceIngredient(name)) {
    const fromIsMass = unitKind(from) === 'mass';
    const toIsMass = unitKind(to) === 'mass';
    const fromIsVolume = unitKind(from) === 'volume';
    const toIsVolume = unitKind(to) === 'volume';
    if (fromIsMass && toIsVolume) {
      const lb = convertQuantity(quantity, from, 'lb');
      if (lb === null) return null;
      return lb * DRY_RICE_CUPS_PER_LB;
    }
    if (fromIsVolume && toIsMass) {
      const cups = convertQuantity(quantity, from, 'cup');
      if (cups === null) return null;
      const lb = cups / DRY_RICE_CUPS_PER_LB;
      return convertQuantity(lb, 'lb', to);
    }
  }

  return null;
}
