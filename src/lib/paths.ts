/** Default OneDrive folder. Change it in Settings if the library lives somewhere else. */
export const DEFAULT_LIBRARY_ROOT = "Workouts";

export function normalizeLibraryRoot(input: string | undefined | null): string {
  const trimmed = String(input ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return trimmed || DEFAULT_LIBRARY_ROOT;
}

export function libraryFile(root?: string | null): string {
  return `${normalizeLibraryRoot(root)}/_app/library.json`;
}

export function chaptersFile(root?: string | null): string {
  return `${normalizeLibraryRoot(root)}/_app/chapters.json`;
}

export function stateFile(root?: string | null): string {
  return `${normalizeLibraryRoot(root)}/_app/state.json`;
}

export function photoFile(root?: string | null): string {
  return `${normalizeLibraryRoot(root)}/_app/photos/before.jpg`;
}

export function encodeDrivePath(path: string): string {
  return path
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function driveItemUrl(path: string): string {
  return `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeDrivePath(path)}`;
}

export function driveContentUrl(path: string): string {
  return `${driveItemUrl(path)}:/content`;
}

export function driveChildrenUrl(parentPath: string): string {
  if (!parentPath) return "https://graph.microsoft.com/v1.0/me/drive/root/children";
  return `${driveItemUrl(parentPath)}:/children`;
}

export function normalizeRel(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\\/g, "/").replace(/^\/+/, "");
}
