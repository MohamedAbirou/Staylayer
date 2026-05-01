import { useMutation, useQueryClient } from "@tanstack/react-query";
import { publishPage, unpublishPage } from "../api/pages";

export function usePublishPage() {
  const queryClient = useQueryClient();

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
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["page", slug, locale] });
    },
  });
}
