export type TabId = "today" | "history" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "today", label: "Inicio" },
  { id: "history", label: "Historial" },
  { id: "settings", label: "Ajustes" },
];

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur
                 dark:border-slate-800 dark:bg-slate-950/95
                 md:static md:border-none md:bg-transparent md:backdrop-blur-0 md:dark:bg-transparent"
    >
      <div className="mx-auto flex max-w-3xl justify-around md:justify-start md:gap-1 md:px-0">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-colors md:flex-none md:rounded-lg md:px-4 md:py-2 ${
                isActive
                  ? "text-accent-600 dark:text-accent-400 md:bg-accent-50 md:dark:bg-accent-900/30"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
