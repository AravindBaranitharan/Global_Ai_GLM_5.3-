import '@testing-library/jest-dom/vitest'

// jsdom gaps
Element.prototype.scrollTo = function () {}
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: /min-width/.test(query), media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  }) as MediaQueryList
}
