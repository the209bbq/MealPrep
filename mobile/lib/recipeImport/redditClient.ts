import { normalizeImportUrl, classifyImportUrlForClient } from './urlClassificationClient';
import type { RecipeImportExtractedDto } from './types';

const REDDIT_URL_RE = /https?:\/\/(?:www\.|old\.|m\.)?reddit\.com\/[^\s]+|https?:\/\/redd\.it\/[^\s]+/gi;

const POSTED_BY_RE = /posted\s+by\s+(u\/[A-Za-z0-9_-]+)/i;
const USER_MENTION_RE = /\bu\/([A-Za-z0-9_-]+)\b/i;

export function isRedditImportUrl(urlString: string): boolean {
  const normalized = normalizeImportUrl(urlString);
  if (!normalized) return false;
  return classifyImportUrlForClient(normalized) === 'reddit';
}

export function findRedditUrlInText(text: string): string | null {
  const match = text.match(REDDIT_URL_RE);
  if (!match?.[0]) return null;
  const normalized = normalizeImportUrl(match[0].replace(/[)\]"']+$/, ''));
  return normalized && isRedditImportUrl(normalized) ? normalized : null;
}

export function stripRedditUrlsFromText(text: string): string {
  return text.replace(REDDIT_URL_RE, ' ').replace(/\s+/g, ' ').trim();
}

export function parseSubredditFromRedditUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    const match = url.pathname.match(/\/r\/([^/]+)/i);
    return match?.[1] ? match[1] : null;
  } catch {
    return null;
  }
}

export function parseAuthorFromRecipeText(text: string): string | null {
  const posted = POSTED_BY_RE.exec(text);
  if (posted?.[1]) return posted[1].replace(/^u\//i, '');
  const mention = USER_MENTION_RE.exec(text);
  return mention?.[1] ?? null;
}

export function buildRedditCreditLabel(subreddit: string, author: string | null): string {
  const sub = subreddit.startsWith('r/') ? subreddit : `r/${subreddit}`;
  if (author) {
    const user = author.startsWith('u/') ? author : `u/${author}`;
    return `Recipe from ${user} · ${sub}`;
  }
  return `From ${sub}`;
}

export interface RedditImportContext {
  postUrl: string;
  subreddit: string;
  author: string | null;
}

export function resolveRedditImportContext(
  rawInput: string,
  rememberedPostUrl: string | null,
): RedditImportContext | null {
  const fromInput = findRedditUrlInText(rawInput);
  const postUrl = fromInput ?? rememberedPostUrl;
  if (!postUrl || !isRedditImportUrl(postUrl)) return null;
  const subreddit = parseSubredditFromRedditUrl(postUrl);
  if (!subreddit) return null;
  const author = parseAuthorFromRecipeText(rawInput);
  return { postUrl, subreddit, author };
}

export function applyRedditCreditToImport(
  recipe: RecipeImportExtractedDto,
  context: RedditImportContext,
): RecipeImportExtractedDto {
  const credit = buildRedditCreditLabel(context.subreddit, context.author);
  const authorProfile = context.author
    ? `https://www.reddit.com/user/${encodeURIComponent(context.author)}`
    : null;
  return {
    ...recipe,
    source_type: 'reddit',
    source_url: context.postUrl,
    social_author_name: credit,
    social_author_url: authorProfile,
  };
}
