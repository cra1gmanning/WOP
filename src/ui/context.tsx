import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { configuredClientId, loadConfig, type AppConfig } from "../auth/config";
import { startAuth, type Session } from "../auth/msal";
import { idbGet, idbSet, videoClear, videoGet, videoKeys, videoSet } from "../db/idb";
import { createDrive, fetchVideoBlob, type Drive } from "../graph/drive";
import { contentSignature, mergeState } from "../lib/merge";
import { EMPTY_CHAPTERS, lookupChapters, parseChapters, type ChapterCue, type ChaptersFile } from "../lib/chapters";
import { chaptersFile, libraryFile, normalizeLibraryRoot, photoFile, stateFile } from "../lib/paths";
import type { AppState, Library } from "../types";
import { createState } from "../state/default";
import { reducer, type Action } from "../state/reducer";

export type SyncStatus = "local" | "syncing" | "synced" | "error" | "offline";

export interface VideoSource {
  src: string;
  revoke?: () => void;
}

export interface AppModel {
  preview: boolean;
  configReady: boolean;
  configured: boolean;
  session: Session | null;
  signIn: () => Promise<void>;
  library: Library | null;
  libraryError: string | null;
  reloadLibrary: () => Promise<void>;
  state: AppState;
  dispatch: (action: Action) => void;
  syncStatus: SyncStatus;
  syncError: string | null;
  syncNow: () => Promise<void>;
  chaptersFor: (relativePath: string) => ChapterCue[];
  videoSource: (relativePath: string, force?: boolean) => Promise<VideoSource>;
  cacheVideos: (items: { path: string; title: string }[], onProgress: (label: string) => void) => Promise<string[]>;
  cachedPaths: string[];
  clearCache: () => Promise<void>;
  uploadPhoto: (blob: Blob) => Promise<void>;
}

const Ctx = createContext<AppModel | null>(null);

export { Ctx as AppContext };

export function useApp(): AppModel {
  const value = useContext(Ctx);
  if (!value) throw new Error("App context is missing");
  return value;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rootOf(state: { meta: { libraryRoot?: string } }): string {
  return normalizeLibraryRoot(state.meta.libraryRoot);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const preview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");
  const [configReady, setConfigReady] = useState(false);
  const [configured, setConfigured] = useState(preview);
  const [session, setSession] = useState<Session | null>(null);
  const [signIn, setSignIn] = useState<() => Promise<void>>(async () => undefined);
  const [library, setLibrary] = useState<Library | null>(null);
  const [chapters, setChapters] = useState<ChaptersFile>(EMPTY_CHAPTERS);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [state, setState] = useState<AppState>(() => createState());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(preview ? "local" : "local");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cachedPaths, setCachedPaths] = useState<string[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const driveRef = useRef<Drive | null>(null);
  const booted = useRef(false);
  const dirty = useRef(false);
  const syncing = useRef(false);
  const urls = useRef(new Map<string, { url: string; at: number }>());

  function dispatch(action: Action) {
    if (action.type === "replace") {
      setState(action.state);
      return;
    }
    dirty.current = true;
    setState((current) => reducer(current, action));
  }

  async function refreshCacheKeys() {
    if (preview) return;
    setCachedPaths(await videoKeys());
  }

  async function syncNow() {
    const drive = driveRef.current;
    if (!drive || preview) return;
    if (syncing.current) return;
    syncing.current = true;
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const remote = await drive.getJson<AppState>(stateFile(rootOf(stateRef.current)));
      const local = stateRef.current;
      let merged = remote ? mergeState(local, remote) : local;
      if (!remote || contentSignature(merged) !== contentSignature(remote)) {
        merged = {
          ...merged,
          revision: Math.max(local.revision, remote?.revision ?? 0) + 1,
          updatedAt: new Date().toISOString(),
        };
        await drive.putJson(stateFile(rootOf(local)), merged);
        const latest = stateRef.current;
        if (contentSignature(latest) !== contentSignature(local)) merged = mergeState(latest, merged);
      }
      if (contentSignature(merged) !== contentSignature(stateRef.current)) dispatch({ type: "replace", state: merged });
      setSyncStatus(navigator.onLine ? "synced" : "offline");
    } catch (error) {
      setSyncStatus("error");
      setSyncError(message(error));
    } finally {
      syncing.current = false;
    }
  }

  async function loadChapters(drive: Drive | null) {
    const root = rootOf(stateRef.current);
    const cacheKey = `chapters:${root}`;
    let cached: unknown;
    try {
      cached = await idbGet<unknown>(cacheKey);
      if (cached) setChapters(parseChapters(cached));
    } catch {
      cached = undefined;
    }
    if (!drive) return;
    try {
      const remote = await drive.getJson<unknown>(chaptersFile(root));
      const parsed = parseChapters(remote);
      setChapters(parsed);
      await idbSet(cacheKey, parsed);
    } catch {
      if (!cached) setChapters(EMPTY_CHAPTERS);
    }
  }

  async function loadLibrary(drive: Drive | null) {
    const chaptersTask = loadChapters(drive);
    const cached = await idbGet<Library>("library");
    if (cached) setLibrary(cached);
    if (!drive) {
      if (!cached) setLibraryError("The library has not been loaded on this device yet.");
      await chaptersTask;
      return;
    }
    try {
      const remote = await drive.getJson<Library>(libraryFile(rootOf(stateRef.current)));
      if (!remote) {
        if (!cached) {
          setLibraryError(`Put library.json in OneDrive at /${libraryFile(rootOf(stateRef.current))}, then tap Retry.`);
        }
        return;
      }
      setLibrary(remote);
      setLibraryError(null);
      await idbSet("library", remote);
    } catch (error) {
      if (!cached) setLibraryError(message(error));
    } finally {
      await chaptersTask;
    }
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      const saved = await idbGet<AppState>("state");
      if (cancel) return;
      if (saved?.version === 1) {
        setState((current) => (dirty.current ? mergeState(current, saved) : saved));
      }
      booted.current = true;
      await refreshCacheKeys();
      if (preview) {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}preview-library.json`);
          if (!response.ok) throw new Error("Run npm run generate and copy the file to public/preview-library.json.");
          const body = (await response.json()) as Library;
          if (!cancel) {
            setLibrary(body);
            setConfigured(true);
            setConfigReady(true);
          }
          try {
            const chaptersResponse = await fetch(`${import.meta.env.BASE_URL}preview-chapters.json`);
            if (chaptersResponse.ok) {
              const chaptersBody: unknown = await chaptersResponse.json();
              if (!cancel) setChapters(parseChapters(chaptersBody));
            }
          } catch {
            /* bookmarks file is optional */
          }
        } catch (error) {
          if (!cancel) setLibraryError(message(error));
          setConfigReady(true);
        }
        return;
      }
      try {
        const config: AppConfig = await loadConfig();
        if (cancel) return;
        const ok = configuredClientId(config.clientId);
        setConfigured(ok);
        setConfigReady(true);
        if (!ok) return;
        const auth = await startAuth(config);
        if (cancel) return;
        setSignIn(() => auth.signIn);
        setSession(auth.session);
        if (!auth.session) return;
        const drive = createDrive(auth.session.token);
        driveRef.current = drive;
        await loadLibrary(drive);
        await syncNow();
      } catch (error) {
        if (!cancel) {
          setConfigReady(true);
          setLibraryError(message(error));
        }
      }
    })();
    return () => {
      cancel = true;
    };
    // Boot once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  useEffect(() => {
    if (!booted.current) return;
    void idbSet("state", state);
    if (!dirty.current || preview) return;
    const handle = window.setTimeout(() => {
      dirty.current = false;
      void syncNow();
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [state, preview]);

  useEffect(() => {
    const onLine = () => setSyncStatus((current) => (current === "offline" ? "local" : current));
    const offLine = () => setSyncStatus("offline");
    window.addEventListener("online", onLine);
    window.addEventListener("offline", offLine);
    return () => {
      window.removeEventListener("online", onLine);
      window.removeEventListener("offline", offLine);
    };
  }, []);

  const model = useMemo<AppModel>(() => ({
    preview,
    configReady,
    configured,
    session,
    signIn,
    library,
    libraryError,
    reloadLibrary: async () => {
      if (driveRef.current) await loadLibrary(driveRef.current);
    },
    state,
    dispatch,
    syncStatus,
    syncError,
    syncNow,
    chaptersFor: (relativePath: string) => lookupChapters(chapters, relativePath),
    videoSource: async (relativePath: string, force = false) => {
      if (preview) {
        throw new Error("Preview mode does not play OneDrive videos. Add the Azure client id and sign in.");
      }
      const saved = await videoGet(relativePath);
      if (saved && !force) {
        const src = URL.createObjectURL(saved);
        return { src, revoke: () => URL.revokeObjectURL(src) };
      }
      const drive = driveRef.current;
      if (!drive) throw new Error("Sign in to play videos.");
      const cached = urls.current.get(relativePath);
      if (!force && cached && Date.now() - cached.at < 45 * 60 * 1000) return { src: cached.url };
      const url = await drive.downloadUrl(`${normalizeLibraryRoot(rootOf(stateRef.current))}/${relativePath.replace(/^\/+/, "")}`);
      urls.current.set(relativePath, { url, at: Date.now() });
      return { src: url };
    },
    cacheVideos: async (items, onProgress) => {
      const drive = driveRef.current;
      if (!drive) throw new Error("Sign in before saving videos on this phone.");
      const failures: string[] = [];
      for (const item of items) {
        onProgress(item.title);
        try {
          const url = await drive.downloadUrl(`${normalizeLibraryRoot(rootOf(stateRef.current))}/${item.path.replace(/^\/+/, "")}`);
          const blob = await fetchVideoBlob(url);
          await videoSet(item.path, blob);
        } catch (error) {
          failures.push(`${item.title}: ${message(error)}`);
        }
      }
      await refreshCacheKeys();
      return failures;
    },
    cachedPaths,
    clearCache: async () => {
      await videoClear();
      setCachedPaths([]);
    },
    uploadPhoto: async (blob: Blob) => {
      const drive = driveRef.current;
      if (!drive) throw new Error("Sign in before uploading a photo.");
      const path = photoFile(rootOf(stateRef.current));
      await drive.putBlob(path, blob, blob.type || "image/jpeg");
      dispatch({ type: "habit-profile", photoPath: path });
    },
  }), [preview, configReady, configured, session, signIn, library, chapters, libraryError, state, syncStatus, syncError, cachedPaths]);

  return <Ctx.Provider value={model}>{children}</Ctx.Provider>;
}
