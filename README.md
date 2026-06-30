# File Tree Generator

A beautiful cross-platform desktop tool to generate the file tree of any folder and export it as **TXT**, **PNG**, or **PDF**.

Built with [Electron](https://www.electronjs.org/). Ships as a Windows `.exe`, a macOS `.dmg`, and a Linux `AppImage`/`.deb` — and runs anywhere from source.

---

## Features

- **Pick a folder** with a native dialog and instantly preview its tree.
- **Live preview** that re-renders as you change options.
- **Export** to TXT, PNG, and/or PDF in one click, into a folder you choose.
- **Customizable output:**
  - Unicode (`├──`) or ASCII (`|--`) tree style
  - Max depth limit
  - Folders-first sorting
  - Show / hide hidden dotfiles
  - Show file sizes (with a total-size summary)
  - Trailing slash on folders
- **Ignore manager** — add folders/files to skip as removable tags: type a name or
  wildcard pattern (`*` / `?`) and press Enter, pick **“Ignore a folder…”** from a
  native dialog, or one-click quick-add presets (`node_modules`, `.git`, `dist`, `*.log`, …).
- **Folder & file counts** shown at a glance.
- **Copy to clipboard** for quick pasting into READMEs or issues.
- **Light / dark theme** for the rendered PNG/PDF.
- **Ambient background image** with a dimmed overlay and frosted panels — decorative, never at the expense of readability.
- Safe by design: `contextIsolation` on, no `nodeIntegration`, strict CSP.

---

## Run from source (any OS)

Requires [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm start          # launch the app
npm run dev        # launch with DevTools open
```

## License

MIT
