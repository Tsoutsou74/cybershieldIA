import { Bell, Home, Moon, Search, Sun } from 'lucide-react'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { SidebarTrigger } from '../components/ui/sidebar'

interface TopbarProps {
  title: string
  query: string
  darkMode: boolean
  notifications: boolean
  onQueryChange: (query: string) => void
  onToggleTheme: () => void
  onDismissNotifications: () => void
  onNavigateHome: () => void
  email: string
  role: 'user' | 'superadmin'
}

const pageDescriptions: Record<string, string> = {
  'Tableau de bord': 'Vue d’ensemble des analyses associées à votre compte.',
  'Analyse IA': 'Analysez des URL, des messages et des flux réseau.',
  Alertes: 'Résultats suspects renvoyés par vos analyses.',
  Historique: 'Retrouvez les résultats enregistrés par le backend.',
}

export function Topbar({ title, query, darkMode, notifications, onQueryChange, onToggleTheme, onDismissNotifications, onNavigateHome, email, role }: TopbarProps) {
  const initials = (email || 'CS').slice(0, 2).toUpperCase()

  return <header className="sticky top-0 z-20 flex min-h-[76px] items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
    <SidebarTrigger aria-label="Ouvrir ou réduire la navigation" className="shrink-0" />
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
      <p className="hidden truncate text-xs text-muted-foreground sm:block">{pageDescriptions[title] ?? 'Espace de sécurité CyberShield AI.'}</p>
    </div>
    <label className="relative hidden w-full max-w-xs items-center md:flex" htmlFor="dashboard-search">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
      <Input id="dashboard-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Rechercher une analyse…" className="h-10 rounded-xl border-border/80 bg-card/70 pl-9" />
    </label>
    <div className="flex shrink-0 items-center gap-1.5">
      <Button variant="ghost" size="icon" aria-label="Notifications" title="Notifications" onClick={onDismissNotifications} className="relative rounded-xl">
        <Bell aria-hidden="true" />{notifications && <span className="absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-background" />}
      </Button>
      <Button variant="ghost" size="icon" aria-label={darkMode ? 'Activer le thème clair' : 'Activer le thème sombre'} title={darkMode ? 'Thème clair' : 'Thème sombre'} onClick={onToggleTheme} className="rounded-xl">
        {darkMode ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </Button>
      <span className="mx-1 hidden h-8 w-px bg-border sm:block" />
      <Avatar className="size-9 border border-border">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <span className="hidden min-w-0 max-w-40 lg:grid">
        <span className="truncate text-xs font-medium">{email || 'Compte CyberShield'}</span>
        <span className="truncate text-[11px] text-muted-foreground">{role === 'superadmin' ? 'Super administrateur' : 'Utilisateur'}</span>
      </span>
      <Button variant="outline" size="icon-sm" aria-label="Accueil CyberShield" title="Retour à l’accueil" onClick={onNavigateHome} className="ml-1 rounded-xl">
        <Home aria-hidden="true" />
      </Button>
    </div>
  </header>
}
