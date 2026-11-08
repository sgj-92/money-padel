# Vendored libraries

Shipped with the app rather than fetched from a CDN, so they work wherever
the app does and the tests use exactly what users get.

| File | Library | Licence | Used by |
|---|---|---|---|
| `html2canvas-1.4.1.min.js` | [html2canvas](https://html2canvas.hertzen.com) 1.4.1, from npm, unmodified | MIT (copyright header kept in the file) | `assets/js/ui/components/capture.js` — loaded only when someone captures a picture |
