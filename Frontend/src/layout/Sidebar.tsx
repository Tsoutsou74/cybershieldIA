import {
  Activity,
  Bell,
  ChartNoAxesColumnIncreasing,
  Clock3,
  FileText,
  Grid2X2,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Network,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { navigationItems } from '../dashboardData'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from '../components/ui/sidebar'
import { Button } from '../components/ui/button'

interface SidebarProps {
  activePage: string
  onNavigate: (page: string) => void
  onSignOut: () => void
  email: string
  role: 'user' | 'superadmin'
  alertCount: number
}

const iconByLabel: Record<string, LucideIcon> = {
  'Tableau de bord': Grid2X2,
  'Analyse IA': ScanLine,
  'Intégrations': Network,
  Alertes: Bell,
  Historique: Clock3,
  Statistiques: ChartNoAxesColumnIncreasing,
  Utilisateurs: UsersRound,
  Paramètres: Settings2,
  'Journal système': FileText,
  'Mon profil': UsersRound,
  'Activités utilisateurs': Activity,
  Support: LifeBuoy,
  Messages: MessageSquare,
}

export function Sidebar({ activePage, onNavigate, onSignOut, email, role, alertCount }: SidebarProps) {
  const initials = (email || 'CS').slice(0, 2).toUpperCase()
  const roleName = role === 'superadmin' ? 'Super administrateur' : 'Utilisateur'

  return <ShadcnSidebar collapsible="icon" variant="sidebar" className="border-sidebar-border">
    <SidebarHeader className="px-3 pb-4 pt-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><ShieldCheck aria-hidden="true" /></span>
        <span className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">CyberShield <span className="text-primary">AI</span></span>
        <SidebarTrigger aria-label="Réduire ou développer la navigation" />
      </div>
    </SidebarHeader>
    <SidebarSeparator />
    <SidebarContent className="px-2 py-4">
      <SidebarGroup className="p-0">
        <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em]">Espace sécurité</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {navigationItems
              .filter((item) => (item.label !== 'Utilisateurs' && item.label !== 'Activités utilisateurs') || role === 'superadmin')
              .map((item) => {
              const ItemIcon = iconByLabel[item.label] ?? Activity
              return <SidebarMenuItem key={item.label}>
                <SidebarMenuButton isActive={activePage === item.label} tooltip={item.label} onClick={() => onNavigate(item.label)} className="h-10 rounded-xl px-3">
                  <ItemIcon aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.label === 'Alertes' && alertCount > 0 && <SidebarMenuBadge className="rounded-full bg-destructive/15 text-destructive">{alertCount}</SidebarMenuBadge>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="mt-auto p-0 group-data-[collapsible=icon]:hidden">
        <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4">
          <span className="mb-3 grid size-9 place-items-center rounded-xl bg-primary/15 text-primary"><Sparkles aria-hidden="true" /></span>
          <p className="text-sm font-semibold">Protection renforcée</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Lancez une analyse pour examiner une URL ou un flux réseau.</p>
          <Button size="sm" className="mt-3 w-full rounded-lg" onClick={() => onNavigate('Analyse IA')}>
            <ScanLine data-icon="inline-start" />Nouvelle analyse
          </Button>
        </div>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter className="border-t border-sidebar-border p-3">
      <div className="flex min-w-0 items-center gap-3 rounded-xl px-2 py-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">{initials}</span>
        <span className="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><span className="truncate text-sm font-medium">{email || 'Compte CyberShield'}</span><span className="truncate text-xs text-muted-foreground">{roleName}</span></span>
        <Button variant="ghost" size="icon-sm" aria-label="Se déconnecter" title="Se déconnecter" onClick={onSignOut} className="group-data-[collapsible=icon]:hidden"><LogOut aria-hidden="true" /></Button>
      </div>
    </SidebarFooter>
  </ShadcnSidebar>
}
