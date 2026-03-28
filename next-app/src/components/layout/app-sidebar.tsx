"use client";

import {
  LayoutDashboard,
  Flame,
  Droplets,
  Users,
  Calculator,
  Wallet,
  Settings,
  HelpCircle,
  BarChart3,
  Shield,
} from "lucide-react";
import { SidebarNavItem } from "./sidebar-nav-item";
import { Separator } from "@/components/ui/separator";

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-[var(--topbar-height)] items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-500/25">
          U
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-tight text-sidebar-accent-foreground">
            UPA Portal
          </span>
          <span className="text-[11px] leading-tight text-sidebar-foreground/40">
            Adjuster Platform
          </span>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Overview
        </div>
        <SidebarNavItem
          href="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
          onClick={onNavigate}
        />

        <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Lead Operations
        </div>
        <SidebarNavItem
          href="/fire-leads"
          icon={Flame}
          label="Fire Leads"
          onClick={onNavigate}
        />
        <SidebarNavItem
          href="/water-leads"
          icon={Droplets}
          label="Water Leads"
          onClick={onNavigate}
        />

        <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Tools
        </div>
        <SidebarNavItem
          href="/skip-trace-wallet"
          icon={Wallet}
          label="Skip Trace Wallet"
          onClick={onNavigate}
        />
        <SidebarNavItem
          href="/crm"
          icon={Users}
          label="CRM"
          onClick={onNavigate}
        />
        <SidebarNavItem
          href="/estimating"
          icon={Calculator}
          label="Estimating Admin"
          onClick={onNavigate}
        />

        <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          Admin
        </div>
        <SidebarNavItem
          href="/admin/billing"
          icon={BarChart3}
          label="Usage & Billing"
          onClick={onNavigate}
        />
        <SidebarNavItem
          href="/admin/wallets"
          icon={Shield}
          label="Wallet Monitoring"
          onClick={onNavigate}
        />

        <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          System
        </div>
        <SidebarNavItem
          href="/settings"
          icon={Settings}
          label="Settings"
          onClick={onNavigate}
        />
        <SidebarNavItem
          href="/help"
          icon={HelpCircle}
          label="Help & Support"
          onClick={onNavigate}
        />
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className="px-6 py-4">
        <p className="text-[11px] text-sidebar-foreground/30">
          UPA Portal v2.0
        </p>
      </div>
    </div>
  );
}
