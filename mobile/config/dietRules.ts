import type { AllergenId, DietId } from '../lib/diet/types';

/** Keyword → allergen(s). First match wins per allergen category; multiple allergens can apply. */
export const ALLERGEN_KEYWORD_RULES: { allergens: AllergenId[]; keywords: string[] }[] = [
  {
    allergens: ['milk'],
    keywords: [
      'butter',
      'milk',
      'cream',
      'cheese',
      'parmesan',
      'pecorino',
      'mozzarella',
      'cheddar',
      'ghee',
      'yogurt',
      'yoghurt',
      'whey',
      'casein',
      'ricotta',
      'feta',
      'brie',
      'gruyere',
      'mascarpone',
      'half and half',
      'half-and-half',
      'sour cream',
      'creme fraiche',
      'buttermilk',
    ],
  },
  {
    allergens: ['egg'],
    keywords: ['egg', 'eggs', 'mayonnaise', 'mayo', 'meringue', 'albumen'],
  },
  {
    allergens: ['fish'],
    keywords: [
      'fish',
      'salmon',
      'tuna',
      'cod',
      'tilapia',
      'anchovy',
      'anchovies',
      'sardine',
      'trout',
      'halibut',
      'mahi',
      'bass',
      'fish sauce',
    ],
  },
  {
    allergens: ['shellfish'],
    keywords: [
      'shrimp',
      'prawn',
      'crab',
      'lobster',
      'scallop',
      'clam',
      'mussel',
      'oyster',
      'crawfish',
      'crayfish',
      'shellfish',
    ],
  },
  {
    allergens: ['tree_nuts'],
    keywords: [
      'almond',
      'walnut',
      'pecan',
      'cashew',
      'pistachio',
      'hazelnut',
      'macadamia',
      'pine nut',
      'brazil nut',
      'chestnut',
      'pesto',
      'marzipan',
      'praline',
      'nutella',
    ],
  },
  {
    allergens: ['peanuts'],
    keywords: ['peanut', 'peanuts', 'groundnut'],
  },
  {
    allergens: ['wheat'],
    keywords: [
      'wheat',
      'flour',
      'bread',
      'breadcrumb',
      'breadcrumbs',
      'pasta',
      'noodle',
      'noodles',
      'couscous',
      'bulgur',
      'semolina',
      'farina',
      'spaghetti',
      'tortilla',
      'pita',
      'cracker',
      'crouton',
      'soy sauce',
      'teriyaki',
    ],
  },
  {
    allergens: ['soy'],
    keywords: [
      'soy',
      'soya',
      'tofu',
      'tempeh',
      'edamame',
      'miso',
      'soy sauce',
      'tamari',
    ],
  },
  {
    allergens: ['sesame'],
    keywords: ['sesame', 'tahini', 'halvah'],
  },
  {
    allergens: ['gluten'],
    keywords: [
      'wheat',
      'barley',
      'rye',
      'flour',
      'bread',
      'pasta',
      'noodle',
      'noodles',
      'couscous',
      'bulgur',
      'semolina',
      'soy sauce',
      'teriyaki',
      'beer',
      'malt',
      'seitan',
    ],
  },
];

/** Land meat & poultry — not fish/shellfish. */
export const MEAT_POULTRY_KEYWORDS: string[] = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'turkey',
  'duck',
  'bacon',
  'ham',
  'sausage',
  'brisket',
  'steak',
  'veal',
  'venison',
  'bison',
  'prosciutto',
  'pepperoni',
  'salami',
  'chorizo',
  'ground beef',
  'ground turkey',
  'ground pork',
  'meatball',
  'meat',
  'liver',
  'gelatin',
];

export const VEGAN_ANIMAL_KEYWORDS: string[] = [
  'honey',
  'gelatin',
  'lard',
  'tallow',
  'bone broth',
  'chicken stock',
  'beef stock',
  'fish stock',
  'anchovy',
];

export const TRACKED_DIETS: DietId[] = ['vegetarian', 'vegan', 'pescatarian', 'keto'];

/** All fish + shellfish ingredient phrases (longest first) for vegetarian/vegan diet checks. */
export const FISH_SHELLFISH_DIET_PHRASES: string[] = (() => {
  const phrases = new Set<string>();
  for (const rule of ALLERGEN_KEYWORD_RULES) {
    if (!rule.allergens.some((a) => a === 'fish' || a === 'shellfish')) continue;
    for (const keyword of rule.keywords) phrases.add(keyword);
  }
  return [...phrases].sort((a, b) => b.length - a.length);
})();
