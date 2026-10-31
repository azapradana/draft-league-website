export default function TeamLoading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-[#122050]" />
      <div className="h-72 animate-pulse rounded-2xl bg-[#0C1638]" />
    </div>
  );
}
