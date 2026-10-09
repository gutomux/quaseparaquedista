/**
 * Share a link: copy it (so it can be pasted anywhere later) and open the device's share
 * menu where there is one. Used by the glossary's "Compartilhar" button.
 *
 * Both browser features have limits, so each has a fallback:
 * - navigator.clipboard and navigator.share only exist on secure (https) pages; on http (e.g.
 *   testing over the local network) copying falls back to the older document.execCommand('copy').
 * - The share menu needs the tap that started it, so it is opened in the same moment as the copy.
 *   The copy starts first: once the share menu opens, the page loses focus and the clipboard
 *   refuses to write.
 * - A share menu that is closed, or that fails, is not an error: the link is already copied.
 */

/** Copy text with the older method: select it in a hidden text box and run "copy". */
function legacyCopy(text, doc) {
  const box = doc.createElement('textarea');
  box.value = text;
  box.setAttribute('readonly', '');
  box.style.position = 'fixed';
  box.style.opacity = '0';
  doc.body.append(box);
  box.select();
  let ok = false;
  try {
    ok = doc.execCommand('copy');
  } catch {
    ok = false;
  }
  box.remove();
  return ok;
}

/** Copy text to the clipboard. @returns {Promise<boolean>} whether it worked. */
export async function copyText(text, { nav = navigator, doc = document } = {}) {
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      // Blocked (permissions, focus): try the older way below.
    }
  }
  return legacyCopy(text, doc);
}

/**
 * Copy the link and open the share menu.
 * The two are reported separately: the copy is done in a moment, while the share menu only
 * finishes when the person closes it, so "copied" can be shown right away.
 * @param {{url: string, title: string}} link
 * @returns {{copied: Promise<boolean>, shared: Promise<boolean>}}
 */
export function shareLink({ url, title }, { nav = navigator, doc = document } = {}) {
  // Start both right away, while the tap still counts as the user's action: copy first (it
  // needs the page focused), then the share menu.
  const copied = copyText(url, { nav, doc });
  const shared = typeof nav.share === 'function'
    ? nav.share({ title, url }).then(() => true, () => false)
    : Promise.resolve(false);
  return { copied, shared };
}
