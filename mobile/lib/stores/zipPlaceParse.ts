export interface ZipGeocodeDisplayPoint {
  lat: number;
  lng: number;
  displayName?: string;
}

const US_STATE_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

export function parseCityStateFromNominatimDisplay(displayName: string): string | null {
  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  let stateAbbr: string | undefined;
  let stateIndex = -1;

  for (let i = parts.length - 1; i >= 0; i--) {
    const lower = parts[i].toLowerCase();
    if (lower === 'united states' || lower === 'usa') continue;
    const mapped = US_STATE_ABBR[lower];
    if (mapped) {
      stateAbbr = mapped;
      stateIndex = i;
      break;
    }
    if (/^[a-z]{2}$/i.test(parts[i])) {
      stateAbbr = parts[i].toUpperCase();
      stateIndex = i;
      break;
    }
  }

  if (!stateAbbr || stateIndex <= 0) return null;

  for (let j = stateIndex - 1; j >= 0; j--) {
    const candidate = parts[j];
    if (/^\d{5}(-\d{4})?$/.test(candidate)) continue;
    if (/county$/i.test(candidate)) continue;
    return `${candidate}, ${stateAbbr}`;
  }

  return null;
}

export function placeLabelFromGeocodePoint(point: ZipGeocodeDisplayPoint, zip: string): string {
  const normalizedZip = zip.trim().slice(0, 5);
  if (point.displayName) {
    const parsed = parseCityStateFromNominatimDisplay(point.displayName);
    if (parsed) return parsed;
  }
  return normalizedZip.length === 5 ? normalizedZip : zip;
}
