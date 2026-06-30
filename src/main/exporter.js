'use strict';

const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { BrowserWindow } = require('electron');

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const THEMES = {
  dark: { bg: '#0d1117', fg: '#e6edf3', accent: '#7ee787' },
  light: { bg: '#ffffff', fg: '#1f2328', accent: '#1a7f37' },
};

/**
 * Build a standalone HTML document that renders the tree as monospace text.
 */
function renderHtml(text, opts = {}) {
  const theme = THEMES[opts.theme] || THEMES.dark;
  const title = opts.title ? escapeHtml(opts.title) : '';
  const header = title ? `<div class="title">${title}</div>` : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${theme.bg}; }
  body { display: inline-block; }
  .wrap { display: inline-block; padding: 28px 36px; background: ${theme.bg}; }
  .title {
    font: 600 16px -apple-system, "Segoe UI", system-ui, sans-serif;
    color: ${theme.accent};
    margin: 0 0 16px;
    white-space: nowrap;
  }
  pre {
    margin: 0;
    font-family: "SF Mono", "Cascadia Code", "Consolas", "Menlo", "DejaVu Sans Mono", monospace;
    font-size: 14px;
    line-height: 1.55;
    color: ${theme.fg};
    white-space: pre;
    tab-size: 4;
  }
  ${opts.paginate ? '@page { margin: 16mm; }' : ''}
</style>
</head>
<body>
  <div class="wrap">
    ${header}
    <pre>${escapeHtml(text)}</pre>
  </div>
</body>
</html>`;
}

/** Save the raw tree text to a .txt file. (No render window needed.) */
async function exportTxt(text, filePath) {
  await fs.writeFile(filePath, text, 'utf8');
  return filePath;
}

/**
 * A reusable off-screen renderer. A SINGLE hidden BrowserWindow is created and
 * reused for every export in a batch — creating multiple short-lived windows is
 * unreliable in some headless/GPU environments, while reusing one is stable.
 * Always call `dispose()` when finished.
 */
class TreeRenderer {
  constructor() {
    this._win = null;
    this._tmpFiles = [];
  }

  _ensureWindow() {
    if (this._win && !this._win.isDestroyed()) return this._win;
    this._win = new BrowserWindow({
      show: false,
      width: 1200,
      height: 800,
      webPreferences: { offscreen: false, sandbox: true },
    });
    return this._win;
  }

  async _load(html) {
    const win = this._ensureWindow();
    const tmpFile = path.join(os.tmpdir(), `ftg-${crypto.randomBytes(8).toString('hex')}.html`);
    await fs.writeFile(tmpFile, html, 'utf8');
    this._tmpFiles.push(tmpFile);
    // Chromium blocks top-level navigation to data: URLs, so load a real file.
    await win.loadFile(tmpFile);
    return win;
  }

  /** Render the tree to a PNG image sized to fit its content. */
  async toPng(text, filePath, opts = {}) {
    const win = await this._load(renderHtml(text, opts));
    const size = await win.webContents.executeJavaScript(
      `(() => {
        const el = document.querySelector('.wrap');
        const r = el.getBoundingClientRect();
        return { w: Math.ceil(r.width), h: Math.ceil(r.height) };
      })()`
    );
    const scale = Math.min(Math.max(opts.scale || 2, 1), 4);
    const w = Math.min(Math.max(size.w, 200), 8000);
    const h = Math.min(Math.max(size.h, 100), 16000);
    win.setContentSize(w, h);
    // Give the layout a tick to settle after the resize.
    await new Promise((r) => setTimeout(r, 120));
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
    const png = scale > 1 ? image.resize({ width: Math.round(w * scale) }).toPNG() : image.toPNG();
    await fs.writeFile(filePath, png);
    return filePath;
  }

  /** Render the tree to a paginated PDF. */
  async toPdf(text, filePath, opts = {}) {
    const win = await this._load(renderHtml(text, { ...opts, paginate: true }));
    const data = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'custom', top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 },
      pageSize: 'A4',
    });
    await fs.writeFile(filePath, data);
    return filePath;
  }

  async dispose() {
    if (this._win && !this._win.isDestroyed()) this._win.destroy();
    this._win = null;
    await Promise.all(
      this._tmpFiles.map((f) => fs.unlink(f).catch(() => {}))
    );
    this._tmpFiles = [];
  }
}

module.exports = { exportTxt, TreeRenderer, renderHtml };
