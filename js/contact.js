/**
 * Builds the "Suggest an entry or correction" email link. No DOM access.
 */

/**
 * Create a mailto: link with an encoded subject and body.
 * @param {string} email Recipient address.
 * @param {object} [fields]
 * @param {string} [fields.subject]
 * @param {string} [fields.body] Plain text; line breaks are kept.
 * @returns {string}
 */
export function buildMailto(email, { subject = '', body = '' } = {}) {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}${params.length ? `?${params.join('&')}` : ''}`;
}
