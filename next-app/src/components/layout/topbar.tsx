"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Breadcrumbs } from "./breadcrumbs";
import { MobileSidebar } from "./mobile-sidebar";
import { WalletTicker } from "./wallet-ticker";

export function Topbar() {
  return (
    <header className="flex h-[var(--topbar-height)] items-center gap-4 border-b bg-background/80 px-6 backdrop-blur-sm">
      <MobileSidebar />

      <div className="flex-1">
        <Breadcrumbs />
      </div>

      {/* Wallet Ticker */}
      <WalletTicker />

      {/* Search */}
      <div className="hidden items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground md:flex">
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="ml-4 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium">
          /
        </kbd>
      </div>

      <div className="flex items-center gap-1">
        {/* Notifications */}
        <button
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
        </button>

        <ThemeToggle />

        <div className="ml-1 h-6 w-px bg-border" />

        <div className="ml-1">
          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_") && (
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
