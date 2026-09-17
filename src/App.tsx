import { useState } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import { findActiveDraft } from "./lib/schedule";
import { TabBar, type TabId } from "./components/TabBar";
import { ThemeToggle } from "./components/ThemeToggle";
import { Wordmark } from "./components/Wordmark";
import { Watermark } from "./components/Watermark";
import { TodayScreen } from "./screens/Today";
import { HistoryScreen } from "./screens/History";
import { SettingsScreen } from "./screens/Settings";
import { ActiveWorkoutScreen, WorkoutSummary } from "./screens/ActiveWorkout";
import type { WorkoutSession } from "./types/logs";

function AppShell() {
  const { flatDays, logs } = useApp();
  const [tab, setTab] = useState<TabId>("today");
  const [viewingWorkout, setViewingWorkout] = useState(false);
  const [completedSession, setCompletedSession] = useState<WorkoutSession | null>(null);

  const activeDraft = findActiveDraft(logs);
  const draftFlatDay = activeDraft ? flatDays[activeDraft.programIndex] ?? null : null;

  function handleTabChange(next: TabId) {
    setTab(next);
    setViewingWorkout(false);
    setCompletedSession(null);
  }

  let content;
  if (completedSession) {
    content = <WorkoutSummary session={completedSession} onContinue={() => setCompletedSession(null)} />;
  } else if (viewingWorkout && activeDraft && draftFlatDay) {
    content = (
      <ActiveWorkoutScreen
        draft={activeDraft}
        flatDay={draftFlatDay}
        onExit={() => setViewingWorkout(false)}
        onFinish={(session) => {
          setCompletedSession(session);
          setViewingWorkout(false);
        }}
      />
    );
  } else if (tab === "today") {
    content = (
      <TodayScreen
        activeDraft={activeDraft}
        onNavigateHistory={() => handleTabChange("history")}
        onResumeWorkout={() => setViewingWorkout(true)}
      />
    );
  } else if (tab === "history") {
    content = <HistoryScreen activeDraft={activeDraft} onResumeWorkout={() => setViewingWorkout(true)} />;
  } else {
    content = <SettingsScreen />;
  }

  return (
    <div className="relative mx-auto min-h-screen max-w-3xl px-4 pt-6 md:flex md:gap-8 md:px-8">
      <Watermark />
      <aside className="relative z-10 hidden shrink-0 md:block md:w-40">
        <div className="mb-6 flex items-center justify-between">
          <Wordmark className="text-lg" />
        </div>
        <div className="mb-6">
          <ThemeToggle />
        </div>
        <TabBar active={tab} onChange={handleTabChange} />
      </aside>
      <main className="relative z-10 flex-1 md:max-w-2xl">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <Wordmark className="text-lg" />
          <ThemeToggle compact />
        </div>
        {content}
      </main>
      <div className="relative z-10 md:hidden">
        <TabBar active={tab} onChange={handleTabChange} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
