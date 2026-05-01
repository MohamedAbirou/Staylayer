import { useQuery } from "@tanstack/react-query";
import { getVersions } from "../api/pages";

export function useVersions(
  slug: string | undefined,
  locale: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["versions", slug, locale],
    queryFn: () => getVersions(slug!, locale),
    enabled: !!slug && enabled,
  });
}
