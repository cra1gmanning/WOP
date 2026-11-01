import { InteractionRequiredAuthError, PublicClientApplication } from "@azure/msal-browser";
import type { AppConfig } from "./config";
import { redirectUri } from "./config";

export const GRAPH_SCOPES = ["User.Read", "Files.ReadWrite", "offline_access"];

export interface Session {
  name: string;
  username: string;
  token: () => Promise<string>;
  signOut: () => Promise<void>;
}

export interface AuthHandle {
  session: Session | null;
  signIn: () => Promise<void>;
}

export async function startAuth(config: AppConfig): Promise<AuthHandle> {
  const app = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      redirectUri: redirectUri(),
    },
    cache: {
      cacheLocation: "localStorage",
    },
  });
  await app.initialize();
  const redirected = await app.handleRedirectPromise();
  const account = redirected?.account ?? app.getAllAccounts()[0] ?? null;
  if (account) app.setActiveAccount(account);
  if (redirected && window.location.search) {
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
  }

  async function token(): Promise<string> {
    const active = app.getActiveAccount() ?? app.getAllAccounts()[0];
    if (!active) throw new Error("Sign in again.");
    try {
      const result = await app.acquireTokenSilent({ account: active, scopes: GRAPH_SCOPES });
      return result.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await app.acquireTokenRedirect({ account: active, scopes: GRAPH_SCOPES });
      }
      throw error;
    }
  }

  return {
    session: account
      ? {
          name: account.name || account.username,
          username: account.username,
          token,
          signOut: async () => {
            await app.logoutRedirect({ account });
          },
        }
      : null,
    signIn: async () => {
      await app.loginRedirect({ scopes: GRAPH_SCOPES, prompt: "select_account" });
    },
  };
}
