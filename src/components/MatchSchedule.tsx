"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInZone, zonedToUtc } from "@/lib/schedule-time";

type Snapshot = {
  scheduledAt: string | null;
  viewer: { isAdmin: boolean; participantId: string | null; isPlayer: boolean; timezone: string | null };
  players: Array<{ participantId: string; name: string; timezone: string | null; isSelf: boolean }>;
  options: Array<{ id: string; proposedById: string; proposedByName: string; startsAt: string }>;
};

function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function allZones(current: string) {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const zones = supported ? supported("timeZone") : [];
  return zones.includes(current) ? zones : [current, ...zones];
}

const rowButton =
  "shrink-0 rounded-lg border border-[#9FB0E6] px-3 py-1 text-xs font-bold text-[#EEF2FF] hover:border-[#F5C542] disabled:cursor-not-allowed disabled:opacity-50";
const goldButton =
  "rounded-lg bg-[#F5C542] px-3 py-1.5 text-sm font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-50";
const inputClass =
  "rounded-lg border border-[#243775] bg-[#070D24] px-2 py-1.5 text-sm text-[#EEF2FF] [color-scheme:dark] focus:border-[#F5C542] focus:outline-none";

export default function MatchSchedule({ endpoint }: { endpoint: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingZone, setEditingZone] = useState(false);
  const [zoneDraft, setZoneDraft] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const request = useCallback(
    async (init?: { action: string; [key: string]: unknown }) => {
      const response = await fetch(endpoint, {
        method: init ? "POST" : "GET",
        headers: init ? { "Content-Type": "application/json" } : undefined,
        body: init ? JSON.stringify(init) : undefined,
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as Snapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "The schedule could not be updated.");
      return payload;
    },
    [endpoint],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let snapshot = await request();
        if (!snapshot.viewer.timezone) {
          snapshot = await request({ action: "timezone", timezone: browserZone() });
        }
        if (active) setData(snapshot);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "The schedule could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [request]);

  const zone = data?.viewer.timezone ?? browserZone();
  const zones = useMemo(() => allZones(zoneDraft || zone), [zone, zoneDraft]);

  async function run(action: { action: string; [key: string]: unknown }, onDone?: () => void) {
    setBusy(true);
    setError("");
    try {
      setData(await request(action));
      onDone?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The schedule could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  function submitTime(action: "add" | "set") {
    const startsAt = zonedToUtc(date, time, zone);
    if (!startsAt) {
      setError("Enter a date and a time.");
      return;
    }
    if (startsAt.getTime() <= Date.now()) {
      setError("Choose a time in the future.");
      return;
    }
    void run({ action, startsAt: startsAt.toISOString() }, () => {
      setDate("");
      setTime("");
    });
  }

  const agreed = data?.scheduledAt ? formatInZone(data.scheduledAt, zone, true) : null;
  const canCancel = Boolean(data?.scheduledAt) && Boolean(data?.viewer.isAdmin || data?.viewer.isPlayer);
  const others = data?.players.filter((player) => !player.isSelf) ?? [];

  return (
    <section aria-labelledby="schedule-heading" className="rounded-xl border border-[#243775] bg-[#0C1638] p-3">
      <h2 id="schedule-heading" className="text-sm font-bold">
        Schedule
      </h2>

      {loading ? (
        <p className="mt-2 text-xs text-[#9FB0E6]">Loading schedule…</p>
      ) : !data ? (
        <p role="alert" className="mt-2 text-xs text-red-200">
          {error || "The schedule could not be loaded."}
        </p>
      ) : (
        <div className="mt-2 divide-y divide-[#243775]">
          <div className="pb-3">
            {agreed ? (
              <>
                <p className="text-lg font-bold text-[#F5C542]">{agreed.main}</p>
                <p className="text-xs font-semibold text-[#9FB0E6]">{agreed.abbreviation}</p>
              </>
            ) : (
              <p className="text-lg font-bold text-[#9FB0E6]">No time agreed yet</p>
            )}
            {canCancel && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run({ action: "cancel" })}
                className="mt-2 text-xs font-semibold text-red-300 underline hover:text-red-200 disabled:opacity-50"
              >
                Cancel agreed time
              </button>
            )}
          </div>

          <div className="space-y-1 py-3 text-xs text-[#9FB0E6]">
            {editingZone ? (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="schedule-zone" className="text-[#EEF2FF]">
                  Your time zone:
                </label>
                <select
                  id="schedule-zone"
                  value={zoneDraft}
                  onChange={(event) => setZoneDraft(event.target.value)}
                  className={`${inputClass} max-w-[14rem]`}
                >
                  {zones.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run({ action: "timezone", timezone: zoneDraft }, () => setEditingZone(false))
                  }
                  className={rowButton}
                >
                  Save
                </button>
                <button type="button" onClick={() => setEditingZone(false)} className="font-semibold hover:text-[#EEF2FF]">
                  Cancel
                </button>
              </div>
            ) : (
              <p>
                Your time zone: <span className="font-semibold text-[#EEF2FF]">{zone}</span>{" "}
                <button
                  type="button"
                  onClick={() => {
                    setZoneDraft(zone);
                    setEditingZone(true);
                  }}
                  className="font-semibold text-[#F5C542] hover:underline"
                >
                  [Edit]
                </button>
              </p>
            )}
            {others.map((player) => (
              <p key={player.participantId}>
                {player.name}&apos;s time zone:{" "}
                <span className="font-semibold text-[#EEF2FF]">{player.timezone ?? "Not set"}</span>
              </p>
            ))}
          </div>

          <div className="py-1">
            {data.options.length === 0 ? (
              <p className="py-3 text-xs text-[#9FB0E6]">No times suggested yet. Suggest one that works for you.</p>
            ) : (
              <ul className="divide-y divide-[#243775]">
                {data.options.map((option) => {
                  const own = option.proposedById === data.viewer.participantId;
                  const formatted = formatInZone(option.startsAt, zone);
                  const isAgreed = data.scheduledAt === option.startsAt;
                  return (
                    <li key={option.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#EEF2FF]">
                          {formatted.main} {formatted.abbreviation}
                        </p>
                        <p className="truncate text-xs text-[#9FB0E6]">
                          Suggested by {own ? "you" : option.proposedByName}
                          {isAgreed && " · agreed"}
                        </p>
                      </div>
                      {data.viewer.isPlayer &&
                        (own ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void run({ action: "remove", optionId: option.id })}
                            className={rowButton}
                          >
                            Remove
                          </button>
                        ) : (
                          !isAgreed && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void run({ action: "pick", optionId: option.id })}
                              className="shrink-0 rounded-lg bg-[#F5C542] px-3 py-1 text-xs font-bold text-[#070D24] hover:bg-[#D9A21B] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Pick this time
                            </button>
                          )
                        ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {(data.viewer.isPlayer || data.viewer.isAdmin) && (
            <form
              className="pt-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitTime(data.viewer.isPlayer ? "add" : "set");
              }}
            >
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs text-[#9FB0E6]">
                  Date ({zone})
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={`${inputClass} mt-1 block`}
                  />
                </label>
                <label className="text-xs text-[#9FB0E6]">
                  Time ({zone})
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                    className={`${inputClass} mt-1 block`}
                  />
                </label>
                <button type="submit" disabled={busy || !date || !time} className={goldButton}>
                  {data.viewer.isPlayer ? "Suggest this time" : "Set agreed time"}
                </button>
              </div>
            </form>
          )}

          {error && (
            <p role="alert" className="pt-3 text-xs text-red-200">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
