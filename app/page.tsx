"use client";

import { PanelLeft, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { AudioToolsView } from "@/components/AudioToolsView";
import { ChatPanel } from "@/components/ChatPanel";
import { ChatSidebar } from "@/components/ChatSidebar";
import { LibraryView } from "@/components/LibraryView";
import { LiveView } from "@/components/LiveView";
import { ProjectsView } from "@/components/ProjectsView";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgentChat } from "@/components/useAgentChat";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, stiffness: 150, damping: 24 };

export default function Page() {
  const chat = useAgentChat();
  const [tab, setTab] = useState("existing");
  const [existingView, setExistingView] = useState<"chat" | "transcripts">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (chat.createdProject) setTab("projects");
  }, [chat.createdProject]);

  const split =
    existingView === "chat" && chat.view === "split" && chat.transcript && chat.stats;

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-dvh flex-col gap-0!">
      <header className="glass-strong grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border/70 px-3">
        <div className="flex items-center gap-2">
          {tab === "existing" && !sidebarOpen ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(true)}
              aria-label="Show history"
            >
              <PanelLeft className="size-4" />
            </Button>
          ) : null}

          <span
            className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Sparkles className="size-3.5" />
          </span>
          <span className="text-sm font-medium tracking-tight">Speech Ingest</span>
        </div>

        <TabsList className="justify-self-center">
          <TabsTrigger value="existing" className="px-3">
            Existing Content
          </TabsTrigger>
          <TabsTrigger value="projects" className="px-3">
            Projects
          </TabsTrigger>
          <TabsTrigger value="live" className="px-3">
            Live
          </TabsTrigger>
          <TabsTrigger value="audio" className="px-3">
            Audio tools
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center justify-end gap-4 text-xs text-muted-foreground">
          {chat.sessionId ? (
            <a
              className="underline-offset-4 hover:text-foreground hover:underline"
              href={`https://www.browserbase.com/sessions/${chat.sessionId}`}
              target="_blank"
              rel="noreferrer"
            >
              Browser session ↗
            </a>
          ) : null}
        </div>
      </header>

      <TabsContent
        forceMount
        value="existing"
        className="flex min-h-0 flex-1 flex-row data-[state=inactive]:hidden"
      >
        <AnimatePresence initial={false}>
          {sidebarOpen ? (
            <motion.aside
              key="history"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 264, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={SPRING}
              className="min-h-0 shrink-0 overflow-hidden border-r border-border/60"
            >
              <ChatSidebar
                activeId={chat.chatId}
                refreshKey={chat.saveCount}
                onCollapse={() => setSidebarOpen(false)}
                onNew={chat.startNew}
                onSelect={(session) => {
                  chat.restore(session);
                  setExistingView("chat");
                }}
                onShowTranscripts={() => setExistingView("transcripts")}
              />
            </motion.aside>
          ) : null}
        </AnimatePresence>

        {existingView === "transcripts" ? (
          <div className="min-h-0 flex-1">
            <LibraryView onBack={() => setExistingView("chat")} />
          </div>
        ) : (
          <motion.main
            layout
            transition={SPRING}
            className={cn(
              "flex min-h-0 flex-1 gap-5 p-5",
              split ? "flex-col lg:flex-row" : "justify-center",
            )}
          >
            <AnimatePresence initial={false}>
              {split ? (
                <motion.section
                  key="analytics"
                  layout
                  initial={{ opacity: 0, x: -28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={SPRING}
                  className="scroll-quiet min-h-0 min-w-0 flex-1 overflow-y-auto pr-1"
                >
                  <AnalyticsPanel
                    video={chat.proposal}
                    transcript={chat.transcript!}
                    stats={chat.stats!}
                    sessionId={chat.sessionId}
                    primarySpeaker={chat.primarySpeaker}
                    primarySpeakerReason={chat.primarySpeakerReason}
                  />
                </motion.section>
              ) : null}
            </AnimatePresence>

            <motion.section
              layout
              layoutId="chat"
              transition={SPRING}
              className={cn(
                "flex min-h-0 flex-col",
                split ? "w-full lg:w-[420px] lg:shrink-0" : "w-full",
              )}
            >
              <ChatPanel
                messages={chat.messages}
                status={chat.status}
                busy={chat.busy}
                model={chat.model}
                proposal={chat.proposal}
                onSend={chat.send}
                onConfirm={chat.createProject}
                onReject={() => chat.reject()}
                mode={chat.mode}
                onModeChange={chat.setMode}
                onTranscribeDirect={chat.transcribeDirect}
              />
            </motion.section>
          </motion.main>
        )}
      </TabsContent>

      <TabsContent
        forceMount
        value="projects"
        className="min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <ProjectsView focusId={chat.createdProject?.id} />
      </TabsContent>

      <TabsContent
        forceMount
        value="live"
        className="min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <LiveView />
      </TabsContent>
      <TabsContent
        forceMount
        value="audio"
        className="min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        <AudioToolsView
          video={chat.proposal}
          transcribeOptions={chat.transcribeOptions}
          onTranscribeOptionsChange={chat.setTranscribeOptions}
        />
      </TabsContent>
    </Tabs>
  );
}
