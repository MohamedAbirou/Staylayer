import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePage } from "../api/pages";

interface SavePageVariables {
  slug: string;
  locale: string;
  puckData: Record<string, unknown>;
  title?: string;
}

export function useSavePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, locale, puckData, title }: SavePageVariables) => {
      // Sync SEO fields from puckData.root.props → dedicated DB columns so
      // the website can read them directly from cmsPage.seoTitle etc.
      const rootProps =
        ((puckData?.root as Record<string, unknown>)?.props as Record<
          string,
          string
        >) ?? {};
      return updatePage(slug, locale, {
        puckData,
        title,
        seoTitle: rootProps.seoTitle || undefined,
        seoDescription: rootProps.seoDescription || undefined,
        seoKeywords: rootProps.seoKeywords || undefined,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["page", variables.slug, variables.locale],
      });
      queryClient.invalidateQueries({ queryKey: ["pages"] });
    },
  });
}
