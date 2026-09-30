import type { PantryCategory } from '../../types/mealprep';

export interface PantryVisionDetection {
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  confidence: number;
}

export interface PantryVisionResponse {
  items: PantryVisionDetection[];
  model?: string;
}

export interface PantryVisionErrorEnvelope {
  error?: string;
  code?: string;
}

/** Editable row shown on the scan review screen before saving. */
export interface PantryScanReviewItem {
  key: string;
  enabled: boolean;
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  confidence: number;
  ingredientId: string;
  location: string;
  /** Local preview URI (not sent to Supabase unless you upload separately). */
  photoUri: string | null;
  isDemoSample: boolean;
}

export interface PreparedPantryImage {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
  byteLength: number;
}
