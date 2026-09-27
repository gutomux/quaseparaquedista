/**
 * App-wide settings. Change values here instead of inside the logic or view.
 */
export const CONFIG = Object.freeze({
  /** Path to the glossary data, relative to index.html. */
  dataUrl: './data/glossary.json',
  /** Folder with one interface-text file per locale, e.g. i18n/pt_BR.json. */
  i18nPath: './i18n',
  /** Locales the app ships with. The first match with the browser wins. */
  supportedLocales: ['en_US', 'pt_BR'],
  /** Used when the browser language is not supported, and as the data fallback. */
  defaultLocale: 'en_US',
  /** Maximum number of suggestions shown under the search bar. */
  maxSuggestions: 8,
  /** Maximum number of "See also" links on a result card. */
  maxRelated: 4,
  /** Minimum query length before definitions are searched too. */
  minDefinitionQueryLength: 3,
  /** Where "Suggest an entry or correction" emails go. */
  contactEmail: 'gutoferreira1010@gmail.com',
});
