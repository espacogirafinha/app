import { Link, useLocation } from "wouter";
import { Calendar, GraduationCap, LayoutDashboard, MapPin, PartyPopper, BarChart3, LogOut } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/reservations?type=venue_party", label: "Festas no Espaço", icon: PartyPopper },
  { href: "/reservations?type=external_service", label: "Serviços Externos", icon: MapPin },
  { href: "/reservations?type=workshop", label: "Workshops", icon: GraduationCap },
  { href: "/calendar", label: "Calendário", icon: Calendar },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background md:flex-row">
      {!isMobile && (
        <aside className="hidden w-64 flex-col border-r border-border bg-card md:flex">
          <div className="flex h-16 items-center border-b border-border px-6">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
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
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
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
        <main className={`flex-1 overflow-auto p-4 md:p-8 ${isMobile ? "pb-24" : ""}`}>
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>

        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-card shadow-lg safe-area-bottom">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(location, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center gap-1 px-2 py-3 min-h-[56px] min-w-[56px] transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

function isNavItemActive(location: string, href: string) {
  const [hrefPath, hrefQuery] = href.split("?");
  const [locationPath, locationQuery] = location.split("?");

  if (href === "/") return locationPath === "/";
  if (hrefPath !== "/reservations") return locationPath === hrefPath || locationPath.startsWith(`${hrefPath}/`);
  if (!hrefQuery) return locationPath === "/reservations";

  return locationPath === "/reservations" && locationQuery === hrefQuery;
}

