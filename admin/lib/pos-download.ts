/**
 * Windows POS installer download (GitHub Release asset).
 * Override with NEXT_PUBLIC_POS_WINDOWS_DOWNLOAD_URL if the asset moves.
 *
 * Stable asset name is produced by pos-windows-release.yml:
 *   FurkanSogutma-POS-Setup.exe
 */
export const POS_WINDOWS_SETUP_FILENAME = "FurkanSogutma-POS-Setup.exe";

export const POS_WINDOWS_RELEASES_URL =
  process.env.NEXT_PUBLIC_POS_WINDOWS_RELEASES_URL ??
  "https://github.com/muratbalcif/Sogutma/releases/latest";

export const POS_WINDOWS_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_POS_WINDOWS_DOWNLOAD_URL ??
  `${POS_WINDOWS_RELEASES_URL}/download/${POS_WINDOWS_SETUP_FILENAME}`;
