"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowLeft, Check, Clock3, FileText, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import type { ProjectEntry, ProjectItem } from "@/lib/projects";

function formatDuration(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = Math.round(total % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ProjectsView({
  focusId,
  onBack,
}: {
  focusId?: string | null;
  onBack?: () => void;
}) {
  const [items, setItems] = useState<ProjectItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProjectEntry | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not load projects (${response.status}).`);
      const data = (await response.json()) as { items: ProjectItem[] };
      setItems(data.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const open = useCallback(async (id: string) => {
    setOpening(id);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not open that project (${response.status}).`);
      setSelected((await response.json()) as ProjectEntry);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setOpening(null);
    }
  }, []);

  useEffect(() => {
    if (focusId) void open(focusId);
  }, [focusId, open]);

  if (selected) {
    return (
      <ProjectWorkspace
        project={selected}
        onBack={() => setSelected(null)}
        onRenamed={(project) => {
          setSelected(project);
          void load();
        }}
        onDeleted={() => {
          setSelected(null);
          void load();
        }}
      />
    );
  }

  return (
      <div className="scroll-quiet h-full overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            {onBack ? (
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onBack}
              >
                <ArrowLeft className="size-3.5" />
                Back to chat
              </Button>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight">Projects</h2>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Speeches you have turned into working sets. Newest first.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        {error ? (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground">
            {error}
          </p>
        ) : null}

        {items === null ? (
          <div className="flex justify-center py-16">
            <Loader variant="dots" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
            <p className="text-sm font-medium">No projects yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Describe a speech in the chat and approve a video — creating a project transcribes it
              and lands it here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => void open(item.id)}
                  disabled={opening === item.id}
                  className={cn(
                    "group flex w-full items-start gap-4 rounded-xl border border-transparent px-3 py-3 text-left transition-colors",
                    "hover:border-border/70 hover:bg-card/50 focus-visible:border-ring focus-visible:outline-none",
                    opening === item.id && "opacity-60",
                  )}
                >
                  <span className="hidden h-[56px] w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:block">
                    {item.video.thumbnail ? (
                      <img src={item.video.thumbnail} alt="" className="size-full object-cover" />
                    ) : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[13.5px] font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatDate(item.updatedAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.video.channel || item.video.title || "Unknown source"}
                    </span>
                    <span className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="size-3" />
                        {item.stats.words.toLocaleString()} words
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3" />
                        {formatDuration(item.stats.duration)}
                      </span>
                      <span className="uppercase">{item.stats.language}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProjectWorkspace({
  project,
  onBack,
  onRenamed,
  onDeleted,
}: {
  project: ProjectEntry;
  onBack: () => void;
  onRenamed: (project: ProjectEntry) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const name = draft.trim();
    if (!name || name === project.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(`Could not rename the project (${response.status}).`);
      onRenamed((await response.json()) as ProjectEntry);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the project “${project.name}”? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Could not delete the project (${response.status}).`);
      onDeleted();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setBusy(false);
    }
  }

  return (
      <div className="scroll-quiet h-full overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto w-full max-w-5xl">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-4 text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          All projects
        </Button>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {editing ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                value={draft}
                autoFocus
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void save();
                  if (event.key === "Escape") setEditing(false);
                }}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background/70 px-3 py-1.5 text-[15px] font-semibold tracking-tight outline-none focus-visible:border-ring"
              />
              <Button size="icon" className="size-8 shrink-0" onClick={() => void save()} disabled={busy}>
                <Check className="size-4" />
                <span className="sr-only">Save name</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => {
                  setDraft(project.name);
                  setEditing(false);
                }}
                disabled={busy}
              >
                <X className="size-4" />
                <span className="sr-only">Cancel rename</span>
              </Button>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h2 className="truncate text-[17px] font-semibold leading-tight tracking-tight">
                {project.name}
              </h2>
              <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {project.status}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setDraft(project.name);
                  setEditing(true);
                }}
                aria-label="Rename project"
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => void remove()}
            disabled={busy}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>

        {error ? (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground">
            {error}
          </p>
        ) : null}

        <AnalyticsPanel
          video={project.video}
          transcript={project.transcript}
          stats={project.stats}
          sessionId={null}
        />
      </div>
    </div>
  );
}
