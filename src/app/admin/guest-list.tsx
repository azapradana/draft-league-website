import Link from "next/link";
import { GuestAccessButton } from "./t/[id]/guest-access-button";

export type GuestRow = {
  id: string;
  username: string | null;
  name: string | null;
  boundTournament: { id: string; name: string } | null;
};

export function GuestList({
  guests,
  showTournament = true,
}: {
  guests: GuestRow[];
  showTournament?: boolean;
}) {
  if (guests.length === 0) {
    return <p className="mt-4 text-sm text-[#9FB0E6]">No guests have registered yet.</p>;
  }

  return (
    <ul className="mt-4 divide-y divide-[#243775] rounded-lg border border-[#243775]">
      {guests.map((guest) => (
        <li key={guest.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{guest.username ?? guest.name ?? guest.id}</p>
            {showTournament && (
              <p className="text-sm text-[#9FB0E6]">
                Bound to{" "}
                {guest.boundTournament ? (
                  <Link
                    href={`/admin/t/${guest.boundTournament.id}`}
                    className="text-[#F5C542] hover:underline"
                  >
                    {guest.boundTournament.name}
                  </Link>
                ) : (
                  "no tournament"
                )}
              </p>
            )}
          </div>
          <GuestAccessButton
            action="unlockGuest"
            label="Unlock guest"
            pendingLabel="Unlocking…"
            payload={{ userId: guest.id }}
            confirmMessage={`Unlock ${guest.username ?? "this guest"}? They become a regular player with full site access.`}
          />
        </li>
      ))}
    </ul>
  );
}
