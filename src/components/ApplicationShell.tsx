"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

type ApplicationShellProps = {
  accentColor: string;
  siteLogoUrl: string | null;
  siteTitle: string;
  shopHref: string | null;
  user: {
    name: string;
    email?: string | null;
    role?: string;
    image?: string | null;
  } | null;
  children: React.ReactNode;
};

export default function ApplicationShell(props: ApplicationShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  if (pathname.startsWith("/t/")) {
    return props.children;
  }

  return (
    <>
      <Sidebar
        accentColor={props.accentColor}
        siteLogoUrl={props.siteLogoUrl}
        siteTitle={props.siteTitle}
        shopHref={props.shopHref}
        user={props.user}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="min-h-screen md:ml-64">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        {props.children}
      </div>
    </>
  );
}
