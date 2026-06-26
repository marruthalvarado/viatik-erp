import { Bell, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function NotificationsCenter() {
  // Notifications will come from backend. UI shell only.
  const notifications: never[] = [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="size-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <div>
            <h4 className="text-sm font-semibold">Notificaciones</h4>
            <p className="text-xs text-muted-foreground">Centro de actividad</p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled>
            Marcar todo
          </Button>
        </div>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2 h-9">
            <TabsTrigger value="all" className="text-xs">Todas</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">No leídas</TabsTrigger>
            <TabsTrigger value="mentions" className="text-xs">Menciones</TabsTrigger>
          </TabsList>
          {(["all", "unread", "mentions"] as const).map((v) => (
            <TabsContent key={v} value={v} className="m-0">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Inbox className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">Sin notificaciones</p>
                  <p className="text-xs text-muted-foreground">
                    Cuando haya actividad, aparecerá aquí.
                  </p>
                </div>
              ) : null}
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
