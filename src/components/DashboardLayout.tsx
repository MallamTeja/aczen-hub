import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { CalendarDays, CalendarRange, LayoutDashboard, ListTodo, LogOut, Mail, Megaphone, Menu, MessageSquare, PalmtreeIcon, Target, Upload, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import NotificationBell from "@/components/NotificationBell";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "CRM", path: "/crm", icon: Target },
  { label: "Social", path: "/social", icon: Megaphone },
  { label: "Assignments", path: "/assignments", icon: ListTodo },
  { label: "My Calendar", path: "/calendar", icon: CalendarDays },
  { label: "Company", path: "/company-calendar", icon: CalendarRange },
  { label: "Leaves", path: "/leaves", icon: PalmtreeIcon },
  { label: "Chat", path: "/chat", icon: MessageSquare },
  { label: "Email", path: "/email", icon: Mail },
  { label: "Uploads", path: "/uploads", icon: Upload },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const userInitial = user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "U";
  const userDisplayName = user?.fullName || user?.emailAddresses?.[0]?.emailAddress || "User";
  const currentLabel = navItems.find((n) => n.path === location.pathname)?.label || "Aczen Connect";

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
          <div className="flex items-center gap-2.5 p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-warm shadow-glow">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="block text-base font-bold text-sidebar-foreground leading-tight">Aczen Connect</span>
              <span className="block text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Workspace</span>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary shadow-soft"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive && "text-sidebar-primary")} />
                  {item.label}
                  {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-warm text-xs font-semibold text-primary-foreground shadow-soft">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">{userDisplayName}</p>
                <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Online</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={() => signOut().then(() => navigate("/login"))}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          {/* Desktop top bar */}
          <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/80 backdrop-blur md:block">
            <div className="flex h-14 items-center justify-between px-6">
              <div>
                <p className="text-sm font-semibold">{currentLabel}</p>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
              </div>
            </div>
          </header>

          {/* Mobile top bar */}
          <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur md:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-warm">
                  <Zap className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="text-sm font-semibold">Aczen Connect</span>
              </div>

              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-6xl px-4 py-4 pb-24 sm:px-6 sm:py-6 md:px-8 md:pb-8">{children}</div>
          </main>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[84vw] max-w-sm border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2.5 border-b border-sidebar-border p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-warm shadow-glow">
                <Zap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">Aczen Connect</span>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-sidebar-border p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full gradient-warm text-sm font-semibold text-primary-foreground">
                  {userInitial}
                </div>
                <p className="truncate text-sm font-medium">{userDisplayName}</p>
              </div>
              <Button
                variant="secondary"
                className="w-full justify-center gap-2"
                onClick={() => signOut().then(() => navigate("/login"))}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-1 pb-1 pt-2 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 text-[10px] font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/70",
                )}
              >
                <item.icon className={cn("mb-1 h-4 w-4", isActive && "text-primary")} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
