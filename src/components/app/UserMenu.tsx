import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { signOut } from "@/features/auth/services/auth.service";
import { useSession, useProfile, useRole } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: profile } = useProfile(user);
  const { data: role } = useRole(user);

  const name = profile?.full_name || user?.email || "Account";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {role ? (
        <Badge
          variant="outline"
          className="hidden rounded-full border-gold/40 bg-gold/10 capitalize text-foreground sm:inline-flex"
        >
          {role}
        </Badge>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="rounded-full outline-none ring-ring focus-visible:ring-2"
        >
          <Avatar className="size-11">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
              {initials || <UserIcon className="size-4" />}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs font-normal text-muted-foreground">{user?.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            <Settings className="mr-2 size-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSignOut}>
            <LogOut className="mr-2 size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
