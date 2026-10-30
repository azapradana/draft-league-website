"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

export type SwissRoundTab = {
  value: string;
  label: string;
  status: "completed" | "in-progress" | "upcoming";
  content: ReactNode;
};

const statusLabels: Record<SwissRoundTab["status"], string> = {
  completed: "Completed",
  "in-progress": "In progress",
  upcoming: "Upcoming",
};

const statusIndicatorClasses: Record<SwissRoundTab["status"], string> = {
  completed: "bg-emerald-400",
  "in-progress": "bg-blue-400 motion-safe:animate-pulse",
  upcoming: "bg-slate-400",
};

export default function SwissRoundTabs({
  tabs,
  initialRound,
}: {
  tabs: SwissRoundTab[];
  initialRound: string;
}) {
  const [selectedRound, setSelectedRound] = useState(initialRound);

  useEffect(() => {
    if (!tabs.some((tab) => tab.value === selectedRound)) {
      setSelectedRound(tabs[0]?.value ?? "");
    }
  }, [selectedRound, tabs]);

  useEffect(() => {
    function syncRoundFromUrl() {
      const requestedRound = new URLSearchParams(window.location.search).get("round");
      setSelectedRound(
        requestedRound && tabs.some((tab) => tab.value === requestedRound)
          ? requestedRound
          : initialRound,
      );
    }

    window.addEventListener("popstate", syncRoundFromUrl);
    return () => window.removeEventListener("popstate", syncRoundFromUrl);
  }, [initialRound, tabs]);

  const activeTab = tabs.find((tab) => tab.value === selectedRound) ?? tabs[0];
  if (!activeTab) return null;

  function selectRound(value: string) {
    setSelectedRound(value);

    const url = new URL(window.location.href);
    url.searchParams.set("round", value);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    selectRound(nextTab.value);
    document.getElementById(`round-tab-${nextTab.value}`)?.focus();
  }

  return (
    <div className="mt-5 min-w-0">
      <div
        aria-label="Tournament rounds"
        className="overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory touch-pan-x"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div
          className="flex w-max min-w-full flex-nowrap gap-2 border-b border-[#243775]"
          role="tablist"
        >
          {tabs.map((tab, index) => {
            const isSelected = tab.value === activeTab.value;

            return (
              <button
                key={tab.value}
                id={`round-tab-${tab.value}`}
                aria-controls={isSelected ? `round-panel-${tab.value}` : undefined}
                aria-label={`${tab.label}, ${statusLabels[tab.status]}`}
                aria-selected={isSelected}
                className={`inline-flex min-h-12 shrink-0 snap-start items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#F5C542] ${
                  isSelected
                    ? "border-[#F5C542] text-[#F5C542]"
                    : "border-transparent text-[#9FB0E6] hover:border-[#9FB0E6]/50 hover:text-[#EEF2FF]"
                }`}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                onClick={() => selectRound(tab.value)}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                type="button"
              >
                {tab.label}
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${statusIndicatorClasses[tab.status]}`}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div
        aria-labelledby={`round-tab-${activeTab.value}`}
        className="pt-5"
        id={`round-panel-${activeTab.value}`}
        role="tabpanel"
        tabIndex={0}
      >
        {activeTab.content}
      </div>
    </div>
  );
}
