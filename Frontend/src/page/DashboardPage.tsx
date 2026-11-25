import {
  Activity, ArrowRight, ArrowUpRight, CircleHelp, Clock3, ScanLine,
  ShieldAlert, ShieldCheck, Sparkles, Waves, UsersRound, MessageSquareText, ScrollText,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { getManagedUsers } from '../service_rout/ApiService'
import { ThreatMap } from '../components/NetworkPanels'
import type { Analysis, ManagedUser } from '../service_rout/ApiService'
import type { AccountRole } from '../service_rout/ApiService'
import '../DashboardOverview.css'

interface DashboardPageProps {
  query: string
  onNavigate: (page: string) => void
  analyses: Analysis[]
  loading: boolean
  error: string
  role: AccountRole
}

const threatStatuses = new Set(['MALICIOUS', 'SUSPICIOUS'])
const isThreat = (item: Analysis) => threatStatuses.has(item.status.toUpperCase())
const formatTime = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

function getWeekData(analyses: Analysis[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const count = analyses.filter((item) => {
      const createdAt = new Date(item.created_at)
      return createdAt >= date && createdAt < new Date(date.getTime() + 86400000)
    }).length
    return { label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date), date, count }
  })
}

function MetricCard({ icon: Icon, label, value, detail, tone }: {
  icon: typeof Activity
  label: string
  value: number | string
  detail: string
  tone: 'blue' | 'red' | 'green' | 'purple'
}) {
  return <article className="overview-metric">
    <span className={`overview-metric-icon ${tone}`}><Icon aria-hidden="true" /></span>
    <div className="overview-metric-copy">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  </article>
}

function TrendChart({ weekData, loading }: { weekData: ReturnType<typeof getWeekData>; loading: boolean }) {
  const max = Math.max(1, ...weekData.map((day) => day.count))
  const points = weekData.map((day, index) => ({
    x: 46 + index * 68,
    y: 144 - (day.count / max) * 104,
  }))
  const line = points.map((point) => `${point.x},${point.y}`).join(' ')
  const area = `${points[0].x},162 ${line} ${points.at(-1)?.x},162`

  return <section className="overview-panel overview-trend">
    <div className="overview-panel-heading">
      <div><h2>Activité des analyses</h2><p>Nombre d’analyses sur les sept derniers jours</p></div>
      <span className="overview-period"><Activity size={14} /> 7 jours</span>
    </div>
    {loading ? <div className="overview-chart-loading" aria-label="Chargement du graphique" /> : weekData.every((day) => day.count === 0)
      ? <div className="overview-empty-chart"><Waves aria-hidden="true" /><span>Les analyses apparaîtront ici.</span></div>
      : <svg className="overview-line-chart" viewBox="0 0 470 190" role="img" aria-label="Graphique des analyses des sept derniers jours">
        <defs><linearGradient id="overview-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#477dff" stopOpacity=".28" /><stop offset="100%" stopColor="#477dff" stopOpacity="0" /></linearGradient></defs>
        {[30, 66, 102, 138, 162].map((y) => <line key={y} x1="40" x2="445" y1={y} y2={y} className="overview-chart-grid" />)}
        <polygon points={area} fill="url(#overview-area)" />
        <polyline points={line} className="overview-chart-line" />
        {points.map((point, index) => <circle key={weekData[index].label} cx={point.x} cy={point.y} r="4" className="overview-chart-dot"><title>{weekData[index].count} analyse(s)</title></circle>)}
        {weekData.map((day, index) => <text key={day.label + index} x={46 + index * 68} y="184" textAnchor="middle" className="overview-chart-label">{day.label}</text>)}
      </svg>}
  </section>
}

function TypeDistribution({ analyses, className = '' }: { analyses: Analysis[]; className?: string }) {
  const intrusion = analyses.filter((item) => item.type === 'intrusion').length
  const phishing = analyses.filter((item) => item.type === 'phishing').length
  const total = intrusion + phishing
  const intrusionPct = total ? Math.round((intrusion / total) * 100) : 0
  const phishingPct = total ? 100 - intrusionPct : 0
  const style = { background: total ? `conic-gradient(#3b72f6 0 ${intrusionPct}%, #26bd83 ${intrusionPct}% 100%)` : 'conic-gradient(#25364e 0 100%)' }

  return <section className={`overview-panel overview-distribution ${className}`}>
    <div className="overview-panel-heading">
      <div><h2>Répartition</h2><p>Analyses par catégorie</p></div>
      <span className="overview-period">Par type</span>
    </div>
    <div className="overview-distribution-content">
      <div className="overview-donut" style={style} role="img" aria-label={`${intrusion} analyses d’intrusion et ${phishing} analyses de phishing`}>
        <span><strong>{total}</strong><small>analyses</small></span>
      </div>
      <div className="overview-legend">
        <div><i className="intrusion-dot" /><span>Intrusion</span><b>{intrusionPct}%</b></div>
        <div><i className="phishing-dot" /><span>Phishing</span><b>{phishingPct}%</b></div>
      </div>
    </div>
  </section>
}

function DailyVolume({ weekData, loading }: { weekData: ReturnType<typeof getWeekData>; loading: boolean }) {
  const max = Math.max(1, ...weekData.map((day) => day.count))
  return <section className="overview-panel overview-daily">
    <div className="overview-panel-heading"><div><h2>Volume quotidien</h2><p>Analyses lancées par jour</p></div><Clock3 size={17} aria-hidden="true" /></div>
    {loading ? <div className="overview-chart-loading" aria-label="Chargement du graphique" /> : <div className="overview-bars">
      {weekData.map((day, index) => <div className="overview-bar-column" key={day.label + index}>
        <span className="overview-bar-value">{day.count || ''}</span>
        <div className="overview-bar-track"><i style={{ height: `${day.count ? Math.max(8, (day.count / max) * 100) : 0}%` }} /></div>
        <span className="overview-chart-label">{day.label}</span>
      </div>)}
    </div>}
  </section>
}

function RecentAnalyses({ analyses, query, loading, onNavigate }: {
  analyses: Analysis[]
  query: string
  loading: boolean
  onNavigate: (page: string) => void
}) {
  const recent = analyses
    .filter((item) => `${item.type} ${item.target} ${item.status}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 4)

  return <section className="overview-panel overview-recent">
    <div className="overview-panel-heading">
      <div><h2>Analyses récentes</h2><p>Derniers résultats enregistrés</p></div>
      <button className="overview-link" onClick={() => onNavigate('Historique')}>Historique <ArrowRight size={14} /></button>
    </div>
    {loading ? <div className="overview-loading-rows"><i /><i /><i /></div> : recent.length ? <div className="overview-recent-list">
      {recent.map((item) => <article className="overview-recent-row" key={item.id}>
        <span className={`overview-alert-icon ${isThreat(item) ? 'danger' : item.status.toUpperCase() === 'SAFE' ? 'safe' : 'unknown'}`}>
          {isThreat(item) ? <ShieldAlert size={17} /> : item.status.toUpperCase() === 'SAFE' ? <ShieldCheck size={17} /> : <CircleHelp size={17} />}
        </span>
        <div className="overview-recent-copy"><strong>{item.type === 'phishing' ? 'Analyse de phishing' : 'Analyse d’intrusion'}</strong><span title={item.target}>{item.target}</span></div>
        <div className="overview-recent-meta"><Badge variant={isThreat(item) ? 'destructive' : item.status.toUpperCase() === 'SAFE' ? 'secondary' : 'outline'}>{item.status}</Badge><time dateTime={item.created_at}>{formatTime(item.created_at)}</time></div>
      </article>)}
    </div> : <div className="overview-empty-recent"><ScanLine aria-hidden="true" /><span>{query ? 'Aucun résultat ne correspond à votre recherche.' : 'Lancez une analyse pour afficher vos résultats ici.'}</span></div>}
  </section>
}

function AdminDashboard({ query, onNavigate, analyses, loading, error }: DashboardPageProps) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [adminLoading, setAdminLoading] = useState(true)
  const [adminError, setAdminError] = useState('')

  useEffect(() => {
    let mounted = true
    const refreshAdminData = () => getManagedUsers()
      .then((items) => {
        if (!mounted) return
        setUsers(items)
        setAdminError('')
      })
      .catch((cause: unknown) => { if (mounted) setAdminError(cause instanceof Error ? cause.message : 'Les utilisateurs sont indisponibles.') })
      .finally(() => { if (mounted) setAdminLoading(false) })
    void refreshAdminData()
    const timer = window.setInterval(() => { void refreshAdminData() }, 30_000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [])

  const threats = analyses.filter(isThreat)
  const activeUsers = users.filter((user) => user.is_active).length
  const weekData = getWeekData(analyses)
  const search = query.trim().toLowerCase()
  const visibleThreats = threats.filter((item) => `${item.type} ${item.target} ${item.status}`.toLowerCase().includes(search)).slice(0, 4)

  return <div className="overview-page admin-overview-page">
    {(error || adminError) && <div className="overview-error" role="alert">{error || adminError}</div>}

    <header className="admin-dashboard-heading">
      <div><span>CYBERSHIELD / ESPACE SUPERADMIN</span><h1>Vue d’ensemble</h1><p>Activité des analyses et sécurité de tous les comptes.</p></div>
      <div className="admin-dashboard-live"><i />Actualisation active <span>· 15 s</span></div>
    </header>

    <div className="admin-overview-grid">
      <main className="admin-overview-main">
      <section className="admin-overview-metrics" aria-label="Indicateurs de la plateforme">
        <MetricCard icon={ShieldAlert} label="Menaces détectées" value={loading ? '—' : threats.length} detail="Résultats suspects ou malveillants" tone="red" />
        <MetricCard icon={Activity} label="Analyses réalisées" value={loading ? '—' : analyses.length} detail="Phishing et détection d’intrusion" tone="green" />
        <MetricCard icon={UsersRound} label="Utilisateurs actifs" value={adminLoading ? '—' : activeUsers} detail={adminLoading ? 'Comptes CyberShield' : `${users.length} comptes au total`} tone="blue" />
      </section>

      <TrendChart weekData={weekData} loading={loading} />
      <TypeDistribution analyses={analyses} />
      <ThreatMap analyses={analyses} />
      <DailyVolume weekData={weekData} loading={loading} />
      </main>

      <aside className="admin-overview-side">
      <section className="overview-panel admin-overview-alerts">
        <div className="overview-panel-heading"><div><h2>Alertes récentes</h2><p>Analyses à examiner</p></div><button className="overview-link" onClick={() => onNavigate('Alertes')}>Voir toutes <ArrowRight size={14} /></button></div>
        {loading ? <div className="overview-loading-rows"><i /><i /><i /></div> : visibleThreats.length ? <div className="overview-recent-list">{visibleThreats.map((item) => <article className="overview-alert-row" key={item.id}><span className={`overview-alert-icon ${item.score >= .7 ? 'danger' : 'unknown'}`}><ShieldAlert size={16} /></span><div className="overview-alert-copy"><strong>{item.type === 'phishing' ? 'Phishing détecté' : 'Intrusion détectée'}</strong><span title={item.target}>{item.target}</span></div><div className="overview-alert-meta"><Badge variant={item.score >= .7 ? 'destructive' : 'secondary'}>{item.score >= .7 ? 'Élevé' : 'Suspect'}</Badge><time>{formatTime(item.created_at)}</time></div></article>)}</div> : <div className="overview-empty-alert"><ShieldCheck size={19} /><span>Aucune alerte récente.</span></div>}
      </section>

      <section className="overview-panel admin-overview-links">
        <div className="overview-panel-heading"><div><h2>Accès rapides</h2><p>Actions de gestion</p></div></div>
        <div className="admin-shortcuts"><button onClick={() => onNavigate('Utilisateurs')}><UsersRound size={16} />Utilisateurs<ArrowRight size={13} /></button><button onClick={() => onNavigate('Activités utilisateurs')}><Activity size={16} />Activités utilisateurs<ArrowRight size={13} /></button><button onClick={() => onNavigate('Messages')}><MessageSquareText size={16} />Messages<ArrowRight size={13} /></button><button onClick={() => onNavigate('Journal systÃ¨me')}><ScrollText size={16} />Journal système<ArrowRight size={13} /></button></div>
      </section>
      </aside>
    </div>

    <div className="overview-footer"><span className="overview-footer-mark"><ShieldCheck size={25} /></span><div><strong>CyberShield AI — contrôle administrateur</strong><span>Les analyses et les comptes affichés proviennent des données renvoyées par le serveur.</span></div><span className="overview-footer-feature"><Activity size={16} /> Données actualisées</span><span className="overview-footer-feature"><ShieldCheck size={16} /> Accès superadmin</span></div>
  </div>
}

export function DashboardPage({ query, onNavigate, analyses, loading, error, role }: DashboardPageProps) {
  const threats = analyses.filter(isThreat).length
  const safe = analyses.filter((item) => item.status.toUpperCase() === 'SAFE').length
  const uncertain = analyses.filter((item) => item.status.toUpperCase() === 'UNKNOWN').length
  const targets = new Set(analyses.map((item) => item.target).filter(Boolean)).size
  const weekData = getWeekData(analyses)

  if (role === 'superadmin') return <AdminDashboard query={query} onNavigate={onNavigate} analyses={analyses} loading={loading} error={error} role={role} />

  return <div className="overview-page">
    <section className="overview-intro">
      <div>
        <Badge variant="outline" className="overview-eyebrow"><Sparkles size={14} /> CYBERSHIELD / VEILLE ACTIVE</Badge>
        <h2>Vue d’ensemble de la sécurité</h2>
        <p>Suivez vos analyses et les menaces détectées par CyberShield AI.</p>
      </div>
      <Button onClick={() => onNavigate('Analyse IA')} className="overview-primary-action"><ScanLine data-icon="inline-start" />Nouvelle analyse<ArrowUpRight data-icon="inline-end" /></Button>
    </section>

    {error && <div className="overview-error" role="alert"><ShieldAlert size={18} /><span>Les données n’ont pas pu être chargées. {error}</span></div>}

    <div className="overview-grid">
      <section className="overview-metrics" aria-label="Indicateurs de sécurité">
        <MetricCard icon={Activity} label="Analyses réalisées" value={loading ? '—' : analyses.length} detail="Dans votre espace" tone="blue" />
        <MetricCard icon={ShieldAlert} label="Menaces détectées" value={loading ? '—' : threats} detail="À examiner" tone="red" />
        <MetricCard icon={ShieldCheck} label="Résultats sûrs" value={loading ? '—' : safe} detail="Classés sans menace" tone="green" />
        <MetricCard icon={CircleHelp} label="À vérifier" value={loading ? '—' : uncertain} detail="Résultats incertains" tone="purple" />
      </section>

      <section className="overview-panel overview-alerts">
        <div className="overview-panel-heading"><div><h2>Alertes récentes</h2><p>Résultats à examiner</p></div><button className="overview-link" onClick={() => onNavigate('Alertes')}>Tout voir <ArrowRight size={14} /></button></div>
        {loading ? <div className="overview-loading-rows"><i /><i /><i /></div> : analyses.filter((item) => item.status.toUpperCase() !== 'SAFE' && `${item.type} ${item.target} ${item.status}`.toLowerCase().includes(query.toLowerCase())).slice(0, 4).map((item) => {
          const threat = isThreat(item)
          return <article className="overview-alert-row" key={item.id}>
            <span className={`overview-alert-icon ${threat ? 'danger' : 'unknown'}`}>{threat ? <ShieldAlert size={17} /> : <CircleHelp size={17} />}</span>
            <div className="overview-alert-copy"><strong>{item.type === 'phishing' ? 'Phishing détecté' : 'Intrusion détectée'}</strong><span title={item.target}>{item.target}</span></div>
            <div className="overview-alert-meta"><Badge variant={threat ? 'destructive' : 'outline'}>{threat ? item.score >= 0.7 ? 'Élevé' : 'Suspect' : 'À vérifier'}</Badge><time dateTime={item.created_at}>{formatTime(item.created_at)}</time></div>
          </article>
        })}
        {!loading && !analyses.some((item) => item.status.toUpperCase() !== 'SAFE' && `${item.type} ${item.target} ${item.status}`.toLowerCase().includes(query.toLowerCase())) && <div className="overview-empty-alert"><ShieldCheck size={19} /><span>Aucune alerte récente.</span></div>}
      </section>

      <TrendChart weekData={weekData} loading={loading} />
      <TypeDistribution analyses={analyses} />
      <DailyVolume weekData={weekData} loading={loading} />
      <RecentAnalyses analyses={analyses} query={query} loading={loading} onNavigate={onNavigate} />

      <section className="overview-panel overview-account-state">
        <div className="overview-panel-heading"><div><h2>État de l’espace</h2><p>Activité enregistrée sur votre compte</p></div><span className="overview-live-dot" /></div>
        <div className="overview-state-list">
          <div><span className="overview-state-icon blue"><Activity size={16} /></span><span><small>Analyses</small><strong>{loading ? '—' : analyses.length}</strong></span></div>
          <div><span className="overview-state-icon green"><ShieldCheck size={16} /></span><span><small>Cibles analysées</small><strong>{loading ? '—' : targets}</strong></span></div>
          <div><span className="overview-state-icon red"><ShieldAlert size={16} /></span><span><small>Menaces à examiner</small><strong>{loading ? '—' : threats}</strong></span></div>
        </div>
        <button className="overview-link overview-state-link" onClick={() => onNavigate('Statistiques')}>Voir les statistiques <ArrowRight size={14} /></button>
      </section>
    </div>

    <div className="overview-footer"><span className="overview-footer-mark"><ShieldCheck size={25} /></span><div><strong>CyberShield AI surveille vos analyses.</strong><span>Les indicateurs reflètent les résultats réellement renvoyés par le backend.</span></div><span className="overview-footer-feature"><ShieldCheck size={16} /> Analyses protégées</span><span className="overview-footer-feature"><Activity size={16} /> Résultats en temps réel</span></div>
  </div>
}
