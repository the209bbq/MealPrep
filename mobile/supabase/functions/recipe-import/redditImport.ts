import type { RecipeImportExtracted } from './recipeImportSchema.ts';
import { sanitizeHttpUrl } from './safeHttpUrl.ts';
import {
  RECIPE_FETCH_MAX_REDIRECTS,
  resolveRedirectLocation,
  validatePublicHttpFetchUrl,
} from './ssrfGuard.ts';
import { parseRuleBasedRecipeFromText, recipeSignalsInText } from './textRecipeParse.ts';

export const REDDIT_FETCH_USER_AGENT =
  'MealPlanaticRecipeImport/1.0 (+https://mealplanatic.app; reddit-recipe-importer)';

const REDDIT_HOSTS = new Set([
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'm.reddit.com',
  'redd.it',
  'www.redd.it',
]);

export type RedditImportErrorCode =
  | 'REDDIT_DELETED'
  | 'REDDIT_PRIVATE'
  | 'REDDIT_NSFW'
  | 'REDDIT_NOT_RECIPE'
  | 'REDDIT_BAD_LINK';

export class RedditImportError extends Error {
  readonly code: RedditImportErrorCode;
  readonly userMessage: string;

  constructor(code: RedditImportErrorCode, userMessage: string) {
    super(userMessage);
    this.code = code;
    this.userMessage = userMessage;
  }
}

export interface RedditPostContext {
  postId: string;
  permalink: string;
  canonicalPostUrl: string;
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  isSelf: boolean;
  over18: boolean;
  externalUrl: string | null;
  imageUrl: string | null;
  removed: boolean;
}

export interface RedditCommentRow {
  author: string;
  body: string;
  score: number;
  parentId: string;
}

export function isRedditImportHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (REDDIT_HOSTS.has(h)) return true;
  return h.endsWith('.reddit.com');
}

/** Extract post id or share path from a normalized Reddit URL. */
export function parseRedditUrl(urlString: string): { postId: string } | { sharePath: string } | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  if (!isRedditImportHostname(url.hostname)) return null;

  if (url.hostname.replace(/^www\./, '') === 'redd.it') {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    return id ? { postId: id } : null;
  }

  const shareMatch = url.pathname.match(/^\/r\/[^/]+\/s\/([A-Za-z0-9]+)\/?$/i);
  if (shareMatch) {
    return { sharePath: url.pathname };
  }

  const commentsMatch = url.pathname.match(/\/comments\/([a-z0-9]+)/i);
  if (commentsMatch) {
    return { postId: commentsMatch[1]! };
  }

  return null;
}

export function buildRedditCommentsJsonUrl(postId: string): string {
  return `https://www.reddit.com/comments/${postId}.json?limit=20`;
}

export function redditCreditLabel(author: string, subreddit: string): string {
  const user = author.startsWith('u/') ? author : `u/${author}`;
  const sub = subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`;
  return `${user} on ${sub}`;
}

export function redditAuthorProfileUrl(author: string): string {
  const name = author.replace(/^\/?u\//i, '');
  return `https://www.reddit.com/user/${encodeURIComponent(name)}`;
}

function decodeRedditUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const decoded = raw.replace(/&amp;/g, '&').trim();
  return sanitizeHttpUrl(decoded);
}

function readPostListingPayload(json: unknown): Record<string, unknown> | null {
  if (!Array.isArray(json) || json.length < 1) return null;
  const listing = json[0] as { data?: { children?: unknown[] } };
  const child = listing.data?.children?.[0] as { data?: Record<string, unknown> } | undefined;
  return child?.data ?? null;
}

export function readCommentListing(json: unknown): RedditCommentRow[] {
  if (!Array.isArray(json) || json.length < 2) return [];
  const listing = json[1] as { data?: { children?: unknown[] } };
  const children = listing.data?.children ?? [];
  const rows: RedditCommentRow[] = [];
  for (const node of children) {
    const row = node as { kind?: string; data?: Record<string, unknown> };
    if (row.kind !== 't1' || !row.data) continue;
    const author = typeof row.data.author === 'string' ? row.data.author : '';
    const body = typeof row.data.body === 'string' ? row.data.body : '';
    const score = typeof row.data.score === 'number' ? row.data.score : 0;
    const parentId = typeof row.data.parent_id === 'string' ? row.data.parent_id : '';
    if (!author || !body || author === '[deleted]') continue;
    rows.push({ author, body, score, parentId });
  }
  return rows;
}

export function redditPostFromListingJson(
  json: unknown,
  fallbackPostId?: string,
): RedditPostContext | null {
  const data = readPostListingPayload(json);
  if (!data) return null;

  const postId =
    (typeof data.id === 'string' && data.id) || fallbackPostId || '';
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const selftext = typeof data.selftext === 'string' ? data.selftext : '';
  const author = typeof data.author === 'string' ? data.author : '';
  const subreddit = typeof data.subreddit === 'string' ? data.subreddit : '';
  const permalink = typeof data.permalink === 'string' ? data.permalink : '';
  const isSelf = data.is_self === true;
  const over18 = data.over_18 === true;
  const removedBy =
    typeof data.removed_by_category === 'string' ? data.removed_by_category : null;
  const removed =
    author === '[deleted]' ||
    Boolean(removedBy) ||
    data.removed === true ||
    data.removed_by === 'moderator';

  const urlField = typeof data.url === 'string' ? data.url : null;
  const urlOverridden =
    typeof data.url_overridden_by_dest === 'string' ? data.url_overridden_by_dest : null;
  const externalUrl = !isSelf ? decodeRedditUrl(urlOverridden ?? urlField) : null;

  let imageUrl: string | null = null;
  const preview = data.preview as { images?: { source?: { url?: string } }[] } | undefined;
  const previewUrl = preview?.images?.[0]?.source?.url;
  imageUrl = decodeRedditUrl(previewUrl);
  if (!imageUrl && urlField && !isSelf) {
    const maybeImage = decodeRedditUrl(urlField);
    if (maybeImage && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(maybeImage)) {
      imageUrl = maybeImage;
    }
  }

  const gallery = data.media_metadata as Record<string, { s?: { u?: string } }> | undefined;
  if (!imageUrl && gallery && typeof gallery === 'object') {
    for (const key of Object.keys(gallery)) {
      const u = gallery[key]?.s?.u;
      const decoded = decodeRedditUrl(u);
      if (decoded) {
        imageUrl = decoded;
        break;
      }
    }
  }

  const canonicalPostUrl = permalink
    ? `https://www.reddit.com${permalink.startsWith('/') ? permalink : `/${permalink}`}`
    : `https://www.reddit.com/comments/${postId}/`;

  return {
    postId,
    permalink,
    canonicalPostUrl,
    title,
    selftext,
    author,
    subreddit,
    isSelf,
    over18,
    externalUrl,
    imageUrl,
    removed,
  };
}

export function selectRecipeBodyText(
  post: RedditPostContext,
  comments: RedditCommentRow[],
): string {
  const candidates: string[] = [];
  if (post.selftext.trim()) candidates.push(post.selftext);

  const postFullname = `t3_${post.postId}`;
  const topLevel = comments.filter((c) => c.parentId === postFullname);
  const opComments = topLevel
    .filter((c) => c.author === post.author)
    .sort((a, b) => b.score - a.score);
  for (const c of opComments) candidates.push(c.body);

  const topComment = [...topLevel].sort((a, b) => b.score - a.score)[0];
  if (topComment && !opComments.includes(topComment)) {
    candidates.push(topComment.body);
  }

  for (const text of candidates) {
    if (recipeSignalsInText(text)) return text;
  }
  return candidates[0] ?? '';
}

export function isExternalRecipeLink(post: RedditPostContext): boolean {
  if (post.isSelf || !post.externalUrl) return false;
  try {
    const host = new URL(post.externalUrl).hostname.toLowerCase();
    if (isRedditImportHostname(host) || host.endsWith('.reddit.com')) return false;
    if (/^(i\.)?redd\.it$/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export function assertRedditPostImportable(post: RedditPostContext): void {
  if (post.removed || post.author === '[deleted]') {
    throw new RedditImportError(
      'REDDIT_DELETED',
      'That Reddit post was deleted or removed, so we cannot import a recipe from it.',
    );
  }
  if (post.over18) {
    throw new RedditImportError(
      'REDDIT_NSFW',
      'That Reddit post is marked NSFW. We cannot import recipes from NSFW posts.',
    );
  }
}

export function mergeRuleParsedRecipe(
  parsed: ReturnType<typeof parseRuleBasedRecipeFromText>,
  post: RedditPostContext,
): RecipeImportExtracted | null {
  if (!parsed) return null;
  const credit = redditCreditLabel(post.author, post.subreddit);
  return {
    ...parsed,
    prep_minutes: null,
    cook_minutes: null,
    source_url: post.canonicalPostUrl,
    source_type: 'reddit',
    social_author_name: credit,
    social_author_url: redditAuthorProfileUrl(post.author),
    image_url: post.imageUrl,
  };
}

export type FetchFn = typeof fetch;

export async function resolveRedditShareLink(
  shareUrl: string,
  fetchFn: FetchFn,
  userAgent: string,
): Promise<string | null> {
  let currentUrl = shareUrl;
  for (let hop = 0; hop <= RECIPE_FETCH_MAX_REDIRECTS; hop += 1) {
    const validated = validatePublicHttpFetchUrl(currentUrl);
    if (!validated.ok) return null;
    let response: Response;
    try {
      response = await fetchFn(validated.url.toString(), {
        redirect: 'manual',
        headers: { 'User-Agent': userAgent, Accept: 'text/html,*/*' },
      });
    } catch {
      return null;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      const next = resolveRedirectLocation(validated.url, location);
      if (!next) return null;
      currentUrl = next;
      continue;
    }
    if (response.status === 403 || response.status === 404) return null;
    return currentUrl;
  }
  return null;
}

export async function fetchRedditListingJson(
  postId: string,
  fetchFn: FetchFn,
  userAgent: string,
): Promise<unknown> {
  const url = buildRedditCommentsJsonUrl(postId);
  const validated = validatePublicHttpFetchUrl(url);
  if (!validated.ok) {
    throw new RedditImportError('REDDIT_BAD_LINK', 'That Reddit link is not valid.');
  }
  let response: Response;
  try {
    response = await fetchFn(validated.url.toString(), {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new RedditImportError(
      'REDDIT_BAD_LINK',
      'Could not reach Reddit right now. Try again in a moment.',
    );
  }
  if (response.status === 403 || response.status === 401) {
    throw new RedditImportError(
      'REDDIT_PRIVATE',
      'That Reddit post is private or unavailable.',
    );
  }
  if (!response.ok) {
    throw new RedditImportError(
      'REDDIT_BAD_LINK',
      'Could not read that Reddit post.',
    );
  }
  return (await response.json()) as unknown;
}

export async function resolveRedditPostIdFromUrl(
  normalizedUrl: string,
  fetchFn: FetchFn,
  userAgent: string,
): Promise<string> {
  const parsed = parseRedditUrl(normalizedUrl);
  if (!parsed) {
    throw new RedditImportError('REDDIT_BAD_LINK', 'Paste a valid Reddit post link.');
  }
  if ('postId' in parsed) return parsed.postId;
  const resolved = await resolveRedditShareLink(
    new URL(normalizedUrl).origin + parsed.sharePath,
    fetchFn,
    userAgent,
  );
  if (!resolved) {
    throw new RedditImportError('REDDIT_BAD_LINK', 'Could not open that Reddit share link.');
  }
  const fromResolved = parseRedditUrl(resolved);
  if (fromResolved && 'postId' in fromResolved) return fromResolved.postId;
  throw new RedditImportError('REDDIT_BAD_LINK', 'That Reddit share link did not resolve to a post.');
}
