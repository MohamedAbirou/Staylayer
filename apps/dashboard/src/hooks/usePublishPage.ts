import { useMutation, useQueryClient } from "@tanstack/react-query";
import { publishPage, unpublishPage } from "../api/pages";
import { useAuth } from "../auth/useAuth";

export function usePublishPage() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const activeSiteId = session?.activeSite?.id ?? null;

  return useMutation({
    mutationFn: ({
      slug,
      locale,
      publish,
    }: {
      slug: string;
      locale: string;
      publish: boolean;
    }) => (publish ? publishPage(slug, locale) : unpublishPage(slug, locale)),
    onSuccess: (_data, { slug, locale }) => {
      queryClient.invalidateQueries({ queryKey: ["pages", activeSiteId] });
      queryClient.invalidateQueries({
        queryKey: ["page", activeSiteId, slug, locale],
      });
    },
  });
}
