import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSettings,
  updateSettings,
  getHealth,
  type UpdateSettingsPayload,
} from "../api/settings";
import { useAuth } from "../auth/useAuth";

export function useSettings() {
  const { session } = useAuth();
  const activeSiteId = session?.activeSite?.id ?? null;

  return useQuery({
    queryKey: ["settings", activeSiteId],
    queryFn: getSettings,
    enabled: !!activeSiteId,
    staleTime: 30_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const activeSiteId = session?.activeSite?.id ?? null;

  return useMutation({
    mutationFn: (payload: UpdateSettingsPayload) => updateSettings(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", activeSiteId] });
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
