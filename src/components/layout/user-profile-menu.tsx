import { useState } from "react";
import { LogOut, Settings, User, CreditCard, LifeBuoy, Info } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { AboutDialog } from "./about-dialog";
import { EditProfileDialog } from "./edit-profile-dialog";

export function UserProfileMenu() {
  const { user, signOut } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const email = user?.email ?? "Invitado";
  const initials = (user?.email ?? "VT").split("@")[0].slice(0, 2).toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-1.5">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="text-sm font-medium truncate">{email}</span>
              <span className="text-xs text-muted-foreground">
                {user ? "Sesion activa" : "Conecta tu cuenta"}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setProfileOpen(true)}>
              <User className="mr-2 size-4" /> Editar perfil
            </DropdownMenuItem>
            <DropdownMenuItem disabled aria-disabled="true">
              <Settings className="mr-2 size-4" /> Configuracion
            </DropdownMenuItem>
            <DropdownMenuItem disabled aria-disabled="true">
              <CreditCard className="mr-2 size-4" /> Facturacion
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled aria-disabled="true">
            <LifeBuoy className="mr-2 size-4" /> Soporte
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAboutOpen(true)}>
            <Info className="mr-2 size-4" /> Acerca del sistema
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!user} onClick={() => void signOut()}>
            <LogOut className="mr-2 size-4" /> Cerrar sesion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
