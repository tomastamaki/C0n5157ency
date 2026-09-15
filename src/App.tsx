import { useState } from "react";
import { AppProvider } from "./context/AppContext";
import { TabBar, type TabId } from "./components/TabBar";
import { TodayScreen } from "./screens/Today";
import { HistoryScreen } from "./screens/History";
import { SettingsScreen } from "./screens/Settings";

function Screen({ tab }: { tab: TabId }) {
  switch (tab) {
    case "today":
      return <TodayScreen />;
    case "history":
      return <HistoryScreen />;
    case "settings":
      return <SettingsScreen />;
  }
}

export default function App() {
  const [tab, setTab] = useState<TabId>("today");

  return (
    <AppProvider>
      <div className="mx-auto min-h-screen max-w-3xl px-4 pt-6 md:flex md:gap-8 md:px-8">
        <aside className="hidden shrink-0 md:block md:w-40">
          <p className="mb-6 text-lg font-bold text-accent-600 dark:text-accent-400">Min-Max</p>
          <TabBar active={tab} onChange={setTab} />
        </aside>
        <main className="flex-1 md:max-w-2xl">
          <Screen tab={tab} />
        </main>
        <div className="md:hidden">
          <TabBar active={tab} onChange={setTab} />
        </div>
      </div>
    </AppProvider>
  );
}
