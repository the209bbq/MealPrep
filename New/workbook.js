function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','));
  });
  return `${lines.join('\n')}\n`;
}

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      const bit = crc & 1;
      crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function u16(value) {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, value, true);
  return buf;
}

function u32(value) {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value, true);
  return buf;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data
    ]);
    localParts.push(local);
    const central = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ]);
    centralParts.push(central);
    offset += local.length;
  });

  const centralDir = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0)
  ]);
  return concatBytes([...localParts, centralDir, end]);
}

function sheetXml(rows) {
  const cellXml = rows.map((row, rIdx) => {
    const cells = row.map((value, cIdx) => {
      const col = String.fromCharCode(65 + cIdx);
      const text = xmlEscape(value);
      return `<c r="${col}${rIdx + 1}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    }).join('');
    return `<row r="${rIdx + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cellXml}</sheetData></worksheet>`;
}

function workbookXml(sheetNames) {
  const sheets = sheetNames.map((name, idx) => (
    `<sheet name="${xmlEscape(name).slice(0, 31)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
}

function workbookRels(count) {
  const rels = Array.from({ length: count }, (_, idx) => (
    `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function contentTypesXml(count) {
  const overrides = Array.from({ length: count }, (_, idx) => (
    `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${overrides}
</Types>`;
}

function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildXlsx(sheets) {
  const files = [
    { name: '[Content_Types].xml', data: contentTypesXml(sheets.length) },
    { name: '_rels/.rels', data: rootRels() },
    { name: 'xl/workbook.xml', data: workbookXml(sheets.map((sheet) => sheet.name)) },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels(sheets.length) }
  ];
  sheets.forEach((sheet, idx) => {
    files.push({
      name: `xl/worksheets/sheet${idx + 1}.xml`,
      data: sheetXml(sheet.rows)
    });
  });
  return zipStore(files);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCsv(filename, headers, rows) {
  const csv = toCsv(headers, rows);
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

function downloadXlsx(filename, sheets) {
  const bytes = buildXlsx(sheets);
  downloadBlob(filename, new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }));
}

function nutritionCompareRows(recipes) {
  const fields = Object.keys(emptyNutrition());
  const rows = [];
  recipes.forEach((recipe) => {
    const sourced = sanitizeNutrition(recipe.sourcedNutrition);
    const inputted = recipe.inputNutrition || {};
    const { effective, origins } = effectiveNutrition(sourced, inputted);
    fields.forEach((field) => {
      rows.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        field,
        input_value: inputted[field] ?? '',
        sourced_value: sourced[field] || '',
        effective_value: effective[field],
        origin: origins[field],
        source: recipe.nutritionSource || '',
        citation: recipe.nutritionCitation || '',
        sourced_at: recipe.nutritionSourcedAt || ''
      });
    });
    (recipe.ingredients || []).forEach((ingredient) => {
      const iSourced = sanitizeNutrition(ingredient.sourcedNutrition);
      const iInput = ingredient.inputNutrition || {};
      const merged = effectiveNutrition(iSourced, iInput);
      fields.forEach((field) => {
        rows.push({
          recipe_id: recipe.id,
          recipe_name: `${recipe.name} / ${ingredient.name}`,
          field,
          input_value: iInput[field] ?? '',
          sourced_value: iSourced[field] || '',
          effective_value: merged.effective[field],
          origin: merged.origins[field],
          source: ingredient.source || '',
          citation: ingredient.citation || '',
          sourced_at: ingredient.sourcedAt || ''
        });
      });
    });
  });
  return rows;
}

function recipeExportRows(recipes) {
  return recipes.map((recipe) => ({
    recipe_id: recipe.id,
    name: recipe.name,
    tag: recipe.tag,
    description: recipe.description,
    yield_portions: recipe.yieldPortions || '',
    portion_grams: recipe.portionGrams || '',
    ingredient_cost_total: recipeCost(recipe).toFixed(2),
    cost_per_portion: recipeCostPerPortion(recipe).toFixed(2),
    calories: recipe.calories,
    protein: recipe.protein,
    carbs: recipe.carbs,
    fat: recipe.fat,
    fiber: recipe.fiber,
    sodium: recipe.sodium,
    nutrition_origin: recipe.nutritionOrigin || '',
    on_this_week: recipe.onThisWeek ? 'yes' : 'no',
    sold_out: recipe.soldOut ? 'yes' : 'no'
  }));
}

function ingredientExportRows(recipes) {
  const rows = [];
  recipes.forEach((recipe) => {
    (recipe.ingredients || []).forEach((ingredient) => {
      rows.push({
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        ingredient: ingredient.name,
        amount: ingredient.amount || '',
        unit: ingredient.unit || '',
        grams: ingredient.grams || '',
        cost: ingredient.cost || '',
        store_id: ingredient.storeId || '',
        origin: ingredient.origin || '',
        source: ingredient.source || '',
        citation: ingredient.citation || '',
        sourced_at: ingredient.sourcedAt || '',
        fdc_id: ingredient.fdcId || '',
        url: ingredient.url || ''
      });
    });
  });
  return rows;
}

function recordExportRows(records) {
  return records.map((record) => ({
    record_id: record.id,
    timestamp: record.timestamp,
    kind: record.kind,
    origin: record.origin,
    source: record.source || '',
    citation: record.citation || '',
    url: record.url || '',
    subject_type: record.subjectType || '',
    subject_id: record.subjectId || '',
    values: JSON.stringify(record.values || {})
  }));
}

function tripExportRows(trip) {
  const rows = [];
  (trip.groups || []).forEach((group) => {
    group.items.forEach((item) => {
      rows.push({
        trip_id: trip.id,
        trip_label: trip.label,
        store: group.storeName,
        store_url: group.storeUrl || item.storeUrl || '',
        search_url: item.searchUrl || '',
        ingredient: item.name,
        amount: item.amount || '',
        unit: item.unit || '',
        grams: item.grams || '',
        cost: item.cost || '',
        recipe: item.recipeName,
        origin: item.origin || ''
      });
    });
  });
  return rows;
}

function exportBusinessWorkbook() {
  const recipes = getRecipes();
  const records = getRecords();
  const recipeRows = recipeExportRows(recipes);
  const ingredientRows = ingredientExportRows(recipes);
  const nutritionRows = nutritionCompareRows(recipes);
  const sourcedRows = recordExportRows(records);
  const recipeHeaders = Object.keys(recipeRows[0] || {
    recipe_id: '', name: '', tag: '', description: '', yield_portions: '', portion_grams: '',
    ingredient_cost_total: '', cost_per_portion: '', calories: '', protein: '', carbs: '', fat: '',
    fiber: '', sodium: '', nutrition_origin: '', on_this_week: '', sold_out: ''
  });
  const ingredientHeaders = ['recipe_id', 'recipe_name', 'ingredient', 'amount', 'unit', 'grams', 'cost', 'store_id', 'origin', 'source', 'citation', 'sourced_at', 'fdc_id', 'url'];
  const nutritionHeaders = ['recipe_id', 'recipe_name', 'field', 'input_value', 'sourced_value', 'effective_value', 'origin', 'source', 'citation', 'sourced_at'];
  const recordHeaders = ['record_id', 'timestamp', 'kind', 'origin', 'source', 'citation', 'url', 'subject_type', 'subject_id', 'values'];

  downloadCsv('209-recipes.csv', recipeHeaders, recipeRows);
  downloadCsv('209-ingredients.csv', ingredientHeaders, ingredientRows);
  downloadCsv('209-nutrition-input-vs-sourced.csv', nutritionHeaders, nutritionRows);
  downloadCsv('209-sourced-records.csv', recordHeaders, sourcedRows);

  downloadXlsx('209-meal-prep-workbook.xlsx', [
    { name: 'Recipes', rows: [recipeHeaders, ...recipeRows.map((row) => recipeHeaders.map((key) => row[key]))] },
    { name: 'Ingredients', rows: [ingredientHeaders, ...ingredientRows.map((row) => ingredientHeaders.map((key) => row[key]))] },
    { name: 'Nutrition', rows: [nutritionHeaders, ...nutritionRows.map((row) => nutritionHeaders.map((key) => row[key]))] },
    { name: 'Sourced records', rows: [recordHeaders, ...sourcedRows.map((row) => recordHeaders.map((key) => row[key]))] }
  ]);

  addRecord({
    kind: 'export',
    origin: 'input',
    source: 'Kitchen export',
    citation: 'Downloaded recipes, nutrition, and sourced-record spreadsheets',
    subjectType: 'workbook',
    values: {
      recipeCount: recipes.length,
      recordCount: records.length
    }
  });
}

function exportTripWorkbook(trip) {
  const headers = ['trip_id', 'trip_label', 'store', 'store_url', 'search_url', 'ingredient', 'amount', 'unit', 'grams', 'cost', 'recipe', 'origin'];
  const rows = tripExportRows(trip);
  downloadCsv(`209-shopping-${trip.id}.csv`, headers, rows);
  downloadXlsx(`209-shopping-${trip.id}.xlsx`, [
    { name: 'Shopping trip', rows: [headers, ...rows.map((row) => headers.map((key) => row[key]))] }
  ]);
}
