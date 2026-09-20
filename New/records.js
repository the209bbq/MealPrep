const RECORDS_KEY = '209-meal-prep-records';
const SETTINGS_KEY = '209-meal-prep-settings';

function emptyNutrition() {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    iron: 0
  };
}

function roundNutrition(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const micros = field === 'sodium' || field === 'potassium' || field === 'calcium' || field === 'iron';
  return Number(n.toFixed(micros ? 1 : 1));
}

function sanitizeNutrition(raw) {
  const next = emptyNutrition();
  if (!raw || typeof raw !== 'object') return next;
  Object.keys(next).forEach((field) => {
    next[field] = roundNutrition(raw[field], field);
  });
  return next;
}

function nutritionHasValues(nutrition) {
  return Object.values(sanitizeNutrition(nutrition)).some((value) => value > 0);
}

function effectiveNutrition(sourced, inputted) {
  const source = sanitizeNutrition(sourced);
  const input = sanitizeNutrition(inputted);
  const effective = emptyNutrition();
  const origins = {};
  Object.keys(effective).forEach((field) => {
    if (inputted && inputted[field] !== undefined && inputted[field] !== '' && Number.isFinite(Number(inputted[field]))) {
      effective[field] = roundNutrition(inputted[field], field);
      origins[field] = 'input';
    } else {
      effective[field] = source[field];
      origins[field] = source[field] ? 'sourced' : 'unset';
    }
  });
  return { effective, origins };
}

function createRecordId() {
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getRecords() {
  try {
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    return Array.isArray(records) ? records : [];
  } catch (error) {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function addRecord(entry) {
  const record = {
    id: createRecordId(),
    timestamp: new Date().toISOString(),
    origin: 'sourced',
    ...entry
  };
  const records = getRecords();
  records.unshift(record);
  saveRecords(records.slice(0, 500));
  return record;
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function getUsdaApiKey() {
  const settings = getSettings();
  const fromSettings = (settings.usdaApiKey || '').trim();
  if (fromSettings) return fromSettings;
  const config = window.MEALPREP_CONFIG || {};
  return (config.usdaApiKey || '').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}
