import { useQuery } from "@tanstack/react-query";
import { getPage } from "../api/pages";
import { useAuth } from "../auth/useAuth";

export function usePage(slug: string | undefined, locale: string) {
  const { session } = useAuth();
  const activeSiteId = session?.activeSite?.id ?? null;

  return useQuery({
    queryKey: ["page", activeSiteId, slug, locale],
    queryFn: () => getPage(slug!, locale),
    enabled: !!slug && !!activeSiteId,
  });
}
