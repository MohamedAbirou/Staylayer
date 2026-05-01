import { useQuery } from "@tanstack/react-query";
import { getPage } from "../api/pages";

export function usePage(slug: string | undefined, locale: string) {
  return useQuery({
    queryKey: ["page", slug, locale],
    queryFn: () => getPage(slug!, locale),
    enabled: !!slug,
  });
}
