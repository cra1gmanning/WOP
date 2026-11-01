import { useState } from "react";
import { DEFAULT_LIBRARY_ROOT } from "../lib/paths";
import { planName } from "../lib/quiz";
import type { PlanId } from "../types";
import { useApp } from "./context";
import { go } from "./router";

export function SettingsScreen() {
  const app = useApp();
  const [confirm, setConfirm] = useState(false);
  const [folder, setFolder] = useState(app.state.meta.libraryRoot || DEFAULT_LIBRARY_ROOT);
  return (
    <section>
      <p className="kicker">Settings</p>
      <h1>{app.session?.name || "Account"}</h1>
      <p className="muted">{app.session?.username}</p>
      <p>Sync: {app.syncStatus}{app.syncError ? ` — ${app.syncError}` : ""}</p>
      <div className="row">
        <button type="button" className="primary" onClick={() => void app.syncNow()}>Sync now</button>
        <button type="button" onClick={() => void app.reloadLibrary()}>Reload library</button>
        {app.session ? <button type="button" onClick={() => void app.session?.signOut()}>Sign out</button> : null}
      </div>
      <h2>OneDrive folder</h2>
      <p className="muted">The library file is /{folder || DEFAULT_LIBRARY_ROOT}/_app/library.json. Logs use the same folder. Default is /{DEFAULT_LIBRARY_ROOT}. Rename the folder in OneDrive if you want a different name, then save that name here.</p>
      <label className="stack">
        Folder
        <input value={folder} onChange={(event) => setFolder(event.target.value)} />
      </label>
      <button type="button" onClick={() => app.dispatch({ type: "set-library-root", libraryRoot: folder })}>Save folder</button>
      <h2>Plan</h2>
      <p className="muted">Switching plans keeps your steps. The default warm-up follows the plan.</p>
      <div className="stack">
        {(["beginner", "intermediate-one", "intermediate-two", "advanced-one", "advanced-two"] as PlanId[]).map((planId) => (
          <button
            key={planId}
            type="button"
            className={app.state.meta.planId === planId ? "good" : ""}
            onClick={() => app.library && app.dispatch({ type: "start-plan", planId, reseed: false, library: app.library })}
          >
            {planName(planId)}
          </button>
        ))}
      </div>
      {confirm ? (
        <button
          type="button"
          className="primary"
          onClick={() => {
            if (!app.library) return;
            app.dispatch({ type: "reset-slots", library: app.library });
            setConfirm(false);
          }}
        >
          Confirm reset to this plan's start
        </button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)}>Reset progressions</button>
      )}
      <h2>Rest timer</h2>
      <div className="row">
        {[30, 45, 60, 90, 120].map((sec) => (
          <button key={sec} type="button" className={app.state.meta.restSec === sec ? "good" : ""} onClick={() => app.dispatch({ type: "set-rest", sec })}>
            {sec}s
          </button>
        ))}
      </div>
      <h2>Videos saved on this phone</h2>
      <p>{app.cachedPaths.length} file{app.cachedPaths.length === 1 ? "" : "s"}. iPhone storage is limited, and iOS can reclaim it. Saving is best for today's workout, not the whole library.</p>
      <button type="button" onClick={() => void app.clearCache()}>Remove saved videos</button>
      <h2>Install on iPhone</h2>
      <ol>
        <li>Open this site in Safari (the Home Screen icon uses a separate sign-in from a normal Safari tab).</li>
        <li>Tap Share, then Add to Home Screen.</li>
        <li>Open the Home Screen icon and sign in with your personal Microsoft account.</li>
        <li>On Wi-Fi, open Today and tap Save videos on this phone before you lose signal.</li>
      </ol>
      <button type="button" onClick={() => go({ name: "equipment" })}>Equipment list</button>
      <h2>Backup</h2>
      <button
        type="button"
        onClick={() => {
          const blob = new Blob([JSON.stringify(app.state, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "workout-state.json";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download state.json
      </button>
    </section>
  );
}

export function EquipmentScreen() {
  const equipment = useApp().library?.equipment ?? [];
  return (
    <section>
      <button type="button" className="text" onClick={() => go({ name: "settings" })}>Settings</button>
      <h1>Equipment</h1>
      {equipment.map((group) => (
        <article key={group.course} className="card">
          <h2>{group.course}</h2>
          <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      ))}
    </section>
  );
}

export function MoreScreen() {
  const links: { label: string; hash: Parameters<typeof go>[0] }[] = [
    { label: "Placement quiz", hash: { name: "quiz" } },
    { label: "Build your own", hash: { name: "build" } },
    { label: "History", hash: { name: "history" } },
    { label: "Habit", hash: { name: "habits" } },
    { label: "Settings", hash: { name: "settings" } },
  ];
  return (
    <section>
      <p className="kicker">More</p>
      <h1>Tools</h1>
      <div className="stack">
        {links.map((link) => (
          <button key={link.label} type="button" onClick={() => go(link.hash)}>{link.label}</button>
        ))}
      </div>
    </section>
  );
}
