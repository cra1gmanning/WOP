import { useEffect, useMemo, useRef, useState } from "react";
import { fileTitle, findTextLesson, videoTitle } from "../lib/lessons";
import { sanitizeLessonHtml } from "../lib/sanitize";
import type { LibraryAttachment } from "../types";
import { useApp, type VideoSource } from "./context";
import { go } from "./router";

export function LessonBody({ html, description }: { html?: string; description?: string }) {
  const clean = html?.trim() ? sanitizeLessonHtml(html) : "";
  if (clean.trim()) return <LessonHtml markup={clean} />;
  if (description?.trim()) return <p className="lesson-text">{description}</p>;
  return null;
}

export function LessonHtml({ markup }: { markup: string }) {
  const { videoSource } = useApp();
  const sourceFn = useRef(videoSource);
  sourceFn.current = videoSource;
  const relative = useMemo(() => relativeImageSources(markup), [markup]);
  const [resolved, setResolved] = useState<{ markup: string; html: string } | null>(null);

  useEffect(() => {
    if (!relative.length) return;
    let cancel = false;
    const revokes: Array<() => void> = [];
    const doc = new DOMParser().parseFromString(markup, "text/html");
    void (async () => {
      await Promise.all([...doc.querySelectorAll("img")].map(async (img) => {
        const src = (img.getAttribute("src") || "").trim();
        if (!src || isRemoteSrc(src)) return;
        try {
          const next = await sourceFn.current(src);
          if (cancel) {
            next.revoke?.();
            return;
          }
          if (next.revoke) revokes.push(next.revoke);
          img.setAttribute("src", next.src);
        } catch {
          img.remove();
        }
      }));
      if (!cancel) setResolved({ markup, html: doc.body.innerHTML });
    })();
    return () => {
      cancel = true;
      for (const revoke of revokes) revoke();
    };
  }, [markup, relative.length]);

  const html = relative.length ? (resolved?.markup === markup ? resolved.html : "") : markup;
  if (!html.trim()) return null;
  return <div className="lesson-html" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function LessonAttachments({ attachments }: { attachments: LibraryAttachment[] }) {
  if (!attachments.length) return null;
  return (
    <div className="lesson-attachments">
      {attachments.map((attachment, index) => (
        <AttachmentView key={`${attachment.path}-${index}`} attachment={attachment} />
      ))}
    </div>
  );
}

export function RelatedVideos({ paths }: { paths: string[] }) {
  const library = useApp().library;
  if (!paths.length) return null;
  return (
    <section className="related-videos">
      <h2>Related videos</h2>
      {paths.map((path, index) => (
        <button
          key={`${path}-${index}`}
          type="button"
          className="card day-chip"
          onClick={() => go({ name: "exercise", id: `video:${path}` })}
        >
          <strong>{library ? videoTitle(library, path) : fileTitle(path)}</strong>
        </button>
      ))}
    </section>
  );
}

export function NotesScreen({ courseId, title }: { courseId: string; title: string }) {
  const library = useApp().library;
  if (!library) return null;
  const lesson = findTextLesson(library, courseId, title);
  if (!lesson) return <p>That lesson is not in the library.</p>;
  return (
    <section>
      <button type="button" className="text" onClick={() => go({ name: "course", id: courseId })}>Back</button>
      <h1>{lesson.title}</h1>
      <LessonBody html={lesson.html} description={lesson.description} />
      <LessonAttachments attachments={lesson.attachments} />
      <RelatedVideos paths={lesson.relatedPaths} />
    </section>
  );
}

function AttachmentView({ attachment }: { attachment: LibraryAttachment }) {
  const file = useDriveFile(attachment.path);
  if (file.hidden || !file.src) return null;
  if (attachment.kind === "pdf") {
    return (
      <a className="card attachment-file" href={file.src} target="_blank" rel="noopener noreferrer">
        <strong>{attachment.title}</strong>
        <span className="muted">PDF</span>
      </a>
    );
  }
  return (
    <figure className="attachment-image">
      <img src={file.src} alt={attachment.title} onError={() => void file.refresh()} />
      <figcaption className="muted">{attachment.title}</figcaption>
    </figure>
  );
}

function useDriveFile(path: string) {
  const { videoSource } = useApp();
  const sourceFn = useRef(videoSource);
  sourceFn.current = videoSource;
  const [src, setSrc] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const revokeRef = useRef<(() => void) | undefined>(undefined);
  const triedRefresh = useRef(false);
  const generation = useRef(0);

  function retain(next: VideoSource) {
    if (revokeRef.current && revokeRef.current !== next.revoke) revokeRef.current();
    revokeRef.current = next.revoke;
    setSrc(next.src);
  }

  useEffect(() => {
    const gen = ++generation.current;
    triedRefresh.current = false;
    setHidden(false);
    setSrc(null);
    sourceFn.current(path)
      .then((next) => {
        if (generation.current !== gen) {
          next.revoke?.();
          return;
        }
        retain(next);
      })
      .catch(() => {
        if (generation.current === gen) setHidden(true);
      });
    return () => {
      generation.current += 1;
      revokeRef.current?.();
      revokeRef.current = undefined;
    };
  }, [path]);

  async function refresh() {
    if (triedRefresh.current) {
      setHidden(true);
      return;
    }
    triedRefresh.current = true;
    const gen = generation.current;
    try {
      const next = await sourceFn.current(path, true);
      if (generation.current !== gen) {
        next.revoke?.();
        return;
      }
      retain(next);
      setHidden(false);
    } catch {
      if (generation.current === gen) setHidden(true);
    }
  }

  return { src, hidden, refresh };
}

function relativeImageSources(markup: string): string[] {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  const sources: string[] = [];
  for (const img of doc.querySelectorAll("img")) {
    const src = (img.getAttribute("src") || "").trim();
    if (src && !isRemoteSrc(src)) sources.push(src);
  }
  return sources;
}

function isRemoteSrc(src: string): boolean {
  return /^(?:https?:|data:|blob:)/i.test(src) || src.startsWith("//");
}
