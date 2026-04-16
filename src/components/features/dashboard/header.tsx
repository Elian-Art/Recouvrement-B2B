import { LogOut, Settings } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/supabase/actions'
import type { UserProfile } from '@/types/database'

interface HeaderProps {
  user: UserProfile
  orgName: string
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email.slice(0, 2).toUpperCase()
}

export function Header({ user, orgName }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <p className="text-sm font-medium text-muted-foreground">{orgName}</p>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">
                {getInitials(user.full_name, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">{user.full_name ?? user.email}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-0.5">
              <p className="text-sm font-medium">{user.full_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/settings/organization" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <form action={signOut} className="w-full">
              <button type="submit" className="flex w-full items-center cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Se déconnecter
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
