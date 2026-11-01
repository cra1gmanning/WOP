export type Route =
  | { name: "today" }
  | { name: "day"; date: string }
  | { name: "week" }
  | { name: "library" }
  | { name: "course"; id: string }
  | { name: "exercise"; id: string; day?: string; item?: string }
  | { name: "class"; id: string }
  | { name: "quiz" }
  | { name: "build" }
  | { name: "history" }
  | { name: "habits" }
  | { name: "lesson"; id: string }
  | { name: "settings" }
  | { name: "more" }
  | { name: "play"; date: string }
  | { name: "equipment" };

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, "").replace(/^\//, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const slash = pathPart.indexOf("/");
  const head = decodeURIComponent(slash === -1 ? pathPart : pathPart.slice(0, slash));
  const rest = slash === -1 ? "" : decodeURIComponent(pathPart.slice(slash + 1));
  const query = new URLSearchParams(queryPart);
  switch (head) {
    case "week":
      return { name: "week" };
    case "library":
      return { name: "library" };
    case "course":
      return { name: "course", id: rest };
    case "exercise":
      return { name: "exercise", id: rest, day: query.get("day") || undefined, item: query.get("item") || undefined };
    case "class":
      return { name: "class", id: rest };
    case "quiz":
      return { name: "quiz" };
    case "build":
      return { name: "build" };
    case "history":
      return { name: "history" };
    case "habits":
      return { name: "habits" };
    case "lesson":
      return { name: "lesson", id: rest };
    case "settings":
      return { name: "settings" };
    case "more":
      return { name: "more" };
    case "play":
      return { name: "play", date: rest };
    case "day":
      return { name: "day", date: rest };
    case "equipment":
      return { name: "equipment" };
    default:
      return { name: "today" };
  }
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case "today":
      return "#/today";
    case "day":
      return `#/day/${route.date}`;
    case "week":
      return "#/week";
    case "library":
      return "#/library";
    case "course":
      return `#/course/${encodeURIComponent(route.id)}`;
    case "exercise": {
      const query = new URLSearchParams();
      if (route.day) query.set("day", route.day);
      if (route.item) query.set("item", route.item);
      const suffix = query.toString();
      return `#/exercise/${encodeURIComponent(route.id)}${suffix ? `?${suffix}` : ""}`;
    }
    case "class":
      return `#/class/${encodeURIComponent(route.id)}`;
    case "quiz":
      return "#/quiz";
    case "build":
      return "#/build";
    case "history":
      return "#/history";
    case "habits":
      return "#/habits";
    case "lesson":
      return `#/lesson/${encodeURIComponent(route.id)}`;
    case "settings":
      return "#/settings";
    case "more":
      return "#/more";
    case "play":
      return `#/play/${route.date}`;
    case "equipment":
      return "#/equipment";
  }
}

export function go(route: Route): void {
  window.location.hash = routeHash(route);
}
