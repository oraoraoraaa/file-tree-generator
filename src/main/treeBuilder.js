'use strict';

const fs = require('fs');
const path = require('path');

const STYLES = {
  unicode: { tee: '├── ', last: '└── ', pipe: '│   ', blank: '    ' },
  ascii: { tee: '|-- ', last: '`-- ', pipe: '|   ', blank: '    ' },
};

/**
 * Convert a simple glob pattern (supporting `*` and `?`) into a RegExp that
 * matches an entry's base name. Plain names (no wildcards) match exactly.
 */
function patternToRegExp(pattern) {
  const escaped = pattern
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, process.platform === 'win32' ? 'i' : '');
}

function buildIgnoreMatcher(patterns) {
  const regexes = (patterns || [])
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .map(patternToRegExp);
  return (name) => regexes.some((re) => re.test(name));
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Generate a file-tree representation of a directory.
 *
 * @param {string} rootDir Absolute path of the folder to scan.
 * @param {object} [options]
 * @param {string[]} [options.ignore]      Glob/name patterns to skip.
 * @param {boolean} [options.showHidden]   Include dotfiles.
 * @param {number}  [options.maxDepth]     0 / falsy = unlimited.
 * @param {boolean} [options.foldersFirst] List directories before files.
 * @param {boolean} [options.showSizes]    Annotate files with their size.
 * @param {boolean} [options.trailingSlash] Append "/" to directory names.
 * @param {'unicode'|'ascii'} [options.style]
 * @returns {{ text: string, stats: { files: number, dirs: number, bytes: number, truncated: boolean } }}
 */
function generateTree(rootDir, options = {}) {
  const {
    ignore = [],
    showHidden = false,
    maxDepth = 0,
    foldersFirst = true,
    showSizes = false,
    trailingSlash = true,
    style = 'unicode',
  } = options;

  const connectors = STYLES[style] || STYLES.unicode;
  const isIgnored = buildIgnoreMatcher(ignore);
  const stats = { files: 0, dirs: 0, bytes: 0, truncated: false };

  // Hard ceiling so a runaway scan can't hang the UI.
  const MAX_ENTRIES = 200000;
  let entriesSeen = 0;

  const rootLabel = path.basename(rootDir) || rootDir;
  const lines = [`${rootLabel}${trailingSlash ? '/' : ''}`];

  function readChildren(dir) {
    let dirents;
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return [{ name: `[unreadable: ${err.code || 'error'}]`, kind: 'error' }];
    }

    const children = [];
    for (const dirent of dirents) {
      const name = dirent.name;
      if (!showHidden && name.startsWith('.')) continue;
      if (isIgnored(name)) continue;

      let isDir = dirent.isDirectory();
      // Resolve symlinks to decide whether to treat as a directory.
      if (dirent.isSymbolicLink()) {
        try {
          isDir = fs.statSync(path.join(dir, name)).isDirectory();
        } catch {
          isDir = false;
        }
      }
      children.push({ name, kind: isDir ? 'dir' : 'file' });
    }

    children.sort((a, b) => {
      if (foldersFirst && a.kind !== b.kind) {
        return a.kind === 'dir' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return children;
  }

  function walk(dir, prefix, depth) {
    if (maxDepth && depth > maxDepth) return;
    if (stats.truncated) return;

    const children = readChildren(dir);
    children.forEach((child, index) => {
      if (entriesSeen >= MAX_ENTRIES) {
        stats.truncated = true;
        return;
      }
      entriesSeen += 1;

      const isLast = index === children.length - 1;
      const branch = isLast ? connectors.last : connectors.tee;
      const childPath = path.join(dir, child.name);

      if (child.kind === 'error') {
        lines.push(`${prefix}${branch}${child.name}`);
        return;
      }

      if (child.kind === 'dir') {
        stats.dirs += 1;
        lines.push(`${prefix}${branch}${child.name}${trailingSlash ? '/' : ''}`);
        const nextPrefix = prefix + (isLast ? connectors.blank : connectors.pipe);
        walk(childPath, nextPrefix, depth + 1);
      } else {
        stats.files += 1;
        let label = child.name;
        if (showSizes) {
          let size = 0;
          try {
            size = fs.statSync(childPath).size;
          } catch {
            size = 0;
          }
          stats.bytes += size;
          label += `  (${formatSize(size)})`;
        }
        lines.push(`${prefix}${branch}${label}`);
      }
    });
  }

  walk(rootDir, '', 1);

  return { text: lines.join('\n'), stats };
}

module.exports = { generateTree, formatSize };
