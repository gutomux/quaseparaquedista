/**
 * Feedback link helpers. No DOM access.
 */

const ALLOWED_PREFIXES = ['https://docs.google.com/forms/', 'https://forms.gle/'];

/**
 * Check that a feedback URL is a Google Forms link, so a typo in config.js
 * hides the button instead of sending visitors somewhere unexpected.
 * @param {string} url
 * @returns {boolean}
 */
export function isFeedbackFormUrl(url) {
  return typeof url === 'string' && ALLOWED_PREFIXES.some((prefix) => url.trim().startsWith(prefix));
}
