import { useEffect, useState } from "react";
import { redirectUri } from "../auth/config";
import { todayString } from "../lib/dates";
import { collectVideos, resolveDay } from "../lib/workout";
import { useApp } from "./context";
import { BuildScreen } from "./build";
import { HistoryScreen } from "./history";
import { ClassScreen, CourseScreen, ExerciseScreen, LibraryScreen } from "./library";
import { QuizScreen } from "./quiz";
import { parseRoute, routeHash, type Route } from "./router";
import { EquipmentScreen, MoreScreen, SettingsScreen } from "./settings";
import { LessonScreen, HabitScreen } from "./habits";
import { TodayScreen } from "./today";
import { WeekScreen } from "./week";
import { VideoPane } from "./widgets";

const TABS: { route: Route; label: string }[] = [
  { route: { name: "today" }, label: "Today" },
  { route: { name: "week" }, label: "Week" },
  { route: { name: "library" }, label: "Library" },
  { route: { name: "more" }, label: "More" },
];

export function Shell() {
  const app = useApp();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) window.location.hash = "#/today";
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (!app.configReady) {
    return <main className="main"><p>Loading…</p></main>;
  }
  if (!app.preview && !app.configured) return <Setup />;
  if (!app.preview && !app.session) return <SignIn />;

  const active = route.name === "day" || route.name === "play" ? "today" : route.name;
  return (
    <div className="app">
      <aside className="side">
        <strong>Workout</strong>
        {TABS.map((tab) => (
          <a key={tab.label} href={routeHash(tab.route)} className={active === tab.route.name ? "active" : ""}>{tab.label}</a>
        ))}
      </aside>
      <nav className="nav">
        {TABS.map((tab) => (
          <a key={tab.label} href={routeHash(tab.route)} className={active === tab.route.name ? "active" : ""}>{tab.label}</a>
        ))}
      </nav>
      <main className="main">
        {app.preview ? <p className="preview-flag">Preview. Videos play only after Microsoft sign-in.</p> : null}
        {app.libraryError ? <p className="banner error">{app.libraryError} <button type="button" className="text" onClick={() => void app.reloadLibrary()}>Retry</button></p> : null}
        <Screen route={route} />
      </main>
    </div>
  );
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case "today":
      return <TodayScreen />;
    case "day":
      return <TodayScreen date={route.date} />;
    case "week":
      return <WeekScreen />;
    case "library":
      return <LibraryScreen />;
    case "course":
      return <CourseScreen id={route.id} />;
    case "class":
      return <ClassScreen id={route.id} />;
    case "exercise":
      return <ExerciseScreen id={route.id} day={route.day} item={route.item} />;
    case "quiz":
      return <QuizScreen />;
    case "build":
      return <BuildScreen />;
    case "history":
      return <HistoryScreen />;
    case "habits":
      return <HabitScreen />;
    case "lesson":
      return <LessonScreen id={route.id} />;
    case "settings":
      return <SettingsScreen />;
    case "equipment":
      return <EquipmentScreen />;
    case "more":
      return <MoreScreen />;
    case "play":
      return <PlayScreen date={route.date} />;
    default:
      return <TodayScreen />;
  }
}

function PlayScreen({ date }: { date: string }) {
  const app = useApp();
  const library = app.library;
  const [index, setIndex] = useState(0);
  if (!library) return null;
  const view = resolveDay(library, app.state, date, todayString());
  const videos = collectVideos(view);
  const current = videos[index];
  return (
    <section>
      <button type="button" className="text" onClick={() => history.back()}>Back</button>
      <p className="kicker">Play</p>
      <h1>{view.headline}</h1>
      {current ? (
        <>
          <p>{index + 1} / {videos.length}</p>
          <VideoPane path={current.path} title={current.title} />
          <div className="row">
            <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
            <button type="button" className="primary" disabled={index >= videos.length - 1} onClick={() => setIndex(index + 1)}>Next</button>
          </div>
        </>
      ) : <p>Nothing to play on this day.</p>}
    </section>
  );
}

function Setup() {
  return (
    <main className="main gate">
      <div className="mark">W</div>
      <h1>Add your Azure client ID</h1>
      <p>Open <code>public/config.json</code> and replace <code>YOUR_AZURE_APP_CLIENT_ID</code>. Register this redirect URI:</p>
      <p className="prescription">{redirectUri()}</p>
      <p className="muted">The production URI is https://cra1gmanning.github.io/WOP/ and local dev is http://localhost:5173/. Both are listed in the README.</p>
    </main>
  );
}

function SignIn() {
  const { signIn } = useApp();
  return (
    <main className="main gate">
      <div className="mark">W</div>
      <h1>Sign in with Microsoft</h1>
      <p>Videos and your log live in your personal OneDrive. This app only talks to Microsoft.</p>
      <button type="button" className="primary" onClick={() => void signIn()}>Sign in</button>
      <p className="muted">On iPhone, sign in from the Home Screen icon. If Microsoft opens Safari, finish there, then open the icon and sign in once from that session.</p>
    </main>
  );
}
