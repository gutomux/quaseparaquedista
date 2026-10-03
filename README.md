# QuaseParaquedista.com.br

Free skydiving tools for people who have never jumped, students and experienced jumpers, in **English (en_US)** and **Brazilian Portuguese (pt_BR)**:

- **Welcome page** (`index.html`): who the site is for, a menu to open each tool, the Instagram profile [@quaseparaquedista](https://www.instagram.com/quaseparaquedista/) and the feedback button.
- **Glossary** (`glossary.html`): a searchable glossary of skydiving terms and acronyms.
- **Freefall simulator** (`freefall.html`): how body position changes a jumper's flight.
- **Training materials** (`materiais-instrucao.html`): the CBPq AFF handbook (`apostila-aff.html`) and emergency review (`revisao-emergencias-aff.html`) shown inside the page straight from the CBPq site (no copies are stored here), and videos of AFF levels I to VII (`aff-videos.html`).

In the glossary, type one letter and suggestions appear; pick one to see its definition, its name in the other language, and related entries.

No build step and no dependencies: plain HTML, CSS and JavaScript modules, ready for GitHub Pages.

## How languages work

- **Interface language is detected automatically** from the browser (`navigator.languages`). Portuguese browsers (pt-BR, pt-PT, pt) get pt_BR; everything else gets en_US.
- **Search always covers both languages.** A Portuguese reader can type "canopy" and an English reader can type "velame"; both find the same entry.
- **Suggestions show both languages**, the reader's first, each marked with a country flag: "Velame 🇧🇷 | Canopy 🇺🇸". Windows, which has no flag emoji, shows the locale codes instead: "Velame (pt_BR) | Canopy (en_US)". The result card is shown in the reader's language.
- Portuguese names follow Brazilian drop zone jargon (velame, pane, batedores, barrigueira, decolagem) and keep English where Brazilian jumpers use it (cutaway, flare, tracking, slider).
- Accents are optional when searching: "circulo de atencao" finds "Círculo de atenção".

To test the other language, change your browser's preferred language, or in Chrome DevTools open **More tools → Sensors** and set **Location → Locale**.

## Project structure

```
index.html            Welcome page: intro, tool menu, Instagram link, feedback
css/home.css          Styles for the welcome page
js/home.js            Welcome page entry point: text, feedback link, tool menu
js/carousel.js        Welcome page photo carousel (changes every 6 seconds)
images/carousel/      Carousel photos (1.jpg, 2.jpg, 3.jpg), from the Instagram post
glossary.html         Glossary page markup only; text comes from i18n files via data-i18n attributes
css/styles.css        Shared styling for all pages, with light and dark themes
data/glossary.json    All glossary entries, with one translation block per locale
i18n/en_US.json       Interface text in English
i18n/pt_BR.json       Interface text in Brazilian Portuguese
js/config.js          Settings: paths, supported locales, default locale, limits
js/i18n.js            Locale detection, loading interface text, translating keys
js/data.js            Loads, validates and localizes glossary.json
js/search.js          Search logic across all locales: pure functions, no DOM
js/view.js            View: all DOM rendering and event listening
js/calculators.js     Entry calculators (wing loading): pure functions, no DOM
js/feedback.js        Checks the suggestion/correction form link
js/controller.js      Connects search logic and view, holds UI state
js/main.js            Glossary entry point: detects locale, loads files, starts the app
freefall.html         Freefall body-position simulator page
css/freefall.css      Styles for the simulator (reuses the color tokens in styles.css)
js/freefall/sim.js    Simulator rules: pose in, drift/fall rate/turn out. Pure functions, no DOM
js/freefall/figure.js The SVG jumper: a simple 3D body turned by the heading and drawn from the side or above
js/freefall/air.js    Air dots that flow around the jumper's outline instead of through it. Pure functions, no DOM
js/freefall/view.js   Simulator scene, air dots, compass, readouts and buttons
js/freefall/main.js   Simulator entry point and animation loop
materiais-instrucao.html  Training materials list
apostila-aff.html     CBPq AFF handbook, embedded from the CBPq site
revisao-emergencias-aff.html  CBPq AFF emergency review, embedded from the CBPq site
aff-videos.html       YouTube videos of AFF levels I to VII
css/materials.css     Styles for the training material pages
js/page.js            Entry point for those pages: text, and the PDF embed when the page has one
js/pdf-embed.js       Frames a PDF from its original site: directly where the browser can show PDFs,
                      through Google's document viewer on Android, which can't
tests/                Unit tests for search, data validation, i18n and the simulator
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

## Calculators on entries

An entry can show a calculator under its definition by adding a `calculator` field in `data/glossary.json`. Today the only one is `"wing-loading"`, used by *Wing loading / Carga alar*:

```
wing loading = (body weight kg + equipment weight kg) × 2.2 ÷ canopy size (sq ft)
```

The entry also shows the CBPq limits per category and highlights the lowest category allowed for the user's result. Those limits are defined once, in `WING_LOADING_LIMITS` in `js/calculators.js`; the table and the category match both read from it, so update the numbers there if CBPq changes them.

The math lives in `js/calculators.js` (tested in `tests/calculators.test.js`), the fields are drawn by `view.js`, and all labels and messages are under `calculator.wingLoading` in the i18n files. Numbers accept a comma or a dot as the decimal mark, and the result is shown in the reader's number format.

## Editing interface text

Change the wording in `i18n/en_US.json` or `i18n/pt_BR.json`. Both files must have the same keys. Text can use `{placeholders}`, and counts use `one` / `other` forms, which are picked with `Intl.PluralRules`.

## Adding a language

1. Copy `i18n/en_US.json` to `i18n/<locale>.json` (for example `es_ES.json`) and translate it. Add the new language name under `languages` in every i18n file.
2. Add a `<locale>` block to every entry in `data/glossary.json`.
3. Add the locale to `supportedLocales` in `js/config.js` and to `LOCALES` / `SUPPORTED` in the tests.
4. Run `npm test`; it lists any entry or key that is missing.

## Freefall simulator

`freefall.html`, opened from the menu on the welcome page, shows a cartoon jumper falling belly to earth, seen from the side. Air dots rise past the jumper: the faster they rise, the faster the fall. Toggle buttons change the body position, and a caption explains each effect:

| Button | Effect |
|---|---|
| Stretch legs / Pull arms back | Moves forward |
| Tuck legs / Reach arms forward | Moves backward |
| Arch more | Falls faster |
| De-arch | Falls slower and rocks slightly |
| Turn left / right | Dips that shoulder, rolls toward it and turns that way |

The jumper is a simple 3D body, so turns really rotate it: facing you, you see both arms and legs spread out. The compass in the corner shows the same body from above. There is no speed gauge; the air dots show the fall rate. The dots can't pass through the jumper: they hit the body's outline, slide along it and come off its edges, turning blue for a moment, so you can see which way each body position pushes the air.

Buttons in the same group are opposites, so only one can be on. Effects add up: stretched legs with arms pulled back moves forward faster, and stretched legs with arms forward cancel out.

The rules live in `js/freefall/sim.js`: `CONTROLS` lists the buttons and `EFFECT` holds the strengths (drift, fall rate change, turn speed). Change them there and run `npm test`. Page text is under `freefall` in the i18n files. If the visitor's system asks for reduced motion, the animation starts paused.

## Suggestions and corrections

The "Suggest an entry or correction" button opens a Google Form in a new tab. Visitors don't need any account, and every response lands in the form's Google Sheet.

To connect your form, paste its link into `feedbackFormUrl` in `js/config.js` (use the link from **Send → link icon**, e.g. `https://forms.gle/...`). While the setting is empty, or isn't a Google Forms link, the button stays hidden. The button text lives under `feedback` in each i18n file.

## Publishing a change

GitHub Pages lets browsers keep each file for up to 10 minutes. Without care, a visitor can get a new page with an old stylesheet, which breaks the layout. To prevent that, every page links its stylesheets and main script with a version, for example `css/home.css?v=2026-10-02`. **When you change any CSS or JavaScript, update that version in all three HTML pages** (search for `?v=`), so browsers fetch the new files.

## Running locally

Browsers block `fetch()` for files opened directly from disk, so serve the folder instead of double-clicking the HTML files:

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

## Checking embedded resources

The training material pages embed resources from other sites: the CBPq PDFs and the YouTube videos. If one is moved or removed, its page breaks without any change here, so they are checked online:

```
npm run test:links
```

The checks read the addresses from the HTML pages, so new resources are covered automatically. For each PDF: the address answers, it is served as a PDF and starts like one, and Google's viewer (used on Android) answers for it. For each video: it is public and embedding is allowed.

**Before every commit**, a git hook (`.githooks/pre-commit`) runs `npm test` and then `npm run test:links`; if either fails, the commit stops and lists what failed. The hook is switched on by `npm install` (the `prepare` script runs `git config core.hooksPath .githooks`); in a fresh copy of the repository, run `npm install` once. To commit anyway, for example offline or while a site is briefly down, use `git commit --no-verify`.

## Deploying to GitHub Pages

1. Upload the whole folder to your repository, keeping the structure above (`index.html` at the root).
2. In **Settings → Pages**, deploy from the `main` branch, `/ (root)` folder.
3. Every change you push is republished in a minute or two.

## Credits

Based on the USPA Instructional Rating Manual 2026, the CBPq AFF student handbook (2023) and general skydiving knowledge.
