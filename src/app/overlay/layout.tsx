export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Figtree:wght@400..800&display=swap"
        rel="stylesheet"
      />
      <style>{`html, body { background: transparent !important; overflow: hidden; }`}</style>
      <div className="overlay-root">{children}</div>
    </>
  );
}
