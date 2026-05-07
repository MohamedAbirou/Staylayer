import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { getPages } from "../api/pages";

interface UsePagesFilters {
  locale?: string | null;
  published?: boolean;
  deleted?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

export function usePages(filters?: UsePagesFilters) {
  const { session } = useAuth();
  const activeSiteId = session?.activeSite?.id ?? null;

  return useQuery({
    queryKey: ["pages", activeSiteId, filters],
    queryFn: () =>
      getPages({
        locale: filters?.locale ?? undefined,
        published: filters?.published,
        deleted: filters?.deleted,
        page: filters?.page,
        limit: filters?.limit ?? 50,
        search: filters?.search,
      }),
    enabled: !!activeSiteId,
  });
}
