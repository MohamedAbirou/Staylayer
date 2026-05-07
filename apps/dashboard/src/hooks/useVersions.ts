import { useQuery } from "@tanstack/react-query";
import { getVersions } from "../api/pages";
import { useAuth } from "../auth/useAuth";

export function useVersions(
  slug: string | undefined,
  locale: string,
  enabled = true,
) {
  const { session } = useAuth();
  const activeSiteId = session?.activeSite?.id ?? null;

  return useQuery({
    queryKey: ["versions", activeSiteId, slug, locale],
    queryFn: () => getVersions(slug!, locale),
    enabled: !!slug && !!activeSiteId && enabled,
  });
}
