"use client";

import { useState, useEffect, memo, useMemo, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  Database,
  DollarSign,
  Layers,
  List,
  Menu,
  Moon,
  Network,
  Newspaper,
  Settings,
  Sun,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

const SidebarNavigation = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Memoize nav items to prevent recreation on every render
  const navItems = useMemo(() => [
    { href: "/screener", icon: Activity, label: "Screener" },
    { href: "/fills", icon: List, label: "Fills" },
    { href: "/network", icon: Network, label: "Network" },
    { href: "/analytics", icon: Database, label: "Analytics" },
    { href: "/snapshot", icon: Layers, label: "Perp Snapshot" },
    { href: "/", icon: BarChart3, label: "Markets" },
    { href: "#", icon: TrendingUp, label: "Pivot Analysis" },
    { href: "#", icon: DollarSign, label: "Currencies" },
    { href: "#", icon: Newspaper, label: "News" },
  ], []);

  const isNavItemActive = useCallback((href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }, [pathname]);

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded bg-card border hover:bg-accent/10 transition-colors"
        onClick={() => setIsMobileMenuOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "relative flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out will-change-[width,transform] z-40",
          "shadow-[0_0_10px_rgba(255,186,0,0.1),_inset_0_0_10px_rgba(255,186,0,0.05)]",
          isCollapsed ? "lg:w-20" : "lg:w-64",
          isMobileMenuOpen
            ? "fixed inset-y-0 left-0 w-64 translate-x-0"
            : "fixed inset-y-0 left-0 w-64 -translate-x-full lg:static lg:translate-x-0"
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center border-b border-sidebar-border px-4 overflow-hidden",
            isCollapsed ? "lg:justify-center lg:px-0" : "justify-between"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Icon logo - visible when collapsed */}
            <Image
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/icon-white-1763203953885.png?width=8000&height=8000&resize=contain"
              alt="SIZE"
              width={32}
              height={32}
              className={cn(
                "h-8 w-8 object-contain transition-opacity duration-200 flex-shrink-0",
                isCollapsed ? "lg:opacity-100" : "lg:opacity-0 lg:absolute lg:pointer-events-none"
              )}
              style={{ filter: "drop-shadow(0 0 8px rgba(255, 186, 0, 0.5))" }}
              priority
            />
            {/* Wordmark logo - visible when expanded */}
            <Image
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/document-uploads/wordmark-dark-1-1763203748174.png?width=8000&height=8000&resize=contain"
              alt="SIZE"
              width={120}
              height={32}
              className={cn(
                "h-8 w-auto object-contain transition-opacity duration-200 flex-shrink-0",
                isCollapsed ? "lg:opacity-0 lg:absolute lg:pointer-events-none" : "lg:opacity-100"
              )}
              style={{ filter: "drop-shadow(0 0 8px rgba(255, 186, 0, 0.5))" }}
              priority
            />
          </div>
          <button
            className="lg:hidden p-1 rounded hover:bg-accent/10 flex-shrink-0"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors cursor-pointer relative z-10 overflow-hidden",
                isNavItemActive(item.href)
                  ? "text-primary text-shadow-[0_0_8px_rgba(255,186,0,0.5)] bg-[var(--accent-background)]"
                  : "text-sidebar-foreground hover:bg-accent/10 hover:text-primary",
                isCollapsed && "lg:justify-center"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-opacity duration-200",
                  isCollapsed && "lg:opacity-0 lg:pointer-events-none lg:hidden"
                )}
              >
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2 space-y-1">
          <button 
            onClick={toggleTheme}
            className={cn(
              "flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-accent/10 hover:text-primary transition-colors overflow-hidden group", 
              isCollapsed && "lg:justify-center"
            )}
          >
            <div className="relative h-5 w-5 flex-shrink-0">
              {theme === "light" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </div>
            <span className={cn("whitespace-nowrap transition-opacity", isCollapsed ? "lg:opacity-0 lg:hidden" : "opacity-100")}>
              {theme === "light" ? "Light Mode" : "Dark Mode"}
            </span>
            <div className={cn("ml-auto flex-shrink-0 transition-opacity", isCollapsed ? "lg:opacity-0 lg:hidden" : "opacity-100")}>
              <div className="relative w-9 h-5 bg-muted rounded-full">
                <div className={cn(
                  "absolute top-0.5 h-4 w-4 bg-primary rounded-full shadow-sm transition-all duration-200",
                  theme === "light" ? "right-0.5" : "left-0.5"
                )}></div>
              </div>
            </div>
          </button>

          <button className={cn("flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-accent/10 hover:text-primary transition-colors overflow-hidden", isCollapsed && "lg:justify-center")}>
            <Settings className="h-5 w-5 flex-shrink-0" />
            <span className={cn("whitespace-nowrap transition-opacity", isCollapsed ? "lg:opacity-0 lg:hidden" : "opacity-100")}>Settings</span>
          </button>
          
          <button className={cn("flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-accent/10 hover:text-primary transition-colors overflow-hidden", isCollapsed && "lg:justify-center")}>
            <User className="h-5 w-5 flex-shrink-0" />
            <span className={cn("whitespace-nowrap transition-opacity", isCollapsed ? "lg:opacity-0 lg:hidden" : "opacity-100")}>Profile</span>
          </button>
        </div>

        <button
          className="hidden lg:flex absolute -right-3 top-20 h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-primary hover:bg-accent/10 transition-colors z-50"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label="Toggle sidebar"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-200 ease-in-out",
              isCollapsed && "rotate-180"
            )}
          />
        </button>
      </aside>
    </>
  );
};

export default SidebarNavigation;