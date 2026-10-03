/**
 * Shows a PDF that stays on its owner's site (CBPq) inside the page, without hosting a copy.
 *
 * - Browsers with a built-in PDF reader (computers, iPhone) frame the original file directly.
 * - Browsers without one (Chrome and Samsung Internet on Android) would only offer a download,
 *   so they frame Google's document viewer, which reads the file from the original address.
 *
 * Reading the file with PDF.js isn't possible: the owner's server doesn't allow other sites
 * to read its files (no CORS header), and the browser blocks it.
 */

const GOOGLE_VIEWER = 'https://docs.google.com/viewer';
/** Ask built-in readers to start without the thumbnail sidebar, fitted to the width. */
const READER_OPTIONS = '#navpanes=0&view=FitH';
/** Google's viewer sometimes comes back blank; if it hasn't loaded by then, try once more. */
const RETRY_AFTER_MS = 8000;

/** Address to frame for a PDF, depending on whether the browser can show PDFs itself. */
export function embedUrl(pdfUrl, canShowPdf) {
  return canShowPdf ? pdfUrl + READER_OPTIONS : `${GOOGLE_VIEWER}?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
}

/**
 * @param {HTMLElement} root Element with data-pdf="https://...".
 * @param {string} title Accessible name for the frame, e.g. the page heading.
 */
export function mountPdfEmbed(root, title) {
  const canShowPdf = navigator.pdfViewerEnabled === true;
  const frame = document.createElement('iframe');
  frame.className = 'pdf-frame';
  frame.title = title;
  frame.src = embedUrl(root.dataset.pdf, canShowPdf);
  root.replaceChildren(frame);

  if (!canShowPdf) {
    let loaded = false;
    frame.addEventListener('load', () => { loaded = true; }, { once: true });
    setTimeout(() => {
      if (!loaded) frame.src = embedUrl(root.dataset.pdf, false);
    }, RETRY_AFTER_MS);
  }
}
