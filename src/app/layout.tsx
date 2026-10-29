import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import { getServerSession } from "next-auth";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import {
  PersonalWalletHeader,
  PersonalWalletProvider,
} from "@/components/wallet/personal-wallet";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();

  return {
    title: settings.siteTitle,
    description: settings.heroSubheading,
    icons: { icon: settings.faviconUrl ?? "/favicon.ico" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const [settings, session] = await Promise.all([
    getSiteSettings(),
    getServerSession(authOptions),
  ]);
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, coinsBalance: true },
      })
    : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{
          "--accent-color": settings.accentColor,
          "--hero-background-image": settings.heroBackgroundImage
            ? `url(${JSON.stringify(new URL(settings.heroBackgroundImage).href)})`
            : "none",
        } as React.CSSProperties}
      >
        <AuthSessionProvider>
          <PersonalWalletProvider
            key={user?.id ?? "anonymous"}
            initialBalance={user?.coinsBalance ?? 0}
          >
            {user && <PersonalWalletHeader />}
            {children}
          </PersonalWalletProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
