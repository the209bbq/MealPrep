export interface StapleVarietyOption {
  id: string;
  label: string;
  /** Pantry row name used for recipe match and grocery lists. */
  pantryName: string;
}

/** Common subtype / cut / fat% choices keyed by staple catalog id. */
export const STAPLE_VARIETY_OPTIONS: Record<string, StapleVarietyOption[]> = {
  onions: [
    { id: 'yellow', label: 'Yellow', pantryName: 'Yellow onion' },
    { id: 'white', label: 'White', pantryName: 'White onion' },
    { id: 'red', label: 'Red', pantryName: 'Red onion' },
    { id: 'shallot', label: 'Shallots', pantryName: 'Shallots' },
    { id: 'green', label: 'Green', pantryName: 'Green onion' },
  ],
  garlic: [
    { id: 'fresh', label: 'Fresh heads', pantryName: 'Garlic' },
    { id: 'minced_jar', label: 'Minced (jar)', pantryName: 'Minced garlic' },
  ],
  potatoes: [
    { id: 'russet', label: 'Russet', pantryName: 'Russet potatoes' },
    { id: 'red', label: 'Red', pantryName: 'Red potatoes' },
    { id: 'yukon', label: 'Yukon gold', pantryName: 'Yukon gold potatoes' },
    { id: 'sweet', label: 'Sweet', pantryName: 'Sweet potatoes' },
  ],
  carrots: [
    { id: 'whole', label: 'Whole bag', pantryName: 'Carrots' },
    { id: 'baby', label: 'Baby', pantryName: 'Baby carrots' },
  ],
  celery: [
    { id: 'bunch', label: 'Bunch', pantryName: 'Celery' },
    { id: 'hearts', label: 'Hearts', pantryName: 'Celery hearts' },
  ],
  bell_peppers: [
    { id: 'green', label: 'Green', pantryName: 'Green bell pepper' },
    { id: 'red', label: 'Red', pantryName: 'Red bell pepper' },
    { id: 'yellow', label: 'Yellow', pantryName: 'Yellow bell pepper' },
    { id: 'orange', label: 'Orange', pantryName: 'Orange bell pepper' },
    { id: 'jalapeno', label: 'Jalapeño', pantryName: 'Jalapeño pepper' },
  ],
  tomatoes: [
    { id: 'roma', label: 'Roma', pantryName: 'Roma tomatoes' },
    { id: 'cherry', label: 'Cherry', pantryName: 'Cherry tomatoes' },
    { id: 'grape', label: 'Grape', pantryName: 'Grape tomatoes' },
    { id: 'vine', label: 'On the vine', pantryName: 'Tomatoes on the vine' },
  ],
  lettuce: [
    { id: 'romaine', label: 'Romaine', pantryName: 'Romaine lettuce' },
    { id: 'iceberg', label: 'Iceberg', pantryName: 'Iceberg lettuce' },
    { id: 'butter', label: 'Butter', pantryName: 'Butter lettuce' },
    { id: 'mixed', label: 'Mixed greens', pantryName: 'Mixed greens' },
  ],
  spinach: [
    { id: 'baby', label: 'Baby', pantryName: 'Baby spinach' },
    { id: 'bunch', label: 'Bunch', pantryName: 'Spinach' },
  ],
  bananas: [
    { id: 'yellow', label: 'Regular', pantryName: 'Bananas' },
    { id: 'green', label: 'Green / firm', pantryName: 'Green bananas' },
  ],
  apples: [
    { id: 'gala', label: 'Gala', pantryName: 'Gala apples' },
    { id: 'fuji', label: 'Fuji', pantryName: 'Fuji apples' },
    { id: 'honeycrisp', label: 'Honeycrisp', pantryName: 'Honeycrisp apples' },
    { id: 'granny', label: 'Granny Smith', pantryName: 'Granny Smith apples' },
  ],
  lemons: [
    { id: 'regular', label: 'Regular', pantryName: 'Lemons' },
    { id: 'meyer', label: 'Meyer', pantryName: 'Meyer lemons' },
  ],
  avocados: [
    { id: 'hass', label: 'Hass', pantryName: 'Avocados' },
    { id: 'ripe', label: 'Ripe now', pantryName: 'Ripe avocados' },
  ],
  broccoli: [
    { id: 'crowns', label: 'Crowns', pantryName: 'Broccoli' },
    { id: 'florets', label: 'Florets (bag)', pantryName: 'Broccoli florets' },
  ],
  cucumber: [
    { id: 'regular', label: 'Regular', pantryName: 'Cucumber' },
    { id: 'english', label: 'English', pantryName: 'English cucumber' },
    { id: 'persian', label: 'Persian', pantryName: 'Persian cucumbers' },
  ],

  milk: [
    { id: 'whole', label: 'Whole', pantryName: 'Whole milk' },
    { id: 'two_percent', label: '2%', pantryName: '2% milk' },
    { id: 'one_percent', label: '1%', pantryName: '1% milk' },
    { id: 'skim', label: 'Skim', pantryName: 'Skim milk' },
    { id: 'oat', label: 'Oat', pantryName: 'Oat milk' },
    { id: 'almond', label: 'Almond', pantryName: 'Almond milk' },
  ],
  eggs: [
    { id: 'large', label: 'Large', pantryName: 'Large eggs' },
    { id: 'extra_large', label: 'Extra large', pantryName: 'Extra large eggs' },
    { id: 'brown', label: 'Brown', pantryName: 'Brown eggs' },
    { id: 'cage_free', label: 'Cage-free', pantryName: 'Cage-free eggs' },
  ],
  butter: [
    { id: 'salted', label: 'Salted', pantryName: 'Salted butter' },
    { id: 'unsalted', label: 'Unsalted', pantryName: 'Unsalted butter' },
  ],
  cheddar: [
    { id: 'mild', label: 'Mild', pantryName: 'Mild cheddar cheese' },
    { id: 'sharp', label: 'Sharp', pantryName: 'Sharp cheddar cheese' },
    { id: 'extra_sharp', label: 'Extra sharp', pantryName: 'Extra sharp cheddar cheese' },
    { id: 'shredded', label: 'Shredded', pantryName: 'Shredded cheddar cheese' },
  ],
  yogurt: [
    { id: 'plain', label: 'Plain', pantryName: 'Plain yogurt' },
    { id: 'greek', label: 'Greek', pantryName: 'Greek yogurt' },
    { id: 'vanilla', label: 'Vanilla', pantryName: 'Vanilla yogurt' },
  ],
  sour_cream: [
    { id: 'regular', label: 'Regular', pantryName: 'Sour cream' },
    { id: 'light', label: 'Light', pantryName: 'Light sour cream' },
  ],
  cream_cheese: [
    { id: 'regular', label: 'Regular', pantryName: 'Cream cheese' },
    { id: 'whipped', label: 'Whipped', pantryName: 'Whipped cream cheese' },
    { id: 'neufchatel', label: '1/3 less fat', pantryName: 'Neufchâtel cheese' },
  ],

  chicken_breast: [
    { id: 'boneless_skinless', label: 'Boneless skinless', pantryName: 'Boneless skinless chicken breast' },
    { id: 'bone_in', label: 'Bone-in', pantryName: 'Bone-in chicken breast' },
    { id: 'thin_sliced', label: 'Thin-sliced', pantryName: 'Thin-sliced chicken breast' },
  ],
  ground_beef: [
    { id: '8020', label: '80/20', pantryName: 'Ground beef (80/20)' },
    { id: '8515', label: '85/15', pantryName: 'Ground beef (85/15)' },
    { id: '9010', label: '90/10', pantryName: 'Ground beef (90/10)' },
    { id: '9317', label: '93/7', pantryName: 'Ground beef (93/7)' },
  ],
  bacon: [
    { id: 'regular', label: 'Regular', pantryName: 'Bacon' },
    { id: 'thick', label: 'Thick cut', pantryName: 'Thick-cut bacon' },
    { id: 'turkey', label: 'Turkey', pantryName: 'Turkey bacon' },
  ],
  sausage: [
    { id: 'pork_breakfast', label: 'Pork breakfast', pantryName: 'Breakfast sausage' },
    { id: 'italian', label: 'Italian', pantryName: 'Italian sausage' },
    { id: 'chicken', label: 'Chicken', pantryName: 'Chicken sausage' },
    { id: 'turkey', label: 'Turkey', pantryName: 'Turkey sausage' },
  ],
  salmon: [
    { id: 'fresh_fillet', label: 'Fresh fillet', pantryName: 'Salmon fillet' },
    { id: 'frozen_fillet', label: 'Frozen fillet', pantryName: 'Frozen salmon fillet' },
    { id: 'wild', label: 'Wild-caught', pantryName: 'Wild salmon' },
    { id: 'farm', label: 'Farm-raised', pantryName: 'Farm-raised salmon' },
  ],

  rice: [
    { id: 'white', label: 'White', pantryName: 'White rice' },
    { id: 'brown', label: 'Brown', pantryName: 'Brown rice' },
    { id: 'jasmine', label: 'Jasmine', pantryName: 'Jasmine rice' },
    { id: 'basmati', label: 'Basmati', pantryName: 'Basmati rice' },
    { id: 'arborio', label: 'Arborio', pantryName: 'Arborio rice' },
  ],
  flour: [
    { id: 'all_purpose', label: 'All-purpose', pantryName: 'All-purpose flour' },
    { id: 'bread', label: 'Bread', pantryName: 'Bread flour' },
    { id: 'whole_wheat', label: 'Whole wheat', pantryName: 'Whole wheat flour' },
  ],
  sugar: [
    { id: 'granulated', label: 'Granulated', pantryName: 'Granulated sugar' },
    { id: 'brown', label: 'Brown', pantryName: 'Brown sugar' },
    { id: 'powdered', label: 'Powdered', pantryName: 'Powdered sugar' },
  ],
  pasta: [
    { id: 'spaghetti', label: 'Spaghetti', pantryName: 'Spaghetti' },
    { id: 'penne', label: 'Penne', pantryName: 'Penne pasta' },
    { id: 'rotini', label: 'Rotini', pantryName: 'Rotini pasta' },
    { id: 'elbows', label: 'Elbows', pantryName: 'Elbow macaroni' },
  ],
  canned_beans: [
    { id: 'black', label: 'Black', pantryName: 'Black beans' },
    { id: 'kidney', label: 'Kidney', pantryName: 'Kidney beans' },
    { id: 'pinto', label: 'Pinto', pantryName: 'Pinto beans' },
    { id: 'chickpea', label: 'Chickpeas', pantryName: 'Chickpeas' },
  ],
  canned_tomatoes: [
    { id: 'diced', label: 'Diced', pantryName: 'Diced canned tomatoes' },
    { id: 'crushed', label: 'Crushed', pantryName: 'Crushed canned tomatoes' },
    { id: 'whole', label: 'Whole peeled', pantryName: 'Whole canned tomatoes' },
    { id: 'paste', label: 'Paste', pantryName: 'Tomato paste' },
  ],
  peanut_butter: [
    { id: 'creamy', label: 'Creamy', pantryName: 'Creamy peanut butter' },
    { id: 'crunchy', label: 'Crunchy', pantryName: 'Crunchy peanut butter' },
    { id: 'natural', label: 'Natural', pantryName: 'Natural peanut butter' },
  ],
  oats: [
    { id: 'rolled', label: 'Rolled', pantryName: 'Rolled oats' },
    { id: 'quick', label: 'Quick', pantryName: 'Quick oats' },
    { id: 'steel_cut', label: 'Steel-cut', pantryName: 'Steel-cut oats' },
  ],
  cereal: [
    { id: 'flakes', label: 'Flakes', pantryName: 'Cereal flakes' },
    { id: 'o_cereal', label: 'O-shaped', pantryName: 'O-shaped cereal' },
    { id: 'granola', label: 'Granola', pantryName: 'Granola' },
  ],
  broth: [
    { id: 'chicken', label: 'Chicken', pantryName: 'Chicken broth' },
    { id: 'beef', label: 'Beef', pantryName: 'Beef broth' },
    { id: 'vegetable', label: 'Vegetable', pantryName: 'Vegetable broth' },
  ],
  honey: [
    { id: 'clover', label: 'Clover', pantryName: 'Clover honey' },
    { id: 'raw', label: 'Raw', pantryName: 'Raw honey' },
    { id: 'squeeze', label: 'Squeeze bottle', pantryName: 'Honey' },
  ],

  olive_oil: [
    { id: 'extra_virgin', label: 'Extra virgin', pantryName: 'Extra virgin olive oil' },
    { id: 'regular', label: 'Regular', pantryName: 'Olive oil' },
  ],
  vegetable_oil: [
    { id: 'canola', label: 'Canola', pantryName: 'Canola oil' },
    { id: 'vegetable', label: 'Vegetable blend', pantryName: 'Vegetable oil' },
    { id: 'sunflower', label: 'Sunflower', pantryName: 'Sunflower oil' },
  ],
  salt: [
    { id: 'table', label: 'Table', pantryName: 'Table salt' },
    { id: 'kosher', label: 'Kosher', pantryName: 'Kosher salt' },
    { id: 'sea', label: 'Sea', pantryName: 'Sea salt' },
  ],
  black_pepper: [
    { id: 'ground', label: 'Ground', pantryName: 'Ground black pepper' },
    { id: 'whole', label: 'Whole peppercorns', pantryName: 'Black peppercorns' },
  ],
  garlic_powder: [
    { id: 'powder', label: 'Powder', pantryName: 'Garlic powder' },
    { id: 'granulated', label: 'Granulated', pantryName: 'Granulated garlic' },
  ],
  paprika: [
    { id: 'sweet', label: 'Sweet', pantryName: 'Sweet paprika' },
    { id: 'smoked', label: 'Smoked', pantryName: 'Smoked paprika' },
    { id: 'hot', label: 'Hot', pantryName: 'Hot paprika' },
  ],
  cumin: [
    { id: 'ground', label: 'Ground', pantryName: 'Ground cumin' },
    { id: 'whole', label: 'Whole seed', pantryName: 'Cumin seeds' },
  ],
  soy_sauce: [
    { id: 'regular', label: 'Regular', pantryName: 'Soy sauce' },
    { id: 'low_sodium', label: 'Low sodium', pantryName: 'Low-sodium soy sauce' },
    { id: 'tamari', label: 'Tamari', pantryName: 'Tamari' },
  ],
  vinegar: [
    { id: 'white', label: 'White', pantryName: 'White vinegar' },
    { id: 'apple_cider', label: 'Apple cider', pantryName: 'Apple cider vinegar' },
    { id: 'balsamic', label: 'Balsamic', pantryName: 'Balsamic vinegar' },
    { id: 'rice', label: 'Rice', pantryName: 'Rice vinegar' },
  ],

  frozen_veg: [
    { id: 'mixed', label: 'Mixed', pantryName: 'Frozen mixed vegetables' },
    { id: 'broccoli', label: 'Broccoli', pantryName: 'Frozen broccoli' },
    { id: 'peas', label: 'Peas', pantryName: 'Frozen peas' },
    { id: 'corn', label: 'Corn', pantryName: 'Frozen corn' },
    { id: 'stir_fry', label: 'Stir-fry blend', pantryName: 'Frozen stir-fry vegetables' },
  ],
  frozen_berries: [
    { id: 'mixed', label: 'Mixed', pantryName: 'Frozen mixed berries' },
    { id: 'strawberry', label: 'Strawberry', pantryName: 'Frozen strawberries' },
    { id: 'blueberry', label: 'Blueberry', pantryName: 'Frozen blueberries' },
    { id: 'raspberry', label: 'Raspberry', pantryName: 'Frozen raspberries' },
  ],
  ice_cream: [
    { id: 'vanilla', label: 'Vanilla', pantryName: 'Vanilla ice cream' },
    { id: 'chocolate', label: 'Chocolate', pantryName: 'Chocolate ice cream' },
    { id: 'strawberry', label: 'Strawberry', pantryName: 'Strawberry ice cream' },
    { id: 'neapolitan', label: 'Neapolitan', pantryName: 'Neapolitan ice cream' },
  ],
  frozen_pizza: [
    { id: 'cheese', label: 'Cheese', pantryName: 'Frozen cheese pizza' },
    { id: 'pepperoni', label: 'Pepperoni', pantryName: 'Frozen pepperoni pizza' },
    { id: 'supreme', label: 'Supreme', pantryName: 'Frozen supreme pizza' },
    { id: 'margherita', label: 'Margherita', pantryName: 'Frozen margherita pizza' },
  ],

  bread: [
    { id: 'white', label: 'White', pantryName: 'White bread' },
    { id: 'wheat', label: 'Wheat', pantryName: 'Whole wheat bread' },
    { id: 'sourdough', label: 'Sourdough', pantryName: 'Sourdough bread' },
    { id: 'multigrain', label: 'Multigrain', pantryName: 'Multigrain bread' },
  ],
  tortillas: [
    { id: 'flour', label: 'Flour', pantryName: 'Flour tortillas' },
    { id: 'corn', label: 'Corn', pantryName: 'Corn tortillas' },
    { id: 'whole_wheat', label: 'Whole wheat', pantryName: 'Whole wheat tortillas' },
  ],
  bagels: [
    { id: 'plain', label: 'Plain', pantryName: 'Plain bagels' },
    { id: 'everything', label: 'Everything', pantryName: 'Everything bagels' },
    { id: 'cinnamon', label: 'Cinnamon raisin', pantryName: 'Cinnamon raisin bagels' },
    { id: 'whole_wheat', label: 'Whole wheat', pantryName: 'Whole wheat bagels' },
  ],
};

/** First pick when the user taps a staple tile without changing varieties. */
export const STAPLE_DEFAULT_VARIETY_ID: Partial<Record<string, string>> = {
  onions: 'yellow',
  garlic: 'fresh',
  potatoes: 'russet',
  carrots: 'whole',
  celery: 'bunch',
  bell_peppers: 'green',
  tomatoes: 'roma',
  lettuce: 'romaine',
  spinach: 'baby',
  bananas: 'yellow',
  apples: 'gala',
  lemons: 'regular',
  avocados: 'hass',
  broccoli: 'crowns',
  cucumber: 'regular',
  milk: 'whole',
  eggs: 'large',
  butter: 'salted',
  cheddar: 'sharp',
  yogurt: 'plain',
  sour_cream: 'regular',
  cream_cheese: 'regular',
  chicken_breast: 'boneless_skinless',
  ground_beef: '8020',
  bacon: 'regular',
  sausage: 'pork_breakfast',
  salmon: 'fresh_fillet',
  rice: 'white',
  flour: 'all_purpose',
  sugar: 'granulated',
  pasta: 'spaghetti',
  canned_beans: 'black',
  canned_tomatoes: 'diced',
  peanut_butter: 'creamy',
  oats: 'rolled',
  cereal: 'flakes',
  broth: 'chicken',
  honey: 'clover',
  olive_oil: 'extra_virgin',
  vegetable_oil: 'canola',
  salt: 'kosher',
  black_pepper: 'ground',
  garlic_powder: 'powder',
  paprika: 'sweet',
  cumin: 'ground',
  soy_sauce: 'regular',
  vinegar: 'white',
  frozen_veg: 'mixed',
  frozen_berries: 'mixed',
  ice_cream: 'vanilla',
  frozen_pizza: 'pepperoni',
  bread: 'wheat',
  tortillas: 'flour',
  bagels: 'plain',
};

export function attachStapleVarieties<T extends { id: string }>(
  entry: T,
): T & { varietyOptions?: StapleVarietyOption[]; defaultVarietyId?: string } {
  const varietyOptions = STAPLE_VARIETY_OPTIONS[entry.id];
  const defaultVarietyId = STAPLE_DEFAULT_VARIETY_ID[entry.id];
  if (!varietyOptions?.length) return entry;
  return {
    ...entry,
    varietyOptions,
    defaultVarietyId: defaultVarietyId ?? varietyOptions[0].id,
  };
}
