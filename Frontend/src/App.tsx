import { useEffect, useState } from 'react'
import { Sidebar } from './layout/Sidebar'
import { Topbar } from './layout/Topbar'
import { DashboardPage } from './page/DashboardPage'
import { LandingPage } from './page/LandingPage'
import { LoginPage } from './page/LoginPage'
import { SectionPages } from './components/SectionPages'
import { AutoMonitoringPage } from './components/AutoMonitoringPage'
import { clearToken, getCurrentUser, getStoredRole, getToken, setOnUnauthorized } from './service_rout/ApiService'
import { getAllUserActivity, getHistory } from './service_rout/ApiService'
import type { Analysis } from './service_rout/ApiService'
import type { AccountRole } from './service_rout/ApiService'
import { SidebarInset, SidebarProvider } from './components/ui/sidebar'
import { TooltipProvider } from './components/ui/tooltip'
import './Dashboard.css'
import './page/DashboardShell.css'

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1))
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getToken()))
  const [accountRole, setAccountRole] = useState<AccountRole>(() => getStoredRole())
  const [accountEmail, setAccountEmail] = useState('')
  const [activePage, setActivePage] = useState('Tableau de bord')
  const [query, setQuery] = useState('')
  const [notificationsDismissed, setNotificationsDismissed] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    const syncPage = () => setRoute(window.location.hash.slice(1))
    window.addEventListener('hashchange', syncPage)
    return () => window.removeEventListener('hashchange', syncPage)
  }, [])

  useEffect(() => {
    setOnUnauthorized(() => {
      clearToken()
      setIsAuthenticated(false)
      setAccountRole('user')
      setAccountEmail('')
      window.location.hash = 'login'
    })
    return () => setOnUnauthorized(() => {})
  }, [])

  useEffect(() => {
    if (route === 'dashboard' && isAuthenticated) {
      getCurrentUser().then((user) => {
        setAccountRole(user.role)
        setAccountEmail(user.email)
      }).catch(() => undefined)
    }
  }, [route, isAuthenticated])

  useEffect(() => {
    if (route !== 'dashboard' || !isAuthenticated) return
    let active = true
    let requestInFlight = false
    const refreshHistory = () => {
      if (requestInFlight) return
      requestInFlight = true
      setHistoryError('')
      const historyRequest = accountRole === 'superadmin' ? getAllUserActivity() : getHistory()
      historyRequest
        .then((items) => { if (active) setAnalyses(items) })
        .catch((cause: unknown) => {
          if (active) setHistoryError(cause instanceof Error ? cause.message : 'Impossible de charger les données du serveur.')
        })
        .finally(() => {
          requestInFlight = false
          if (active) setHistoryLoading(false)
        })
    }

    refreshHistory()
    const timer = window.setInterval(refreshHistory, 15_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [route, isAuthenticated, accountRole])

  const enterDashboard = () => {
    window.location.hash = isAuthenticated ? 'dashboard' : 'login'
  }

  const returnToLanding = () => {
    window.location.hash = 'accueil'
  }

  const enterAfterLogin = (role: AccountRole) => {
    setIsAuthenticated(true)
    setAccountRole(role)
    window.location.hash = 'dashboard'
  }

  const navigate = (page: string) => {
    if ((page === 'Utilisateurs' || page === 'Activités utilisateurs') && accountRole !== 'superadmin') return
    setActivePage(page)
  }

  const signOut = () => {
    clearToken()
    setIsAuthenticated(false)
    setAccountRole('user')
    setAccountEmail('')
    window.location.hash = 'login'
  }

  if (route === 'login' || (route === 'dashboard' && !isAuthenticated)) {
    return <LoginPage onAuthenticated={enterAfterLogin} onBackHome={returnToLanding} />
  }

  if (route !== 'dashboard') return <LandingPage onEnterDashboard={enterDashboard} />

  return <TooltipProvider>
    <SidebarProvider defaultOpen>
      <div className={`cyber-dashboard flex min-h-svh min-w-0 w-full ${darkMode ? 'dark' : 'light-mode'}`}>
        <Sidebar activePage={activePage} onNavigate={navigate} onSignOut={signOut} email={accountEmail} role={accountRole} alertCount={analyses.filter((item) => item.status.toUpperCase() !== 'SAFE').length} />
        <SidebarInset className="min-w-0 bg-background">
          <Topbar title={activePage} query={query} darkMode={darkMode} notifications={!notificationsDismissed && analyses.some((item) => item.status.toUpperCase() !== 'SAFE')} onQueryChange={setQuery} onToggleTheme={() => setDarkMode((value) => !value)} onDismissNotifications={() => setNotificationsDismissed(true)} onNavigateHome={returnToLanding} email={accountEmail} role={accountRole} />
          <div className="mx-auto w-full max-w-[1600px] grow px-4 pb-8 pt-5 sm:px-6 lg:px-8">
            <AutoMonitoringPage compact={activePage !== 'Surveillance auto'} onOpen={() => navigate('Surveillance auto')} />
            {activePage === 'Surveillance auto' ? null : activePage === 'Tableau de bord' || (activePage === 'Utilisateurs' && accountRole !== 'superadmin')
              ? <DashboardPage query={query} onNavigate={navigate} analyses={analyses} loading={historyLoading} error={historyError} role={accountRole} />
              : <SectionPages page={activePage} query={query} onNavigate={navigate} role={accountRole} />}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  </TooltipProvider>
}
