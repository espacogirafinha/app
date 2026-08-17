import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPin,
  MoreHorizontal,
  PartyPopper,
  Settings,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/venue-events", label: "Festas no Espaço", icon: PartyPopper },
  { href: "/external-events", label: "Serviços Externos", icon: MapPin },
  { href: "/workshops", label: "Workshops/Formações", icon: GraduationCap },
  { href: "/calendar", label: "Calendário", icon: Calendar },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/settings", label: "Definições", icon: Settings },
];

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/venue-events", label: "Festas", icon: PartyPopper },
  { href: "/external-events", label: "Serviços", icon: MapPin },
  { href: "/calendar", label: "Calendário", icon: Calendar },
];

const MORE_NAV_ITEMS = NAV_ITEMS.filter((item) => ["/workshops", "/reports", "/settings"].includes(item.href));

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      {!isMobile && (
        <aside className="hidden w-64 flex-col border-r border-border bg-card md:flex">
          <div className="flex h-16 items-center border-b border-border px-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl text-primary">
              Espaço Girafinha
            </Link>
          </div>
          <nav className="flex-1 space-y-2 p-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(location, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-border p-4">
            <Button
              variant="ghost"
              onClick={logout}
              className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </Button>
          </div>
        </aside>
      )}

      <div className="flex flex-1 flex-col">
        {isMobile && (
          <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
            <span className="w-9" />
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-primary">
              Espaço Girafinha
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Sair"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </header>
        )}
        <main className={`flex-1 overflow-auto p-4 md:p-8 ${isMobile ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : ""}`}>
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>

        {isMobile && (
          <nav
            className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-lg"
            aria-label="Navegação principal"
          >
            {MOBILE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(location, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="max-w-full truncate text-center text-[11px] font-medium leading-none">{item.label}</span>
                </Link>
              );
            })}
            <MobileMoreMenu location={location} />
          </nav>
        )}
      </div>
    </div>
  );
}

function MobileMoreMenu({ location }: { location: string }) {
  const isActive = MORE_NAV_ITEMS.some((item) => isNavItemActive(location, item.href));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${
            isActive ? "text-primary" : "text-muted-foreground"
          }`}
          aria-label="Abrir mais opções"
          aria-current={isActive ? "page" : undefined}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" />
          <span className="text-center text-[11px] font-medium leading-none">Mais</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Mais opções</SheetTitle>
          <SheetDescription>Acede às restantes áreas de gestão.</SheetDescription>
        </SheetHeader>
        <nav className="mt-2 grid gap-2" aria-label="Mais opções">
          {MORE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const itemIsActive = isNavItemActive(location, item.href);
            return (
              <SheetClose asChild key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    itemIsActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                  }`}
                  aria-current={itemIsActive ? "page" : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              </SheetClose>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function isNavItemActive(location: string, href: string) {
  const [locationPath] = location.split("?");

  if (href === "/dashboard") return locationPath === "/" || locationPath === "/dashboard";

  return locationPath === href || locationPath.startsWith(`${href}/`);
}
