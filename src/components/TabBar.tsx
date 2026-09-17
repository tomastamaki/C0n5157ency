import { IconHistory, IconHome, IconSettings } from "./icons";

export type TabId = "today" | "history" | "settings";

const TABS: { id: TabId; label: string; Icon: typeof IconHome }[] = [
  { id: "today", label: "Inicio", Icon: IconHome },
  { id: "history", label: "Historial", Icon: IconHistory },
  { id: "settings", label: "Ajustes", Icon: IconSettings },
];

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ active, onChange }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur
                 md:static md:border-none md:bg-transparent md:backdrop-blur-0"
    >
      <div className="mx-auto flex max-w-3xl justify-around md:justify-start md:gap-1 md:px-0">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition-opacity active:opacity-70 md:flex-none md:flex-row md:gap-2 md:rounded-pill md:px-4 md:py-2 md:transition-colors md:hover:bg-surface2 ${
                isActive ? "text-primary md:bg-primary/10" : "text-faint"
              }`}
            >
              <Icon className="h-[22px] w-[22px]" />
              <span className="text-[11px] font-medium md:text-sm">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
