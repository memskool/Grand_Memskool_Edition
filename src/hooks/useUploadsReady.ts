import { usePlatformCapabilities } from "@/hooks/usePlatformCapabilities";

/** false only once the server has confirmed Storage is unavailable (never blocks while loading). */
export function useUploadsReady(): boolean {
  const { data } = usePlatformCapabilities();
  return data?.storage !== false;
}
