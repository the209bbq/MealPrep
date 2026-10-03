import type { PantryCategory, PantryStorageLocation } from '../../types/mealprep';

export interface PantryVisionDetection {
  name: string;
  quantity: number;
  unit: string;
  category: PantryCategory;
  confidence: number;
  /** From pantry-vision Edge Function when deployed; client falls back to keyword mapping. */
  storage?: PantryStorageLocation | string;
}

export interface PantryVisionResponse {
  items: PantryVisionDetection[];
  model?: string;
  cached?: boolean;
  itemCount?: number;
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
  location: PantryStorageLocation;
  /** Local preview URI (not sent to Supabase unless you upload separately). */
  photoUri: string | null;
  isDemoSample: boolean;
  /** Low model confidence — show “Check this” in review. */
  needsReview?: boolean;
  /** Original AI-detected label (immutable); used for correction logging. */
  sourceAiName?: string | null;
  /** User added via “Did I miss anything?” (or equivalent) during review. */
  addedManually?: boolean;
}

export interface PreparedPantryImage {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
  byteLength: number;
  /** SHA-256 of payload; set before analyze for scan cache. */
  contentHash?: string;
  /** Non-blocking quality hints; scan still uploads to vision. */
  qualityWarnings?: string[];
}
