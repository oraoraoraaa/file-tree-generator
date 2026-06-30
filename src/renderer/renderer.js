'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  rootDir: null,
  outputDir: null,
  text: '',
  ignore: ['node_modules', '.git', '.DS_Store', 'dist', 'build'],
};

const els = {
  pickFolder: $('pickFolder'),
  folderPath: $('folderPath'),
  pickOutput: $('pickOutput'),
  outputPath: $('outputPath'),
  exportBtn: $('exportBtn'),
  copyBtn: $('copyBtn'),
  treeOutput: $('treeOutput'),
  statDirs: $('statDirs'),
  statFiles: $('statFiles'),
  statSize: $('statSize'),
  statSizeWrap: $('statSizeWrap'),
  toast: $('toast'),
  style: $('style'),
  maxDepth: $('maxDepth'),
  foldersFirst: $('foldersFirst'),
  showHidden: $('showHidden'),
  showSizes: $('showSizes'),
  trailingSlash: $('trailingSlash'),
  ignoreInput: $('ignoreInput'),
  ignoreAdd: $('ignoreAdd'),
  ignoreAddFolder: $('ignoreAddFolder'),
  ignoreTags: $('ignoreTags'),
  ignoreClear: $('ignoreClear'),
  baseName: $('baseName'),
  exportTheme: $('exportTheme'),
  preview: document.querySelector('.preview'),
};

function gatherOptions() {
  return {
    style: els.style.value,
    maxDepth: parseInt(els.maxDepth.value, 10) || 0,
    foldersFirst: els.foldersFirst.checked,
    showHidden: els.showHidden.checked,
    showSizes: els.showSizes.checked,
    trailingSlash: els.trailingSlash.checked,
    ignore: state.ignore.slice(),
  };
}

function selectedFormats() {
  return Array.from(document.querySelectorAll('.fmt:checked')).map((c) => c.value);
}

let toastTimer = null;
function toast(message, type = '') {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.className = `toast show ${type}`;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    setTimeout(() => { els.toast.hidden = true; }, 250);
  }, 3200);
}

function updateExportEnabled() {
  els.exportBtn.disabled = !(state.text && state.outputDir && selectedFormats().length > 0);
}

async function regenerate() {
  if (!state.rootDir) return;
  els.preview.classList.add('is-loading');
  try {
    const res = await window.api.generateTree(state.rootDir, gatherOptions());
    if (res.error) {
      toast(res.error, 'error');
      return;
    }
    state.text = res.text;
    els.treeOutput.textContent = res.text;
    els.statDirs.textContent = res.stats.dirs.toLocaleString();
    els.statFiles.textContent = res.stats.files.toLocaleString();
    if (els.showSizes.checked) {
      els.statSizeWrap.hidden = false;
      els.statSize.textContent = formatSize(res.stats.bytes);
    } else {
      els.statSizeWrap.hidden = true;
    }
    if (res.stats.truncated) {
      toast('Tree is very large — output was truncated.', 'error');
    }
    els.copyBtn.disabled = false;
    updateExportEnabled();
  } catch (err) {
    toast(`Failed to read folder: ${err.message}`, 'error');
  } finally {
    els.preview.classList.remove('is-loading');
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// Debounce option changes so rapid toggling doesn't thrash the filesystem.
let debounce = null;
function scheduleRegen() {
  clearTimeout(debounce);
  debounce = setTimeout(regenerate, 180);
}

// ---- Ignore manager ----
function renderIgnoreTags() {
  els.ignoreTags.innerHTML = '';
  state.ignore.forEach((pattern) => {
    const tag = document.createElement('div');
    tag.className = 'tag';
    const label = document.createElement('span');
    label.textContent = pattern;
    label.title = pattern;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = `Remove "${pattern}"`;
    remove.addEventListener('click', () => removeIgnore(pattern));
    tag.append(label, remove);
    els.ignoreTags.appendChild(tag);
  });
  // Dim presets already in the list.
  document.querySelectorAll('.preset').forEach((p) => {
    p.classList.toggle('active', state.ignore.includes(p.dataset.val));
  });
}

function addIgnore(pattern) {
  const value = (pattern || '').trim();
  if (!value) return;
  if (state.ignore.includes(value)) {
    toast(`"${value}" is already ignored.`);
    return;
  }
  state.ignore.push(value);
  renderIgnoreTags();
  scheduleRegen();
}

function removeIgnore(pattern) {
  state.ignore = state.ignore.filter((p) => p !== pattern);
  renderIgnoreTags();
  scheduleRegen();
}

// ---- Events ----
els.pickFolder.addEventListener('click', async () => {
  const dir = await window.api.selectFolder({ title: 'Select a folder to scan' });
  if (!dir) return;
  state.rootDir = dir;
  els.folderPath.textContent = dir;
  els.folderPath.classList.remove('muted');
  // Default the export filename to the folder name.
  const base = dir.split(/[\\/]/).filter(Boolean).pop();
  if (base) els.baseName.value = base.replace(/[\\/:*?"<>|]/g, '_');
  regenerate();
});

els.pickOutput.addEventListener('click', async () => {
  const dir = await window.api.selectFolder({ title: 'Select an output folder', defaultPath: state.rootDir });
  if (!dir) return;
  state.outputDir = dir;
  els.outputPath.textContent = dir;
  els.outputPath.classList.remove('muted');
  updateExportEnabled();
});

els.copyBtn.addEventListener('click', async () => {
  if (!state.text) return;
  await window.api.copyToClipboard(state.text);
  toast('Tree copied to clipboard', 'success');
});

els.exportBtn.addEventListener('click', async () => {
  const formats = selectedFormats();
  if (formats.length === 0) { toast('Pick at least one format.', 'error'); return; }
  els.exportBtn.disabled = true;
  const original = els.exportBtn.textContent;
  els.exportBtn.textContent = 'Exporting…';
  try {
    const res = await window.api.export({
      text: state.text,
      formats,
      outputDir: state.outputDir,
      baseName: els.baseName.value,
      theme: els.exportTheme.value,
      title: state.rootDir ? state.rootDir.split(/[\\/]/).filter(Boolean).pop() : 'File Tree',
    });
    if (res.error) {
      toast(res.error, 'error');
    } else if (res.saved.length === 0) {
      toast(res.errors.join(' · ') || 'Export failed.', 'error');
    } else {
      const msg = `Exported ${res.saved.length} file${res.saved.length > 1 ? 's' : ''}`;
      toast(res.errors.length ? `${msg} (some failed: ${res.errors.join(', ')})` : msg, 'success');
      window.api.showItemInFolder(res.saved[0]);
    }
  } catch (err) {
    toast(`Export failed: ${err.message}`, 'error');
  } finally {
    els.exportBtn.textContent = original;
    updateExportEnabled();
  }
});

// Option inputs -> regenerate / refresh export state.
['style', 'maxDepth', 'foldersFirst', 'showHidden', 'showSizes', 'trailingSlash'].forEach((id) => {
  const el = els[id];
  const evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
  el.addEventListener(evt, scheduleRegen);
});

document.querySelectorAll('.fmt').forEach((c) => c.addEventListener('change', updateExportEnabled));

// ---- Ignore manager events ----
els.ignoreAdd.addEventListener('click', () => {
  addIgnore(els.ignoreInput.value);
  els.ignoreInput.value = '';
  els.ignoreInput.focus();
});
els.ignoreInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addIgnore(els.ignoreInput.value);
    els.ignoreInput.value = '';
  }
});
els.ignoreAddFolder.addEventListener('click', async () => {
  const dir = await window.api.selectFolder({ title: 'Select a folder to ignore', defaultPath: state.rootDir });
  if (!dir) return;
  const name = dir.split(/[\\/]/).filter(Boolean).pop();
  if (name) addIgnore(name);
});
els.ignoreClear.addEventListener('click', () => {
  if (state.ignore.length === 0) return;
  state.ignore = [];
  renderIgnoreTags();
  scheduleRegen();
});
document.querySelectorAll('.preset').forEach((p) => {
  p.addEventListener('click', () => addIgnore(p.dataset.val));
});

renderIgnoreTags();
