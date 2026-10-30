import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const SITE_SETTINGS_ID = "global";

export const DEFAULT_SITE_SETTINGS = {
  id: SITE_SETTINGS_ID,
  siteTitle: "Draft League",
  heroHeadline: "Your next great draft starts here.",
  heroSubheading: "Build your roster, challenge the field, and make your run count.",
  heroBackgroundImage: null,
  faviconUrl: null,
  siteLogoUrl: null,
  accentColor: "#F5C542",
  initialPlayerCoins: 500,
};

export const getSiteSettings = cache(async function getSiteSettings() {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ID },
  });

  return settings ?? DEFAULT_SITE_SETTINGS;
});
