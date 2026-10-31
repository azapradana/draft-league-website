export type GroupInfo = {
  name: string;
  logoUrl: string | null;
  isCore: boolean;
} | null;

export default function GroupBadge({ group }: { group: GroupInfo | undefined }) {
  if (!group) return null;
  return (
    <span
      data-testid="group-badge"
      title={group.isCore ? "7DS member" : `Rival group: ${group.name}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${
        group.isCore
          ? "border-[#F5C542] bg-[#F5C542]/15 text-[#F5C542]"
          : "border-sky-400/60 bg-sky-500/10 text-sky-300"
      }`}
    >
      {group.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={group.logoUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
      )}
      {group.name}
    </span>
  );
}
