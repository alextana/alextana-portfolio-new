<img src="assets/icon.svg" width="64" height="64" alt="">

# alextana

Created in [T3 Code](https://t3.codes).

## `cv/`

My CV as a single static HTML page.

- Edit content in `cv/index.html`, styles in `cv/styles.css` (Markdown copy in `cv/cv.md`).
- Open `cv/index.html` in a browser to preview.
- Export to PDF via the browser's **Print → Save as PDF** (A4 print styles included).

## `www/`

Portfolio site built with [Astro](https://astro.build), based on the CV.

```sh
cd www
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # output in www/dist
```
