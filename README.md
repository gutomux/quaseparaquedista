# Skydiving Glossary

A single-page, searchable glossary of skydiving terms and acronyms in **English (en_US)** and **Brazilian Portuguese (pt_BR)**. Type one letter and suggestions appear; pick one to see its definition, its name in the other language, and related entries.

No build step and no dependencies: plain HTML, CSS and JavaScript modules, ready for GitHub Pages.

## How languages work

- **Interface language is detected automatically** from the browser (`navigator.languages`). Portuguese browsers (pt-BR, pt-PT, pt) get pt_BR; everything else gets en_US.
- **Search always covers both languages.** A Portuguese reader can type "canopy" and an English reader can type "velame"; both find the same entry.
- **Results are shown in the reader's language.** When a suggestion matched through the other language, it says so (for example "Em inglês: Canopy").
- Portuguese names follow Brazilian drop zone jargon (velame, pane, batedores, barrigueira, decolagem) and keep English where Brazilian jumpers use it (cutaway, flare, tracking, slider).
- Accents are optional when searching: "circulo de atencao" finds "Círculo de atenção".

To test the other language, change your browser's preferred language, or in Chrome DevTools open **More tools → Sensors** and set **Location → Locale**.

## Project structure

```
index.html            Page markup only; text comes from i18n files via data-i18n attributes
css/styles.css        All styling, with light and dark themes
data/glossary.json    All glossary entries, with one translation block per locale
i18n/en_US.json       Interface text in English
i18n/pt_BR.json       Interface text in Brazilian Portuguese
js/config.js          Settings: paths, supported locales, default locale, limits
js/i18n.js            Locale detection, loading interface text, translating keys
js/data.js            Loads, validates and localizes glossary.json
js/search.js          Search logic across all locales: pure functions, no DOM
js/view.js            View: all DOM rendering and event listening
js/controller.js      Connects search logic and view, holds UI state
js/main.js            Entry point: detects locale, loads files, starts the app
tests/                Unit tests for search, data validation and i18n
```

The layers only talk in one direction: `main` wires everything up, the `controller` asks `search.js` for results and tells `view.js` what to show, and the view reports user actions back through callbacks. `search.js`, `data.js` and `i18n.js` never touch the page, which is what makes them testable in Node.

## Editing glossary entries

Edit `data/glossary.json`. Every entry needs a block for each locale:

```json
{
  "id": "term-canopy",
  "type": "term",
  "translations": {
    "en_US": {
      "term": "Canopy",
      "definition": "The parachute wing. Main canopy is used normally; reserve for emergencies.",
      "aliases": ["Canopy"]
    },
    "pt_BR": {
      "term": "Velame",
      "definition": "A asa do paraquedas. O principal é usado normalmente; o reserva, em emergências.",
      "aliases": ["Velame", "Canopy"]
    }
  }
}
```

- `id` must be unique. Use `acronym-...` or `term-...` plus the English term in lowercase with dashes.
- `type` is `"acronym"` or `"term"`.
- Acronyms also need an `expansion` in every locale (in pt_BR, the English expansion with the Portuguese meaning in parentheses).
- `aliases` lists every spelling people might search for in that language, including local jargon.

## Editing interface text

Change the wording in `i18n/en_US.json` or `i18n/pt_BR.json`. Both files must have the same keys. Text can use `{placeholders}`, and counts use `one` / `other` forms, which are picked with `Intl.PluralRules`.

## Adding a language

1. Copy `i18n/en_US.json` to `i18n/<locale>.json` (for example `es_ES.json`) and translate it. Add the new language name under `languages` in every i18n file.
2. Add a `<locale>` block to every entry in `data/glossary.json`.
3. Add the locale to `supportedLocales` in `js/config.js` and to `LOCALES` / `SUPPORTED` in the tests.
4. Run `npm test`; it lists any entry or key that is missing.

## Running locally

Browsers block `fetch()` for files opened directly from disk, so serve the folder instead of double-clicking `index.html`:

```
npm start                     # needs Node.js; opens on http://localhost:8080
# or
python3 -m http.server 8080   # no Node.js needed
```

## Tests

```
npm test
```

Uses Node's built-in test runner (Node 18 or newer), so there is nothing to install. The tests check that every entry has both languages, that both i18n files have the same keys, and that search works across languages.

## Deploying to GitHub Pages

1. Upload the whole folder to your repository, keeping the structure above (`index.html` at the root).
2. In **Settings → Pages**, deploy from the `main` branch, `/ (root)` folder.
3. Every change you push is republished in a minute or two.

## Credits

Based on the USPA Instructional Rating Manual 2026 and general skydiving knowledge. Rules and numbers follow USPA norms and vary by country and drop zone.
