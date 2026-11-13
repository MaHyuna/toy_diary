# Local print dependencies

These browser distributions are copied without modification from the versions
pinned in the root package-lock.json. They load only when an export needs them.
No CDN or remote font is required at runtime.

- opentype.js: dist/opentype.min.js (font outlines)
- jspdf: dist/jspdf.umd.min.js (PDF container)
- svg2pdf.js: dist/svg2pdf.umd.min.js (vector drawing)

Each package's license is included alongside its distribution. Korean font
licenses are in ../../fonts. To update, run npm install and recopy these exact
distribution paths and the packages' LICENSE files; run the browser export test.
