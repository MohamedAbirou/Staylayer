import {
  buildManifestIcons,
  getManifestName,
  getRuntimeSiteMetadata,
} from "@/lib/runtime/tenant-metadata";

export const dynamic = "force-dynamic";

function buildShortName(name) {
  if (name.length <= 24) {
    return name;
  }

  return `${name.slice(0, 21).trim()}...`;
}

export default async function manifest() {
  const { payload } = await getRuntimeSiteMetadata("/");
  const name = getManifestName(payload);

  return {
    name,
    short_name: buildShortName(name),
    description: payload?.page?.seo?.description || undefined,
    lang: payload?.site?.defaultLocale || "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: buildManifestIcons(payload),
  };
}