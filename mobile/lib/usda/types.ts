export type FoodNutrientRow = {
  nutrientId?: number;
  nutrientNumber?: number | string;
  nutrient?: { id?: number };
  value?: number;
  amount?: number;
};

export type UsdaFoodPayload = {
  fdcId: number;
  description?: string;
  lowercaseDescription?: string;
  dataType?: string;
  brandOwner?: string;
  foodNutrients?: FoodNutrientRow[];
};

export type UsdaSearchResponse = {
  foods?: UsdaFoodPayload[];
};

export type UsdaProxySearchBody = {
  action: 'search';
  query: {
    query: string;
    pageSize?: number;
    dataType?: string;
  };
};

export type UsdaProxyFoodBody = {
  action: 'food';
  fdcId: number;
};

export type UsdaProxyErrorEnvelope = {
  error?: string;
  code?: string;
};
