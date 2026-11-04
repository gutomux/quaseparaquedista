/**
 * Lists of boxes to tick (the travel guide's documents and checklist): each box is a real
 * checkbox in the page (<ul data-checklist="name">), and this remembers the ticks on the device,
 * so a trip can be prepared over several days. A "untick all" button
 * (data-checklist-reset="name") clears its list.
 *
 * Without storage (blocked, private window) the boxes still work; they just aren't remembered.
 */

/** Same "qp." prefix as the other choices the site remembers on the device. */
export const CHECKS_KEY = 'qp.checks';

/** The ticked box ids saved on the device, or none. */
export function loadChecks(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(CHECKS_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveChecks(storage, ticked) {
  try {
    storage?.setItem(CHECKS_KEY, JSON.stringify([...ticked].sort()));
  } catch {
    // Storage blocked: the ticks last until the page closes.
  }
}

function storageOf(root) {
  try {
    return root.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Ticks the remembered boxes and keeps the device's copy up to date. */
export function mountChecklists(root = document, storage = storageOf(root)) {
  const ticked = loadChecks(storage);
  const boxes = (list) => [...list.querySelectorAll('input[type="checkbox"]')];
  for (const list of root.querySelectorAll('[data-checklist]')) {
    for (const box of boxes(list)) {
      box.checked = ticked.has(box.id);
      box.addEventListener('change', () => {
        if (box.checked) ticked.add(box.id);
        else ticked.delete(box.id);
        saveChecks(storage, ticked);
      });
    }
  }
  for (const button of root.querySelectorAll('[data-checklist-reset]')) {
    button.addEventListener('click', () => {
      const list = root.querySelector(`[data-checklist="${button.dataset.checklistReset}"]`);
      if (!list) return;
      for (const box of boxes(list)) {
        box.checked = false;
        ticked.delete(box.id);
      }
      saveChecks(storage, ticked);
    });
  }
}
