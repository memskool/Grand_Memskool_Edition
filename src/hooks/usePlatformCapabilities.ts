import { useQuery } from "@tanstack/react-query";
import { getPlatformCapabilities } from "@/lib/capabilities.functions";

export function usePlatformCapabilities() {
  return useQuery({
    queryKey: ["platform-capabilities"],
    queryFn: () => getPlatformCapabilities(),
    staleTime: 60_000,
  });
}
