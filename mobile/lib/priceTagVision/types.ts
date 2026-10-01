export interface PriceTagVisionResult {
  itemName: string;
  price: number;
  sizeUnit?: string;
  saleValidUntil?: string | null;
  model?: string;
}

export interface PriceTagVisionErrorEnvelope {
  error?: string;
  code?: string;
}
