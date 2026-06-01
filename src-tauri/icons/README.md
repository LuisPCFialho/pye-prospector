# Icons

This folder must contain the application icons before producing a release build.

Generate them from a single 1024×1024 source PNG using the Tauri CLI:

```bash
npm run tauri icon path/to/source.png
```

This populates `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico` (Windows) and `icon.icns` (macOS) automatically.

Until icons exist `npm run tauri dev` works fine; only `npm run tauri build` requires them.
