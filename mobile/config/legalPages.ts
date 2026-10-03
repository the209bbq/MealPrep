import appJson from '../app.json';

/** GitHub Pages site origin (repo: the209bbq/MealPrep). */
export const GITHUB_PAGES_ORIGIN = 'https://the209bbq.github.io';

function appBasePathFromConfig(): string {
  const baseUrl = appJson.expo?.experiments?.baseUrl ?? '';
  const trimmed = typeof baseUrl === 'string' ? baseUrl.trim() : '';
  if (!trimmed) return '/app';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

/** Published app root on GitHub Pages, e.g. `/MealPrep/app`. */
export const GITHUB_PAGES_APP_PATH = appBasePathFromConfig();

export type LegalPageSlug = 'privacy' | 'terms';

export function githubPagesLegalUrl(slug: LegalPageSlug): string {
  return `${GITHUB_PAGES_ORIGIN}${GITHUB_PAGES_APP_PATH}/${slug}`;
}

/** In-app / static-export routes on GitHub Pages (no `.html` suffix). */
export function githubPagesAppRouteUrl(routePath: string): string {
  const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${GITHUB_PAGES_ORIGIN}${GITHUB_PAGES_APP_PATH}${normalized}`;
}

export const ACCOUNT_DELETION_WEB_PATH = '/delete-account';

export function githubPagesAccountDeletionUrl(): string {
  return githubPagesAppRouteUrl(ACCOUNT_DELETION_WEB_PATH);
}

/** Static HTML filenames copied from `public/` into `dist/` on web export. */
export const LEGAL_STATIC_HTML = {
  privacy: 'privacy.html',
  terms: 'terms.html',
} as const;
