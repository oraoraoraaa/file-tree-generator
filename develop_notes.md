# Develop Notes

## Build installers / executables

```bash
npm run dist        # build for your current OS
npm run dist:win    # Windows  -> release/*.exe  (NSIS installer + portable)
npm run dist:mac    # macOS    -> release/*.dmg  (x64 + arm64)
npm run dist:linux  # Linux    -> release/*.AppImage and *.deb
```

Artifacts are written to the `release/` folder. The Windows build produces both an
installer (`.exe`) and a portable single-file `.exe` suitable for attaching to a
GitHub Releases page.

> **Note:** cross-compiling (e.g. building a Windows `.exe` on macOS) may require extra
> tooling. The most reliable path is to build each platform on that platform — which is
> exactly what the automated release pipeline below does.

## Automated releases (GitHub Actions)

[.github/workflows/release.yml](.github/workflows/release.yml) builds all three platforms
on their native runners and publishes the installers to a GitHub Release. To cut a release:

```bash
npm version 1.0.1          # bump version + create the git tag
git push && git push --tags
```

Pushing a `v*` tag runs the matrix (Windows / macOS / Linux), then attaches `*.exe`,
`*.dmg`, `*.AppImage`, and `*.deb` to a Release for that tag (with auto-generated notes).
You can also trigger it manually from the **Actions** tab. Builds are unsigned; add
code-signing secrets later if you want signed installers.

## Custom app icon (optional)

A source icon lives at [build/icon.svg](build/icon.svg). To brand the packaged apps,
convert it to the platform formats and drop them in `build/`:

- `build/icon.ico` (Windows, 256×256)
- `build/icon.icns` (macOS)
- `build/icon.png` (Linux, 512×512+)

Then re-add the `icon` fields under each platform in `package.json`'s `build` section.
Without them, the default Electron icon is used.

---

## Project structure

```
file-tree-generator/
├── package.json                # scripts + electron-builder config
├── .github/workflows/
│   └── release.yml             # cross-platform build + GitHub Release
├── build/
│   └── icon.svg                # source icon (build-time resources)
└── src/
    ├── main/
    │   ├── main.js             # Electron main process + IPC
    │   ├── preload.js          # secure contextBridge API
    │   ├── treeBuilder.js      # directory walk + tree formatting
    │   └── exporter.js         # TXT / PNG / PDF exporters
    └── renderer/
        ├── index.html          # UI markup
        ├── styles.css          # UI styling
        ├── renderer.js         # UI logic
        └── assets/
            └── background.png  # ambient background image
```

## Release

### First release

The workflow only fires for a tag whose commit contains .github/workflows/release.yml, so commit everything first, then tag.

```bash
git tag v1.0.0
git push origin v1.0.0
```

Pushing the tag triggers the Release workflow. Watch it under the repo's Actions tab — it builds on Windows, macOS, and Linux runners (~5–10 min), then publishes a Release at …/releases/tag/v1.0.0 with .exe, .dmg, .AppImage, and .deb attached.

One-time check: if the Release comes out empty or the upload step errors, go to Settings → Actions → General → Workflow permissions and ensure Read and write permissions is selected. (The workflow already requests contents: write, but some accounts default the repo to read-only.)

### Future updates & releases

Make your code changes, commit, push — then let npm version bump the version and create the matching tag in one step:

After committing your changes to main, do:

```bash
npm version patch     # 1.0.0 -> 1.0.1  (bug fixes)

# npm version minor   # 1.0.0 -> 1.1.0  (new features)

# npm version major   # 1.0.0 -> 2.0.0  (breaking changes)

git push && git push --tags
```

`npm version` edits package.json, makes a commit, and creates the v1.0.1 tag automatically; pushing the tag runs the same pipeline and cuts a new Release. The Release notes are auto-generated from commits since the last tag, so descriptive commit messages pay off.

You can also re-run a build anytime without tagging via Actions → Release → Run workflow (it builds artifacts but only attaches them to a Release when triggered by a tag).
