/**
 * Auto-update check (Tauri desktop only). Runs once on startup, asks the user
 * before installing, then relaunches. Fully fail-safe: any error (browser/dev
 * context, offline, no release published yet) is swallowed so it never blocks
 * app start.
 */
import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;

    const ok = await ask(
      `Versão ${update.version} disponível (tens a ${update.currentVersion}).\n\n` +
        `${update.body ?? ""}\n\nInstalar agora? A app reinicia no fim.`,
      { title: "Atualização disponível", kind: "info" },
    );
    if (!ok) return;

    await update.downloadAndInstall();
    await relaunch();
  } catch {
    // No updater endpoint, offline, or running in the browser — ignore.
  }
}
