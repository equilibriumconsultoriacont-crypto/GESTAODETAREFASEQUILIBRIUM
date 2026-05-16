import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useMemo } from "react";

export function useAuth() {
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      window.location.href = "/";
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return;
      // Always redirect on logout even if it fails
      window.location.href = "/";
    }
  }, [logoutMutation]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: meQuery.isLoading,
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
  }), [meQuery.data, meQuery.error, meQuery.isLoading]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
