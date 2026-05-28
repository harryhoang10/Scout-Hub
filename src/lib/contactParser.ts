export type ContactSource = 'regex' | 'ai' | 'api' | 'fallback';

export interface NormalizedContact {
  phone: string;
  email: string;
  bioLink: string;
  contactSource: ContactSource;
  contactWarnings: string[];
}

const NOT_AVAILABLE_VALUES = new Set(['', 'n/a', 'na', 'none', 'null', 'undefined', '-', '--']);
const VIETNAM_MOBILE_REGEX = /^0[235789]\d{8}$/;
const PHONE_LABEL_REGEX = /(?:zalo|s[đd]t|phone|call|tel|lh|li[eê]n\s*h[eệ]|hotline|whatsapp|wa)\s*[:：.\-–—]?\s*/i;
const SPECIAL_ZERO_REGEX = /[⓪０ÓÒỌỎÕÔỐỒỔỖỘƠỚỜỞỠỢ]/g;
const LETTER_ZERO_REGEX = /[Oo]/g;
const PHONE_SEPARATOR_CLASS = String.raw`[\s().,\-–—_/\\|:：\[\]{}]`;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>]*)?/gi;

function cleanText(value?: string | number | null) {
  if (value === undefined || value === null) return '';
  return String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function isAvailable(value?: string | number | null) {
  const normalized = cleanText(value).toLowerCase();
  return !NOT_AVAILABLE_VALUES.has(normalized);
}

function deobfuscateEmailText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s*(?:\(|\[|\{)\s*(?:a\s*c[oò]ng|acong|c[oò]ng|at)\s*(?:\)|\]|\})\s*/gi, '@')
    .replace(/\s+(?:a\s*c[oò]ng|acong|c[oò]ng|at)\s+/gi, '@')
    .replace(/\s*(?:\(|\[|\{)\s*(?:chấm|cham|dot|d[oấ]u\s*chấm)\s*(?:\)|\]|\})\s*/gi, '.')
    .replace(/\s+(?:chấm|cham|dot|d[oấ]u\s*chấm)\s+/gi, '.')
    .replace(/\s*@\s*/g, '@')
    .replace(/\s*\.\s*/g, '.')
    .replace(/＠/g, '@');
}

function normalizeEmail(value?: string | null) {
  const text = cleanText(value).toLowerCase();
  const normalizedText = deobfuscateEmailText(text);
  const match = normalizedText.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0].replace(/[.,;:]+$/, '') : '';
}

function normalizePhoneCandidate(candidate: string, allowMissingLeadingZero = false, allowLetterZero = false) {
  let normalized = cleanText(candidate)
    .replace(/kh[oô]ng/gi, '0')
    .replace(/zero/gi, '0')
    .replace(SPECIAL_ZERO_REGEX, '0');

  if (allowLetterZero) {
    normalized = normalized.replace(LETTER_ZERO_REGEX, '0');
  }

  let digits = normalized.replace(/[^\d]/g, '');
  if (digits.startsWith('0084')) digits = `0${digits.slice(4)}`;
  if (digits.startsWith('84')) digits = `0${digits.slice(2)}`;
  if (allowMissingLeadingZero && /^[235789]\d{8}$/.test(digits)) digits = `0${digits}`;

  if (digits.length !== 10) return '';

  const phone = digits;
  if (!VIETNAM_MOBILE_REGEX.test(phone)) return '';
  if (/^(\d)\1{9}$/.test(phone)) return '';
  return phone;
}

function stripPhoneNoise(text: string) {
  return text
    .replace(EMAIL_PATTERN, ' ')
    .replace(URL_PATTERN, match => (/[a-z]/i.test(match) ? ' ' : match));
}

function getPhoneLikeSpans(text: string) {
  const spans: { value: string; labeled: boolean }[] = [];

  const labeledMatches = [...text.matchAll(new RegExp(`${PHONE_LABEL_REGEX.source}([+0-9⓪０OoÓÒỌỎÕÔỐỒỔỖỘƠỚỜỞỠỢ\\s().,\\-–—_/\\\\|:：\\[\\]{}]{9,36})`, 'gi'))];
  labeledMatches.forEach(match => {
    if (match[1]) spans.unshift({ value: match[1], labeled: true });
  });

  const directPhoneRegex = new RegExp(
    `(?:^|[^\\d@a-z])((?:(?:\\+?84|0084)|0)${PHONE_SEPARATOR_CLASS}*[235789](?:${PHONE_SEPARATOR_CLASS}*\\d){8})(?!\\d)`,
    'gi',
  );
  [...text.matchAll(directPhoneRegex)].forEach(match => {
    if (match[1]) spans.push({ value: match[1], labeled: false });
  });

  const missingZeroDelimitedRegex = new RegExp(
    `(?:^|[^\\d@a-z])([235789]\\d{1,3}(?:${PHONE_SEPARATOR_CLASS}+\\d{1,4}){2,})(?!\\d)`,
    'gi',
  );
  [...text.matchAll(missingZeroDelimitedRegex)].forEach(match => {
    if (match[1]) spans.push({ value: match[1], labeled: true });
  });

  return spans;
}

function normalizePhone(value?: string | number | null) {
  const text = stripPhoneNoise(cleanText(value));
  if (!text) return '';

  for (const span of getPhoneLikeSpans(text)) {
    const phone = normalizePhoneCandidate(span.value, span.labeled, span.labeled);
    if (phone) return phone;
  }

  return '';
}

function normalizeUrl(value?: string | null) {
  const text = cleanText(value);
  if (!text) return '';

  const match = text.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>]*)?/i);
  if (!match) return '';

  const rawUrl = match[0].replace(/[),.;:]+$/, '');
  const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  try {
    const url = new URL(withProtocol);
    const trackers = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'igshid', '_r', 'utm_content', 'ttclid'];
    trackers.forEach(t => url.searchParams.delete(t));
    return url.toString();
  } catch {
    return withProtocol.split('?')[0];
  }
}

function extractEmail(text: string) {
  return normalizeEmail(text);
}

function extractPhone(text: string) {
  return normalizePhone(text);
}

function extractBioLink(text: string) {
  const urls = [
    ...text.matchAll(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s"'<>]*)?/gi),
  ]
    .filter(match => {
      const index = match.index || 0;
      return text[index - 1] !== '@';
    })
    .map(match => normalizeUrl(match[0]));

  return urls.find(url => {
    if (!url) return false;
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      return !['tiktok.com', 'facebook.com', 'fb.com', 'instagram.com'].includes(hostname);
    } catch {
      return false;
    }
  }) || '';
}

export function normalizeContact(input: {
  phone?: string | number | null;
  email?: string | null;
  bioLink?: string | null;
  text?: string | null;
  source?: ContactSource;
}): NormalizedContact {
  const text = cleanText(input.text);
  const warnings: string[] = [];

  const phone =
    normalizePhone(input.phone) ||
    extractPhone(text);

  const email =
    normalizeEmail(input.email) ||
    extractEmail(text);

  const bioLink =
    normalizeUrl(input.bioLink) ||
    extractBioLink(text);

  if (isAvailable(input.phone) && !phone) warnings.push('Không chuẩn hóa được số điện thoại nguồn.');
  if (isAvailable(input.email) && !email) warnings.push('Không chuẩn hóa được email nguồn.');
  if (isAvailable(input.bioLink) && !bioLink) warnings.push('Không chuẩn hóa được link bio nguồn.');

  return {
    phone,
    email,
    bioLink,
    contactSource: input.source || 'regex',
    contactWarnings: warnings,
  };
}
