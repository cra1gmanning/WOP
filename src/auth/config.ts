export interface AppConfig {
  clientId: string;
  authority: string;
}

export function configuredClientId(clientId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
    && !clientId.startsWith("00000000-");
}

export async function loadConfig(): Promise<AppConfig> {
  const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: "no-store" });
  if (!response.ok) throw new Error("public/config.json did not load.");
  const body = (await response.json()) as { clientId?: string; authority?: string };
  return {
    clientId: String(body.clientId ?? "").trim(),
    authority: String(body.authority || "https://login.microsoftonline.com/consumers"),
  };
}

/** Absolute redirect URI. Vite's base always starts and ends with `/`, so the slash matches the Azure registration. */
export function redirectUriFor(origin: string, base: string): string {
  return new URL(base, origin).href;
}

export function redirectUri(): string {
  return redirectUriFor(window.location.origin, import.meta.env.BASE_URL);
}
