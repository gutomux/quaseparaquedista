/**
 * The USPA newsletter page shows the latest "Skydiver Update" issue. Which one that is comes
 * from data/uspa-update.json, kept current by scripts/update-uspa-newsletter.mjs.
 */

/** "2026-05" as the reader says it: "May 2026" / "maio de 2026". */
export function issueName(issue, locale) {
  const [year, month] = issue.split('-').map(Number);
  return new Intl.DateTimeFormat(locale.replace('_', '-'), { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Fill the page with the latest issue: the frame (root gets data-pdf), the links to the file
 * ([data-latest-pdf]) and its name ([data-latest-issue]).
 * @returns {Promise<boolean>} false if the issue couldn't be loaded; the archive link still works.
 */
export async function loadLatestIssue(root, locale, fetchFn = fetch) {
  try {
    const response = await fetchFn(root.dataset.pdfLatest, { cache: 'no-cache' });
    if (!response.ok) return false;
    const { issue, pdf } = await response.json();
    root.dataset.pdf = pdf;
    document.querySelectorAll('[data-latest-pdf]').forEach((link) => { link.href = pdf; });
    document.querySelectorAll('[data-latest-issue]').forEach((node) => { node.textContent = issueName(issue, locale); });
    return true;
  } catch {
    return false;
  }
}
