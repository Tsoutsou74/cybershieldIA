/* eslint-disable no-irregular-whitespace */
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { IconName } from '../dashboardData'
import { Icon } from './Icon'
import { RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import './SectionPages.css'
import './AnalysisFeed.css'
import { analyzeCsv, analyzeIntrusion, analyzePhishing, createManagedUser, getAllUserActivity, getCurrentUser, getHistory, getManagedUsers, getSubscriptionHistory, getThreatFeedStatus, startStripeCheckout, submitManualPayment, syncStripeSubscriptionHistory, syncThreatFeed, updateManagedUser, updateMyProfile, verifyManualPayment } from '../service_rout/ApiService'
import type { AdminActivity, Analysis, AuthUser, IntrusionSummary, ManagedUser, PaymentStatus, SubscriptionPayment, SubscriptionPlan, ThreatFeedStatus } from '../service_rout/ApiService'
import type { AccountRole } from '../service_rout/ApiService'
import { SupportChat } from './SupportChat'
import { IntegrationsPage } from './IntegrationsPage'
import { AutoMonitoringPage } from './AutoMonitoringPage'

const pageLoadedAt = new Date()

type CsvCell = string | number

function downloadCsv(filename: string, rows: CsvCell[][]): void {
  if (rows.length === 0) return
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
interface SectionPagesProps {
  page: string
  query: string
  onNavigate: (page: string) => void
  role: AccountRole
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="section-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action && <div className="section-title-action">{action}</div>}</div>
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Card className={`section-card rounded-2xl border-border/80 bg-card/90 text-card-foreground shadow-sm ${className}`}>{children}</Card>
}

function StatCard({ icon, label, value, detail, tone = 'blue' }: { icon: IconName; label: string; value: string; detail: string; tone?: string }) {
  return <Card className="section-stat rounded-2xl border-border/80 bg-card/90 text-card-foreground shadow-sm">
    <CardHeader className="p-0"><span className={`section-stat-icon ${tone}`}><Icon name={icon} size={19} /></span><CardDescription className="section-stat-label">{label}</CardDescription></CardHeader>
    <CardContent className="grid gap-1 p-0"><CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle><CardDescription>{detail}</CardDescription></CardContent>
  </Card>
}

function PageStats({ children }: { children: ReactNode }) {
  return <div className="section-stats">{children}</div>
}

function AnalysisPage({ role }: { role: AccountRole }) {
  const [mode, setMode] = useState<'phishing' | 'intrusion'>('phishing')
  const [target, setTarget] = useState('')
  const [sourceIp, setSourceIp] = useState('')
  const [packetSize, setPacketSize] = useState('1500')
  const [flags, setFlags] = useState('SYN')
  const [result, setResult] = useState<Analysis | null>(null)
  const [history, setHistory] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(false)
  const [completionNotice, setCompletionNotice] = useState<{ title: string; detail: string; tone: 'success' | 'warning' | 'error' | 'info'; id: number } | null>(null)
  const [error, setError] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [autoCsvAnalysis, setAutoCsvAnalysis] = useState(true)
  const [csvSummary, setCsvSummary] = useState<IntrusionSummary | null>(null)
  const [threatFeed, setThreatFeed] = useState<ThreatFeedStatus | null>(null)
  const [feedError, setFeedError] = useState('')
  const [syncingFeed, setSyncingFeed] = useState(false)

  useEffect(() => {
    let mounted = true
    let requestInFlight = false
    const refreshHistory = () => {
      if (requestInFlight) return
      requestInFlight = true
      getHistory()
        .then((items) => { if (mounted) setHistory(items) })
        .catch(() => undefined)
        .finally(() => { requestInFlight = false })
    }
    void refreshHistory()
    const timer = window.setInterval(refreshHistory, 15_000)
    return () => {
      mounted = false
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!completionNotice) return
    const timer = window.setTimeout(() => setCompletionNotice(null), 9000)
    return () => window.clearTimeout(timer)
  }, [completionNotice])

  const notifyAnalysis = (title: string, detail: string, tone: 'success' | 'warning' | 'error' | 'info') => {
    setCompletionNotice({ title, detail, tone, id: Date.now() })
  }

  useEffect(() => {
    let mounted = true
    const refreshFeed = () => getThreatFeedStatus()
      .then((status) => { if (mounted) { setThreatFeed(status); setFeedError('') } })
      .catch((cause: unknown) => { if (mounted) setFeedError(cause instanceof Error ? cause.message : 'Flux de menaces indisponible.') })
    void refreshFeed()
    const timer = window.setInterval(() => { void refreshFeed() }, 30_000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [])

  const synchronizeThreatFeed = async () => {
    setSyncingFeed(true)
    setFeedError('')
    try { setThreatFeed(await syncThreatFeed()) }
    catch (cause) { setFeedError(cause instanceof Error ? cause.message : 'La synchronisation du flux a échoué.') }
    finally { setSyncingFeed(false) }
  }

  const submitAnalysis = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const analysis = mode === 'phishing'
        ? await analyzePhishing(target.trim())
        : await analyzeIntrusion({ source_ip: sourceIp.trim(), packet_size: Number(packetSize), flags: flags.trim() })
      setResult(analysis)
      setHistory((current) => [analysis, ...current.filter((item) => item.id !== analysis.id)].slice(0, 8))
      notifyAnalysis('Analyse terminée', `${analysis.type === 'phishing' ? 'Phishing / malware' : 'Intrusion'} · ${analysis.status} · score ${Math.round(analysis.score * 100)} %`, analysis.status === 'SAFE' ? 'success' : 'warning')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lâ€™analyse a Ã©chouÃ©. RÃ©essayez.')
    } finally {
      setLoading(false)
    }
  }

  const runCsvAnalysis = async (file: File) => {
    setLoading(true)
    setError('')
    setCsvSummary(null)
    notifyAnalysis('Analyse IDS démarrée', `Analyse automatique des flux du fichier ${file.name}.`, 'info')
    try {
      const summary = await analyzeCsv(file)
      setCsvSummary(summary)
      getHistory().then(setHistory).catch(() => undefined)
      notifyAnalysis('Analyse IDS terminée', `${summary.total_flows} flux examinés · ${summary.malicious_flows} malveillants · ${summary.low_confidence_flows} incertains.`, summary.malicious_flows > 0 ? 'warning' : 'success')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lâ€™analyse du fichier a Ã©chouÃ©. RÃ©essayez.')
    } finally {
      setLoading(false)
    }
  }

  const submitCsvAnalysis = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (csvFile) void runCsvAnalysis(csvFile)
  }

  const riskLabel = (status: string) => {
    const normalized = status.toUpperCase()
    if (normalized === 'MALICIOUS' || normalized === 'SUSPICIOUS') return 'Menace dÃ©tectÃ©e'
    if (normalized === 'SAFE') return 'Aucune menace dÃ©tectÃ©e'
    return 'RÃ©sultat incertain'
  }
  const resultTone = (status: string) => {
    const normalized = status.toUpperCase()
    return normalized === 'SAFE' ? 'safe' : normalized === 'UNKNOWN' ? 'unknown' : 'threat'
  }

  return <div className="section-page">
    {completionNotice && <div key={completionNotice.id} className={`analysis-completion-toast ${completionNotice.tone}`} role={completionNotice.tone === 'error' ? 'alert' : 'status'} aria-live="polite"><Icon name={completionNotice.tone === 'success' ? 'shield' : completionNotice.tone === 'info' ? 'activity' : 'warning'} size={19} /><div><strong>{completionNotice.title}</strong><p>{completionNotice.detail}</p></div><button type="button" aria-label="Fermer la notification" onClick={() => setCompletionNotice(null)}>×</button></div>}
    <PageTitle eyebrow="DÃ‰TECTION PAR LES MODÃˆLES DU SERVEUR" title="Analyse IA" description="Soumettez une URL, un message ou les caractÃ©ristiques dâ€™un flux rÃ©seau Ã  lâ€™API de dÃ©tection. L’historique se synchronise automatiquement toutes les 15 secondes." />
    <PageStats>
      <StatCard icon="shield" label="Analyses enregistrÃ©es" value={String(history.length)} detail="Historique associÃ© Ã  votre compte" />
      <StatCard icon="warning" label="Menaces signalÃ©es" value={String(history.filter((item) => item.status.toUpperCase() !== 'SAFE').length)} detail="Par les derniÃ¨res analyses" tone="orange" />
      <StatCard icon="activity" label="DerniÃ¨re analyse" value={history[0] ? new Date(history[0].created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'â€”'} detail={history[0]?.type ?? 'Aucune analyse rÃ©cente'} tone="green" />
      <StatCard icon="server" label="Mode de dÃ©tection" value="Backend requis" detail="Connexion Ã  lâ€™API configurÃ©e" tone="purple" />
    </PageStats>
    <SectionCard className="analysis-feed-card">
      <div className="section-card-heading"><div><h3>Analyse phishing automatique</h3><p>Plusieurs flux de menaces alimentent l’analyse des URL; le backend les actualise selon le calendrier de chaque source.</p></div><span className={`analysis-feed-status ${threatFeed?.status === 'online' ? 'online' : threatFeed?.status === 'error' ? 'offline' : ''}`}><i />{threatFeed?.status === 'online' ? 'Toutes les sources actives' : threatFeed?.status === 'partial' ? 'Sources partiellement actives' : threatFeed?.status === 'syncing' ? 'Synchronisation…' : threatFeed?.status === 'error' ? 'Flux indisponibles' : 'Vérification…'}</span></div>
      <div className="analysis-feed-details"><span><small>Sources actives</small><strong>{threatFeed?.feeds?.filter((feed) => feed.status === 'online').length ?? '—'} / {threatFeed?.feeds?.length ?? 3}</strong></span><span><small>Indicateurs chargés</small><strong>{threatFeed?.entry_count.toLocaleString('fr-FR') ?? '—'}</strong></span><span><small>Dernière mise à jour</small><strong>{threatFeed?.last_updated_at ? new Date(threatFeed.last_updated_at).toLocaleString('fr-FR') : 'En attente'}</strong></span><span><small>Prochaine synchronisation</small><strong>Selon chaque flux</strong></span></div>
      <div className="analysis-feed-sources">{(threatFeed?.feeds ?? []).map((feed) => <div key={feed.id} className="analysis-feed-source"><span className={`analysis-feed-source-dot ${feed.status}`} /><div><strong>{feed.name}</strong><small>{feed.entry_count.toLocaleString('fr-FR')} indicateurs · {feed.update_interval_hours} h</small>{feed.last_error && <small className="analysis-feed-source-error">{feed.last_error}</small>}</div><span className="analysis-feed-source-state">{feed.status === 'online' ? 'Actif' : feed.status === 'syncing' ? 'Sync…' : feed.status === 'error' ? 'Erreur' : 'En attente'}</span></div>)}</div>
      {(feedError || threatFeed?.last_error) && <p className="analysis-feed-error" role="status">{feedError || threatFeed?.last_error}</p>}
      <div className="analysis-feed-footer"><p>{threatFeed?.license_note ?? 'Flux Community pour les démonstrations et l’usage non commercial.'}</p>{role === 'superadmin' && <button type="button" className="secondary-action" disabled={syncingFeed || threatFeed?.status === 'syncing'} onClick={() => void synchronizeThreatFeed()}><RefreshCw size={14} className={syncingFeed || threatFeed?.status === 'syncing' ? 'analysis-spin' : ''} />{syncingFeed || threatFeed?.status === 'syncing' ? 'Synchronisation…' : 'Mettre à jour maintenant'}</button>}</div>
    </SectionCard>
    <SectionCard className="analyzer-card">
      <div className="section-card-heading"><div><h3>Nouvelle analyse</h3><p>Les rÃ©sultats sont calculÃ©s par les modÃ¨les disponibles sur le serveur.</p></div><span className="live-status"><i />PrÃªt</span></div>
      <div className="analyzer-tabs" role="tablist" aria-label="Type dâ€™analyse">
        <button type="button" role="tab" aria-selected={mode === 'phishing'} className={mode === 'phishing' ? 'active' : ''} onClick={() => { setMode('phishing'); setResult(null); setError('') }}><Icon name="globe" size={16} />Phishing Â· URL ou message</button>
        <button type="button" role="tab" aria-selected={mode === 'intrusion'} className={mode === 'intrusion' ? 'active' : ''} onClick={() => { setMode('intrusion'); setResult(null); setError('') }}><Icon name="activity" size={16} />Intrusion Â· flux rÃ©seau</button>
      </div>
      <form className="analysis-form" onSubmit={submitAnalysis}>
        {mode === 'phishing' ? <label>URL, e-mail ou message Ã  vÃ©rifier<textarea rows={4} value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Collez une URL ou le contenu dâ€™un e-mail/SMS suspectâ€¦" required /></label> : <div className="intrusion-fields"><label>Adresse IP source<input value={sourceIp} onChange={(event) => setSourceIp(event.target.value)} placeholder="192.168.1.45" required /></label><label>Taille du paquet (octets)<input type="number" min="0" max="65535" value={packetSize} onChange={(event) => setPacketSize(event.target.value)} required /></label><label>Indicateurs / flags<input value={flags} onChange={(event) => setFlags(event.target.value)} placeholder="SYN, ACKâ€¦" required /></label></div>}
        <div className="analysis-form-footer"><p><Icon name="help" size={15} />{mode === 'phishing' ? 'Le phishing est évalué par le modèle local. Pour une URL, sa réputation malware est aussi vérifiée auprès d’URLhaus ; l’URL est transmise à ce service.' : 'Le backend reçoit l’IP, la taille du paquet et les flags du flux.'}</p><button className="primary-action" type="submit" disabled={loading}><Icon name={mode === 'phishing' ? 'globe' : 'scan'} size={16} />{loading ? 'Analyse en cours…' : 'Analyser maintenant'}</button></div>
      </form>
      {mode === 'intrusion' && <SectionCard className="analyzer-card"><div className="section-card-heading"><div><h3>Détection automatique des intrusions</h3><p>Importez un CSV de flux réseau : chaque ligne est analysée par le modèle IDS du serveur dès la sélection.</p></div></div><form className="analysis-form" onSubmit={submitCsvAnalysis}><label>Fichier CSV de flux réseau<input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0] ?? null; setCsvFile(file); setCsvSummary(null); setError(''); if (file && autoCsvAnalysis) void runCsvAnalysis(file) }} required /></label><label className="csv-auto-toggle"><input type="checkbox" checked={autoCsvAnalysis} onChange={(event) => setAutoCsvAnalysis(event.target.checked)} />Lancer l’analyse automatiquement après sélection</label><div className="analysis-form-footer"><p><Icon name="help" size={15} />CSV limité à 20 Mo et 10 000 flux. Le bilan est enregistré dans votre historique.</p><button className="primary-action" type="submit" disabled={loading || !csvFile}><Icon name="scan" size={16} />{loading ? 'Analyse en cours…' : 'Relancer l’analyse'}</button></div></form>{csvSummary && <div className="analysis-message result-message"><div className="result-copy"><strong>Analyse terminée : {csvSummary.total_flows} flux examinés</strong><p>{csvSummary.malicious_flows} flux malveillants ({Math.round(csvSummary.malicious_ratio * 100)} %) · {csvSummary.low_confidence_flows} résultats à faible confiance</p><small>Confiance moyenne : {Math.round(csvSummary.mean_confidence * 100)} %{csvSummary.dominant_attack ? ` · Attaque dominante : ${csvSummary.dominant_attack}` : ''}</small>{Object.keys(csvSummary.counts).length > 0 && <p>Catégories : {Object.entries(csvSummary.counts).map(([name, count]) => `${name} (${count})`).join(' · ')}</p>}</div></div>}</SectionCard>}
      {error && <div className="analysis-message error-message" role="alert"><Icon name="warning" size={18} /><div><strong>Analyse impossible</strong><p>{error}</p></div></div>}
      {result && <div className={`analysis-message result-message ${resultTone(result.status)}`} role="status"><span className="result-mark"><Icon name={result.status.toUpperCase() === 'SAFE' ? 'shield' : 'warning'} size={20} /></span><div className="result-copy"><strong>{riskLabel(result.status)}</strong><p>{result.type} Â· {result.target}</p><small>Score de risque : {Math.round(result.score * 100)}% Â· Statut : {result.status}</small>{result.malware && <small className={`malware-check ${result.malware.status === 'malware_found' ? 'detected' : ''}`}><strong>Malware · {result.malware.source} :</strong> {result.malware.detail}{result.malware.tags?.length ? ` Famille(s) ou tag(s) : ${result.malware.tags.join(', ')}.` : ''}{result.malware.reference ? <> <a href={result.malware.reference} target="_blank" rel="noreferrer">Voir la fiche URLhaus</a></> : null}</small>}</div><span className="result-score">{Math.round(result.score * 100)}%</span></div>}
    </SectionCard>
    <SectionCard className="analysis-history">
      <div className="section-card-heading"><div><h3>Historique des analyses</h3><p>RÃ©sultats enregistrÃ©s par le backend pour votre compte</p></div></div>
      {history.length ? <div className="responsive-table"><table className="section-table"><thead><tr><th>Type</th><th>Cible analysÃ©e</th><th>RÃ©sultat</th><th>Score</th><th>Date</th></tr></thead><tbody>{history.slice(0, 8).map((item) => <tr key={item.id}><td>{item.type === 'phishing' ? 'Phishing' : 'Intrusion'}</td><td className="analysis-target">{item.target}</td><td><span className={`table-badge ${item.status.toUpperCase() === 'SAFE' ? 'green' : item.status.toUpperCase() === 'UNKNOWN' ? 'amber' : 'red'}`}>{item.status}</span></td><td>{Math.round(item.score * 100)}%</td><td>{new Date(item.created_at).toLocaleString('fr-FR')}</td></tr>)}</tbody></table></div> : <div className="section-empty"><Icon name="clock" size={22} />Aucune analyse enregistrÃ©e pour le moment.</div>}
      <p className="engine-note">La dÃ©tection dÃ©pend des modÃ¨les configurÃ©s cÃ´tÃ© serveur. Le backend dâ€™intrusion actuel Ã©value seulement les champs fournis ; il ne rÃ©alise pas encore une surveillance rÃ©seau continue ni une classification exhaustive des attaques.</p>
    </SectionCard>
  </div>
}

function AlertsPage({ query }: { query: string }) {
  const [severity, setSeverity] = useState('Toutes')
  const [selected, setSelected] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  useEffect(() => { getHistory().then(setAnalyses).catch(() => setAnalyses([])) }, [])
  const alerts = useMemo(() => analyses.filter((item) => item.status.toUpperCase() !== 'SAFE').map((item) => {
    const confirmed = ['MALICIOUS', 'SUSPICIOUS'].includes(item.status.toUpperCase())
    const level = !confirmed ? 'Incertain' : item.score >= 0.7 ? 'Ã‰levÃ©' : 'Moyen'
    return { item, level, tone: !confirmed ? 'amber' : item.score >= 0.7 ? 'red' : 'orange', title: `${item.type === 'phishing' ? 'Phishing' : 'Intrusion'} Â· ${item.status}`, detail: item.target }
  }).filter((alert) => `${alert.title} ${alert.detail}`.toLowerCase().includes(query.toLowerCase()) && (severity === 'Toutes' || alert.level === severity)), [analyses, query, severity])
  return <div className="section-page"><PageTitle eyebrow="SURVEILLANCE PAR ANALYSE" title="Centre des alertes" description="RÃ©sultats suspects ou malveillants retournÃ©s par le backend." /><PageStats><StatCard icon="bell" label="RÃ©sultats Ã  examiner" value={String(alerts.length)} detail="Dâ€™aprÃ¨s vos analyses" tone="orange" /><StatCard icon="warning" label="Risque Ã©levÃ©" value={String(alerts.filter((alert) => alert.level === 'Ã‰levÃ©').length)} detail="Score supÃ©rieur ou Ã©gal Ã  70 %" tone="red" /><StatCard icon="activity" label="RÃ©sultats incertains" value={String(alerts.filter((alert) => alert.level === 'Incertain').length)} detail="Ã€ vÃ©rifier manuellement" /><StatCard icon="shield" label="Analyses enregistrÃ©es" value={String(analyses.length)} detail="AssociÃ©es Ã  votre compte" tone="green" /></PageStats><SectionCard><div className="section-card-heading"><div><h3>Alertes dÃ©tectÃ©es</h3><p>{alerts.length} rÃ©sultat{alerts.length === 1 ? '' : 's'} correspondant Ã  votre recherche</p></div><div className="filter-tabs">{['Toutes', 'Ã‰levÃ©', 'Moyen', 'Incertain'].map((item) => <button className={severity === item ? 'active' : ''} key={item} onClick={() => setSeverity(item)}>{item}</button>)}</div></div><div className="full-alert-list">{alerts.map(({ item, level, tone, title, detail }) => <article className={`full-alert-row ${selected === String(item.id) ? 'expanded' : ''}`} key={item.id} onClick={() => setSelected(selected === String(item.id) ? null : String(item.id))}><div className={`alert-icon ${tone}`}><Icon name="warning" size={17} /></div><div className="alert-copy"><strong>{title}</strong><span>{detail}</span>{selected === String(item.id) && <p className="alert-extra">Score : {Math.round(item.score * 100)} % Â· {new Date(item.created_at).toLocaleString('fr-FR')}</p>}</div><span className="table-badge amber">{level}</span><time>{new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time><Icon name="chevron" size={16} /></article>)}</div>{alerts.length === 0 && <div className="section-empty"><Icon name="search" size={22} />Aucune alerte enregistrÃ©e ne correspond Ã  ces critÃ¨res.</div>}</SectionCard></div>
}

function HistoryPage({ query }: { query: string }) {
  const [period, setPeriod] = useState('Aujourdâ€™hui')
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  useEffect(() => { getHistory().then(setAnalyses).catch(() => setAnalyses([])) }, [])
  const filtered = analyses.filter((item) => `${item.type} ${item.target} ${item.status}`.toLowerCase().includes(query.toLowerCase()))
  const [now] = useState(() => Date.now())
  const rangeMs = period === 'Aujourdâ€™hui' ? 24 * 60 * 60 * 1000 : period === '7 derniers jours' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
  const recent = filtered.filter((item) => now - new Date(item.created_at).getTime() <= rangeMs)
  return <div className="section-page"><PageTitle eyebrow="JOURNAL DES Ã‰VÃ‰NEMENTS" title="Historique" description="Retrouvez les analyses enregistrÃ©es par le backend pour votre compte." action={<select className="section-select" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Aujourdâ€™hui</option><option>7 derniers jours</option><option>30 derniers jours</option></select>} /><PageStats><StatCard icon="clock" label="Analyses sur la pÃ©riode" value={String(recent.length)} detail={period} /><StatCard icon="shield" label="RÃ©sultats sÃ»rs" value={String(recent.filter((item) => item.status.toUpperCase() === 'SAFE').length)} detail="Aucune menace signalÃ©e" tone="green" /><StatCard icon="warning" label="RÃ©sultats Ã  examiner" value={String(recent.filter((item) => item.status.toUpperCase() !== 'SAFE').length)} detail="Suspects ou incertains" tone="orange" /><StatCard icon="activity" label="Types dâ€™analyse" value={String(new Set(recent.map((item) => item.type)).size)} detail="Phishing et intrusion" tone="purple" /></PageStats><SectionCard><div className="section-card-heading"><div><h3>Historique des analyses</h3><p>{recent.length} rÃ©sultat(s) sur la pÃ©riode sÃ©lectionnÃ©e</p></div></div><div className="responsive-table"><table className="section-table"><thead><tr><th>Date</th><th>Type</th><th>Cible</th><th>RÃ©sultat</th><th>Score</th></tr></thead><tbody>{recent.map((item) => <tr key={item.id}><td className="mono-cell">{new Date(item.created_at).toLocaleString('fr-FR')}</td><td>{item.type}</td><td>{item.target}</td><td><span className={`table-badge ${item.status.toUpperCase() === 'SAFE' ? 'green' : item.status.toUpperCase() === 'UNKNOWN' ? 'amber' : 'red'}`}>{item.status}</span></td><td>{Math.round(item.score * 100)} %</td></tr>)}</tbody></table></div>{recent.length === 0 && <div className="section-empty">Aucune analyse trouvÃ©e sur cette pÃ©riode.</div>}</SectionCard></div>
}

function StatisticsPage() {
  const [range, setRange] = useState('7 derniers jours')
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    getHistory().then(setAnalyses).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Les statistiques sont indisponibles.')).finally(() => setLoading(false))
  }, [])

  const now = pageLoadedAt
  const start = new Date(now)
  if (range === 'Cette année') start.setMonth(0, 1)
  else start.setDate(now.getDate() - (range === '30 derniers jours' ? 29 : 6))
  start.setHours(0, 0, 0, 0)
  const filtered = analyses.filter((item) => {
    const date = new Date(item.created_at)
    return date >= start && date <= now
  })
  const buckets = range === 'Cette année'
    ? Array.from({ length: now.getMonth() + 1 }, (_, month) => {
        const date = new Date(now.getFullYear(), month, 1)
        return { label: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(date), items: filtered.filter((item) => new Date(item.created_at).getMonth() === month) }
      })
    : range === '30 derniers jours'
      ? Array.from({ length: 5 }, (_, week) => ({ label: `S${week + 1}`, items: filtered.filter((item) => Math.min(4, Math.floor((new Date(item.created_at).getTime() - start.getTime()) / (7 * 86400000))) === week) }))
      : Array.from({ length: 7 }, (_, day) => {
          const date = new Date(start)
          date.setDate(start.getDate() + day)
          return { label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date), items: filtered.filter((item) => new Date(item.created_at).toDateString() === date.toDateString()) }
        })
  const threats = filtered.filter((item) => ['MALICIOUS', 'SUSPICIOUS'].includes(item.status.toUpperCase()))
  const uncertain = filtered.filter((item) => item.status.toUpperCase() === 'UNKNOWN').length
  const safe = filtered.filter((item) => item.status.toUpperCase() === 'SAFE').length
  const highRisk = threats.filter((item) => item.score >= 0.7).length
  const mediumRisk = threats.length - highRisk
  const total = highRisk + mediumRisk + uncertain
  const highPct = total ? Math.round(highRisk / total * 100) : 0
  const mediumPct = total ? Math.round(mediumRisk / total * 100) : 0
  const typeCounts = filtered.reduce<Record<string, number>>((counts, item) => { counts[item.type] = (counts[item.type] ?? 0) + 1; return counts }, {})
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]
  const maxValue = Math.max(1, ...buckets.map(({ items }) => items.length))

  return <div className="section-page">
    <PageTitle eyebrow="VUE ANALYTIQUE" title="Statistiques" description="Indicateurs calculés depuis les analyses enregistrées par le backend." action={<select className="section-select" value={range} onChange={(event) => setRange(event.target.value)}><option>7 derniers jours</option><option>30 derniers jours</option><option>Cette année</option></select>} />
    {error && <div className="inline-notice" role="alert">{error}</div>}
    <PageStats><StatCard icon="warning" label="Résultats suspects" value={loading ? '—' : String(threats.length)} detail="Signaux à examiner" tone="orange" /><StatCard icon="shield" label="Résultats sûrs" value={loading ? '—' : String(safe)} detail="Classés sans menace" tone="green" /><StatCard icon="server" label="Cibles analysées" value={loading ? '—' : String(new Set(filtered.map((item) => item.target)).size)} detail="Sur la période" /><StatCard icon="activity" label="Analyses" value={loading ? '—' : String(filtered.length)} detail={range} tone="purple" /></PageStats>
    <div className="analytics-grid"><SectionCard className="analytics-main"><div className="section-card-heading"><div><h3>Analyses par période</h3><p>Résultats enregistrés sur {range.toLowerCase()}</p></div><div className="chart-legend"><span><i className="chart-blue" />Suspects</span><span><i className="chart-green" />Sûrs</span></div></div>{loading ? <div className="section-empty">Chargement des statistiques…</div> : <div className="analytics-bars" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>{buckets.map(({ label, items }) => { const risk = items.filter((item) => ['MALICIOUS', 'SUSPICIOUS'].includes(item.status.toUpperCase())).length; const safeCount = items.filter((item) => item.status.toUpperCase() === 'SAFE').length; return <div className="analytics-bar-group" key={label}><div className="analytics-bars-pair"><i title={`${risk} suspects`} style={{ height: `${risk / maxValue * 100}%` }} /><i title={`${safeCount} sûrs`} style={{ height: `${safeCount / maxValue * 100}%` }} /></div><span>{label}</span></div> })}</div>}</SectionCard>
      <SectionCard className="analytics-side"><div className="section-card-heading"><div><h3>Répartition du risque</h3><p>À partir des scores d’analyse</p></div></div><div className="severity-donut" style={{ background: `conic-gradient(#ef5960 0 ${highPct}%, #e7a83a ${highPct}% ${highPct + mediumPct}%, #22b982 ${highPct + mediumPct}% 100%)` }}><div><strong>{total}</strong><span>à examiner</span></div></div><div className="severity-legend"><span><i className="red-dot" />Élevé <b>{highPct}%</b></span><span><i className="amber-dot" />Moyen <b>{mediumPct}%</b></span><span><i className="green-dot" />Incertain <b>{total ? 100 - highPct - mediumPct : 0}%</b></span></div></SectionCard>
      <SectionCard className="analytics-insights"><div className="section-card-heading"><div><h3>Observations</h3><p>Calculées à partir des résultats disponibles</p></div></div><div className="insight-row"><span className="insight-icon blue"><Icon name="activity" /></span><p>{topType ? `Type le plus analysé : ${topType[0]} (${topType[1]}).` : 'Aucune analyse sur cette période.'}</p></div><div className="insight-row"><span className="insight-icon orange"><Icon name="warning" /></span><p>{threats.length} résultat(s) suspect(s) et {uncertain} résultat(s) incertain(s) à examiner.</p></div><div className="insight-row"><span className="insight-icon green"><Icon name="shield" /></span><p>{safe} résultat(s) classé(s) sans menace. Le backend ne fournit pas de données de blocage.</p></div></SectionCard>
    </div>
  </div>
}
const planOptions = [
  { name: 'Gratuit', price: '0 â‚¬', detail: 'Pour dÃ©couvrir CyberShield', users: '652', features: ['5 appareils protÃ©gÃ©s', 'Alertes essentielles', 'Historique 7 jours'] },
  { name: 'Premium', price: '9,99 â‚¬', detail: 'Pour une protection complÃ¨te', users: '542', features: ['Appareils illimitÃ©s', 'Analyse IA avancÃ©e', 'Historique 90 jours'] },
  { name: 'Business', price: '49,99 â‚¬', detail: 'Pour les Ã©quipes et entreprises', users: '51', features: ['Gestion multi-utilisateurs', 'Rapports personnalisÃ©s', 'Support prioritaire'] },
]

export function LegacySubscriptionsPage() {
  const [billing, setBilling] = useState('Mensuel')
  const [message, setMessage] = useState('')
  return <div className="section-page"><PageTitle eyebrow="GESTION DES OFFRES" title="Abonnements" description="Comparez les offres et suivez les abonnements actifs de vos utilisateurs." action={<div className="billing-toggle">{['Mensuel', 'Annuel'].map((value) => <button key={value} className={billing === value ? 'active' : ''} onClick={() => setBilling(value)}>{value}</button>)}</div>} />{message && <div className="inline-notice"><Icon name="shield" size={16} />{message}<button onClick={() => setMessage('')} aria-label="Fermer">Ã—</button></div>}<div className="plans-grid">{planOptions.map((plan, index) => <SectionCard className={`plan-card ${index === 1 ? 'recommended' : ''}`} key={plan.name}>{index === 1 && <span className="plan-ribbon">LE PLUS CHOISI</span>}<span className="plan-name">{plan.name}</span><p>{plan.detail}</p><div className="plan-price"><strong>{billing === 'Annuel' && index > 0 ? index === 1 ? '8,33' : '41,66' : plan.price.replace(' â‚¬', '')}</strong><span>â‚¬ / mois</span></div><small className="plan-users"><Icon name="users" size={14} />{plan.users} abonnÃ©s</small><button className={index === 1 ? 'primary-action' : 'secondary-action'} onClick={() => setMessage(`Lâ€™offre ${plan.name} est sÃ©lectionnÃ©e.`)}>{index === 1 ? 'GÃ©rer le plan' : 'Choisir cette offre'}</button><div className="plan-features">{plan.features.map((feature) => <span key={feature}><Icon name="shield" size={14} />{feature}</span>)}</div></SectionCard>)}</div><SectionCard><div className="section-card-heading"><div><h3>Abonnements rÃ©cents</h3><p>Les derniÃ¨res souscriptions et renouvellements</p></div><button className="secondary-action"><Icon name="file" size={15} />Exporter</button></div><div className="responsive-table"><table className="section-table"><thead><tr><th>Utilisateur</th><th>Offre</th><th>Date de renouvellement</th><th>Montant</th><th>Statut</th></tr></thead><tbody><tr><td>Camille Bernard</td><td>Premium</td><td>12 juin 2026</td><td>9,99 â‚¬</td><td><span className="table-badge green">Actif</span></td></tr><tr><td>Atelier Martin</td><td>Business</td><td>14 juin 2026</td><td>49,99 â‚¬</td><td><span className="table-badge green">Actif</span></td></tr><tr><td>Lucie Moreau</td><td>Premium</td><td>16 juin 2026</td><td>9,99 â‚¬</td><td><span className="table-badge amber">Ã€ renouveler</span></td></tr></tbody></table></div></SectionCard></div>
}

const subscriptionPlans: { id: SubscriptionPlan; name: string; price: number; description: string; features: string[] }[] = [
  { id: 'premium', name: 'Premium', price: 9.99, description: 'Pour une protection complète.', features: ['Appareils illimités', 'Analyse IA avancée', 'Historique 90 jours'] },
  { id: 'business', name: 'Business', price: 49.99, description: 'Pour les équipes et entreprises.', features: ['Gestion multi-utilisateurs', 'Rapports personnalisés', 'Support prioritaire'] },
]

const paymentStatusLabel: Record<PaymentStatus, string> = { pending: 'En attente', paid: 'Payé', failed: 'Échec', rejected: 'Refusé' }
const formatPaymentDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function SubscriptionsPage({ role, query }: { role: AccountRole; query: string }) {
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | string | null>(null)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<'all' | PaymentStatus>('all')
  const [methodFilter, setMethodFilter] = useState<'all' | 'stripe' | 'manual'>('all')
  const [manualPlan, setManualPlan] = useState<SubscriptionPlan>('premium')
  const [reference, setReference] = useState('')
  const [showManual, setShowManual] = useState(false)
  const isSuperadmin = role === 'superadmin'
  const refresh = () => getSubscriptionHistory().then(setPayments).catch((error) => setNotice(error instanceof Error ? error.message : 'Impossible de charger l’historique.')).finally(() => setLoading(false))
  useEffect(() => { void refresh() }, [])
  const visiblePayments = payments.filter((payment) => (filter === 'all' || payment.status === filter) && (methodFilter === 'all' || payment.method === methodFilter) && `${payment.user_email} ${payment.plan} ${payment.reference ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const reviewCount = payments.filter((payment) => payment.method === 'manual' && payment.status === 'pending').length
  const paidTotal = payments.filter((payment) => payment.status === 'paid').reduce((total, payment) => total + payment.amount_cents, 0)

  const buyWithStripe = async (plan: SubscriptionPlan) => {
    setSaving(plan); setNotice('')
    try { const result = await startStripeCheckout(plan); window.location.assign(result.checkout_url) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Impossible de démarrer le paiement Stripe.') }
    finally { setSaving(null) }
  }
  const submitManual = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving('manual'); setNotice('')
    try { await submitManualPayment(manualPlan, reference.trim()); setReference(''); setShowManual(false); setNotice('Paiement transmis pour vérification.'); await refresh() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Impossible d’enregistrer le paiement manuel.') }
    finally { setSaving(null) }
  }
  const review = async (paymentId: number, approved: boolean) => {
    setSaving(paymentId); setNotice('')
    try { await verifyManualPayment(paymentId, approved); setNotice(approved ? 'Paiement confirmé et abonnement activé.' : 'Paiement refusé.'); await refresh() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'La vérification a échoué.') }
    finally { setSaving(null) }
  }
  const syncStripe = async () => {
    setSaving('sync'); setNotice('')
    try { const result = await syncStripeSubscriptionHistory(); setNotice(`${result.imported} ancien(s) paiement(s) Stripe importé(s).`); setLoading(true); await refresh() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'La synchronisation Stripe a échoué.') }
    finally { setSaving(null) }
  }

  return <div className="section-page">
    <PageTitle eyebrow={isSuperadmin ? 'CONTRÔLE FINANCIER' : 'OFFRES CYBERSHIELD'} title={isSuperadmin ? 'Historique des abonnements' : 'Abonnements'} description={isSuperadmin ? 'Consultez tous les paiements et validez les paiements manuels en attente.' : 'Choisissez une offre et suivez le statut de vos paiements.'} action={isSuperadmin ? <><button type="button" className="secondary-action" onClick={() => void syncStripe()} disabled={saving === 'sync'}><Icon name="card" size={15} />{saving === 'sync' ? 'Synchronisation…' : 'Synchroniser Stripe'}</button><button type="button" className="secondary-action" onClick={() => { setLoading(true); void refresh() }} disabled={loading}><Icon name="activity" size={15} />Actualiser</button></> : undefined} />
    {notice && <div className="inline-notice" role="status"><Icon name="shield" size={16} />{notice}<button type="button" aria-label="Fermer" onClick={() => setNotice('')}>×</button></div>}
    {isSuperadmin ? <>
      <PageStats><StatCard icon="card" label="Paiements enregistrés" value={String(payments.length)} detail="Stripe et paiements manuels" /><StatCard icon="bell" label="Paiements à vérifier" value={String(reviewCount)} detail="Saisie manuelle en attente" tone="orange" /><StatCard icon="activity" label="Montant confirmé" value={`${(paidTotal / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`} detail="Paiements confirmés" tone="green" /><StatCard icon="users" label="Abonnements actifs" value={String(new Set(payments.filter((payment) => payment.subscription_status === 'active').map((payment) => payment.subscription_id)).size)} detail="Tous les utilisateurs" tone="purple" /></PageStats>
      <SectionCard><div className="section-card-heading"><div><h3>Historique des paiements</h3><p>{visiblePayments.length} opération{visiblePayments.length === 1 ? '' : 's'} affichée{visiblePayments.length === 1 ? '' : 's'}</p></div><div className="subscription-filters"><label>Statut<select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | PaymentStatus)}><option value="all">Tous</option><option value="pending">En attente</option><option value="paid">Payés</option><option value="failed">Échecs</option><option value="rejected">Refusés</option></select></label><label>Moyen<select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value as 'all' | 'stripe' | 'manual')}><option value="all">Tous</option><option value="stripe">Stripe</option><option value="manual">Manuel</option></select></label></div></div>
        <div className="responsive-table"><table className="section-table"><thead><tr><th>Date</th><th>Utilisateur</th><th>Offre</th><th>Montant</th><th>Moyen</th><th>Référence</th><th>État du paiement</th><th>Abonnement</th><th>Vérification</th></tr></thead><tbody>{visiblePayments.map((payment) => <tr key={payment.payment_id}><td>{formatPaymentDate(payment.created_at)}</td><td>{payment.user_email}</td><td>{payment.plan === 'business' ? 'Business' : 'Premium'}</td><td>{(payment.amount_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: payment.currency.toUpperCase() })}</td><td>{payment.method === 'stripe' ? 'Stripe' : 'Manuel'}</td><td className="payment-reference">{payment.reference ?? '—'}</td><td><span className={`table-badge ${payment.status === 'paid' ? 'green' : payment.status === 'pending' ? 'amber' : 'red'}`}>{paymentStatusLabel[payment.status]}</span></td><td>{payment.subscription_status}</td><td>{payment.method === 'manual' && payment.status === 'pending' ? <div className="payment-review-actions"><button type="button" className="primary-action" disabled={saving === payment.payment_id} onClick={() => void review(payment.payment_id, true)}>Confirmer</button><button type="button" className="secondary-action" disabled={saving === payment.payment_id} onClick={() => void review(payment.payment_id, false)}>Refuser</button></div> : payment.verified_at ? <span title={payment.verified_by ?? undefined}>{formatPaymentDate(payment.verified_at)}</span> : payment.method === 'stripe' ? 'Confirmé par Stripe' : '—'}</td></tr>)}</tbody></table></div>
        {loading && <div className="section-empty">Chargement de l’historique des paiements…</div>}{!loading && visiblePayments.length === 0 && <div className="section-empty"><Icon name="card" size={22} />Aucun paiement pour ces filtres.</div>}
      </SectionCard>
    </> : <>
      <div className="plans-grid">{subscriptionPlans.map((plan) => <SectionCard className="plan-card" key={plan.id}><span className="plan-name">{plan.name}</span><p>{plan.description}</p><div className="plan-price"><strong>{plan.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</strong><span>€ / mois</span></div><div className="plan-features">{plan.features.map((feature) => <span key={feature}><Icon name="shield" size={14} />{feature}</span>)}</div><button type="button" className="primary-action" disabled={saving === plan.id} onClick={() => void buyWithStripe(plan.id)}>{saving === plan.id ? 'Redirection…' : 'Payer avec Stripe'}</button><button type="button" className="secondary-action" onClick={() => { setManualPlan(plan.id); setShowManual(true) }}>Déclarer un paiement manuel</button></SectionCard>)}</div>
      {showManual && <SectionCard className="invite-card"><div className="section-card-heading"><div><h3>Déclarer un paiement manuel</h3><p>Le paiement restera en attente jusqu’à sa vérification par le superadmin.</p></div></div><form onSubmit={submitManual}><label>Offre<select value={manualPlan} onChange={(event) => setManualPlan(event.target.value as SubscriptionPlan)}><option value="premium">Premium — 9,99 € / mois</option><option value="business">Business — 49,99 € / mois</option></select></label><label>Référence du paiement<input value={reference} onChange={(event) => setReference(event.target.value)} required maxLength={180} placeholder="Référence du virement ou reçu" /></label><button type="submit" className="primary-action" disabled={saving === 'manual'}>{saving === 'manual' ? 'Envoi…' : 'Envoyer pour vérification'}</button></form></SectionCard>}
      <SectionCard><div className="section-card-heading"><div><h3>Mes paiements</h3><p>Historique de vos opérations d’abonnement.</p></div></div><div className="responsive-table"><table className="section-table"><thead><tr><th>Date</th><th>Offre</th><th>Montant</th><th>Moyen</th><th>Référence</th><th>Statut</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.payment_id}><td>{formatPaymentDate(payment.created_at)}</td><td>{payment.plan === 'business' ? 'Business' : 'Premium'}</td><td>{(payment.amount_cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: payment.currency.toUpperCase() })}</td><td>{payment.method === 'stripe' ? 'Stripe' : 'Manuel'}</td><td>{payment.reference ?? '—'}</td><td><span className={`table-badge ${payment.status === 'paid' ? 'green' : payment.status === 'pending' ? 'amber' : 'red'}`}>{paymentStatusLabel[payment.status]}</span></td></tr>)}</tbody></table></div>{loading && <div className="section-empty">Chargement…</div>}{!loading && payments.length === 0 && <div className="section-empty">Aucun paiement pour le moment.</div>}</SectionCard>
    </>}
  </div>
}

interface UserRecord { name: string; email: string; role: string; status: string; lastSeen: string }
const initialUsers: UserRecord[] = [
  { name: 'Camille Bernard', email: 'camille@cybershield.ai', role: 'Administrateur', status: 'Actif', lastSeen: 'Ã€ lâ€™instant' },
  { name: 'Thomas Petit', email: 'thomas@cybershield.ai', role: 'Analyste', status: 'Actif', lastSeen: 'Il y a 12 min' },
  { name: 'Sarah Laurent', email: 'sarah@cybershield.ai', role: 'Analyste', status: 'Actif', lastSeen: 'Il y a 38 min' },
  { name: 'Nicolas Robert', email: 'nicolas@cybershield.ai', role: 'Lecteur', status: 'En attente', lastSeen: 'Invitation envoyÃ©e' },
]

export function LegacyUsersPage({ query }: { query: string }) {
  const [users, setUsers] = useState(initialUsers)
  const [showInvite, setShowInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const filtered = users.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()))
  const invite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUsers((current) => [...current, { name: email.split('@')[0], email, role: 'Lecteur', status: 'En attente', lastSeen: 'Invitation envoyÃ©e' }])
    setNotice(`Invitation envoyÃ©e Ã  ${email}`)
    setEmail('')
    setShowInvite(false)
  }
  return <div className="section-page"><PageTitle eyebrow="Ã‰QUIPE & ACCÃˆS" title="Utilisateurs" description="GÃ©rez les membres de votre espace, leurs rÃ´les et leurs accÃ¨s." action={<button className="primary-action" onClick={() => setShowInvite(!showInvite)}><Icon name="users" size={16} />Inviter un utilisateur</button>} />{notice && <div className="inline-notice"><Icon name="shield" size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Fermer">Ã—</button></div>}<PageStats><StatCard icon="users" label="Membres" value={`${users.length + 1}`} detail="Sur votre espace" /><StatCard icon="activity" label="Actifs maintenant" value="3" detail="ConnectÃ©s rÃ©cemment" tone="green" /><StatCard icon="bell" label="Invitations en attente" value="1" detail="Expire dans 7 jours" tone="orange" /><StatCard icon="shield" label="Administrateurs" value="1" detail="AccÃ¨s complet" tone="purple" /></PageStats>{showInvite && <SectionCard className="invite-card"><form onSubmit={invite}><label>Adresse e-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nom@entreprise.com" required /></label><label>RÃ´le<select defaultValue="Lecteur"><option>Lecteur</option><option>Analyste</option><option>Administrateur</option></select></label><button className="primary-action" type="submit">Envoyer lâ€™invitation</button></form></SectionCard>}<SectionCard><div className="section-card-heading"><div><h3>Membres de lâ€™espace</h3><p>{filtered.length} utilisateur{filtered.length > 1 ? 's' : ''}</p></div><button className="secondary-action"><Icon name="settings" size={15} />GÃ©rer les rÃ´les</button></div><div className="responsive-table"><table className="section-table"><thead><tr><th>Utilisateur</th><th>RÃ´le</th><th>Statut</th><th>DerniÃ¨re activitÃ©</th><th>Actions</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.email}><td><span className="user-cell"><i>{user.name.slice(0, 1).toUpperCase()}</i><span><b>{user.name}</b><small>{user.email}</small></span></span></td><td>{user.role}</td><td><span className={`table-badge ${user.status === 'Actif' ? 'green' : 'amber'}`}>{user.status}</span></td><td className="muted-cell">{user.lastSeen}</td><td><button className="table-action" aria-label={`Options pour ${user.name}`}><Icon name="more" /></button></td></tr>)}</tbody></table></div></SectionCard></div>
}

function UsersPage({ query }: { query: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const refresh = () => getManagedUsers().then(setUsers).catch((error) => setNotice(error instanceof Error ? error.message : 'Chargement impossible.')).finally(() => setLoading(false))
  useEffect(() => { void refresh() }, [])
  const filtered = users.filter((user) => `${user.full_name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()))
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setNotice('')
    try { await createManagedUser(email.trim(), password, fullName.trim()); setNotice(`Compte créé : ${email.trim()}`); setEmail(''); setFullName(''); setPassword(''); setShowCreate(false); await refresh() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'La création a échoué.') }
    finally { setSaving(false) }
  }
  const beginEdit = (user: ManagedUser) => {
    setEditing(user); setEditEmail(user.email); setEditName(user.full_name ?? ''); setEditPassword(''); setEditActive(user.is_active)
  }
  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true); setNotice('')
    try {
      await updateManagedUser(editing.id, { email: editEmail.trim(), full_name: editName.trim(), is_active: editActive, ...(editPassword ? { password: editPassword } : {}) })
      setNotice(`Profil de ${editEmail.trim()} mis à jour.`); setEditing(null); await refresh()
    } catch (error) { setNotice(error instanceof Error ? error.message : 'La modification a échoué.') }
    finally { setSaving(false) }
  }
  return <div className="section-page">
    <PageTitle eyebrow="GESTION DES ACCÈS" title="Utilisateurs" description="Consultez les comptes et créez de nouveaux accès." action={<button type="button" className="primary-action" onClick={() => setShowCreate((value) => !value)}><Icon name="users" size={16} />Créer un utilisateur</button>} />
    {notice && <div className="inline-notice" role="status"><Icon name="shield" size={16} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Fermer">×</button></div>}
    <PageStats><StatCard icon="users" label="Utilisateurs" value={String(users.length)} detail="Comptes enregistrés" /><StatCard icon="activity" label="Comptes actifs" value={String(users.filter((user) => user.is_active).length)} detail="Actifs dans le système" tone="green" /><StatCard icon="shield" label="Superadmins" value={String(users.filter((user) => user.role === 'superadmin').length)} detail="Accès administrateur" tone="purple" /><StatCard icon="bell" label="Comptes désactivés" value={String(users.filter((user) => !user.is_active).length)} detail="Accès inactifs" tone="orange" /></PageStats>
    {showCreate && <SectionCard className="invite-card"><div className="section-card-heading"><div><h3>Créer un compte</h3><p>Le mot de passe initial sera communiqué à l’utilisateur.</p></div></div><form onSubmit={create}><label>Nom complet<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} required /></label><label>Adresse e-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Mot de passe initial<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required /></label><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Création…' : 'Créer le compte'}</button></form></SectionCard>}
    {editing && <SectionCard className="invite-card"><div className="section-card-heading"><div><h3>Modifier le profil</h3><p>Le mot de passe reste inchangé si le champ est vide.</p></div><button type="button" className="secondary-action" onClick={() => setEditing(null)}>Fermer</button></div><form onSubmit={saveEdit}><label>Nom complet<input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} required /></label><label>Adresse e-mail<input type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} required /></label><label>Nouveau mot de passe<input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} minLength={8} maxLength={72} autoComplete="new-password" placeholder="Laisser vide pour conserver l’actuel" /></label><label className="csv-auto-toggle"><input type="checkbox" checked={editActive} onChange={(event) => setEditActive(event.target.checked)} />Compte actif</label><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le profil'}</button></form></SectionCard>}
    <SectionCard><div className="section-card-heading"><div><h3>Comptes enregistrés</h3><p>{filtered.length} utilisateur{filtered.length === 1 ? '' : 's'}</p></div><button type="button" className="secondary-action" onClick={() => { setLoading(true); void refresh() }} disabled={loading}><Icon name="settings" size={15} />Actualiser</button></div><div className="responsive-table"><table className="section-table"><thead><tr><th>Profil</th><th>Rôle</th><th>Statut</th><th>ID</th><th>Actions</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.id}><td><span className="user-cell"><i>{(user.full_name || user.email)[0].toUpperCase()}</i><span><b>{user.full_name || user.email.split('@')[0]}</b><small>{user.email}</small></span></span></td><td>{user.role === 'superadmin' ? 'Superadmin' : 'Utilisateur'}</td><td><span className={`table-badge ${user.is_active ? 'green' : 'amber'}`}>{user.is_active ? 'Actif' : 'Désactivé'}</span></td><td>{user.id}</td><td><button type="button" className="secondary-action" onClick={() => beginEdit(user)}>Modifier le profil</button></td></tr>)}</tbody></table></div>{loading && <div className="section-empty">Chargement des utilisateurs…</div>}{!loading && filtered.length === 0 && <div className="section-empty">Aucun utilisateur trouvé.</div>}</SectionCard>
  </div>
}

type WorkspaceSettings = { workspaceName: string; contactEmail: string; timezone: string; twoFactor: boolean; emailAlerts: boolean; autoBlock: boolean }
const defaultWorkspaceSettings: WorkspaceSettings = { workspaceName: 'CyberShield AI', contactEmail: '', timezone: 'Indian/Antananarivo', twoFactor: false, emailAlerts: true, autoBlock: false }
const settingsStorageKey = 'cybershield_workspace_settings'

function SettingsPage() {
  const [settings, setSettings] = useState<WorkspaceSettings>(() => {
    try { return { ...defaultWorkspaceSettings, ...JSON.parse(localStorage.getItem(settingsStorageKey) ?? '{}') as Partial<WorkspaceSettings> } }
    catch { return defaultWorkspaceSettings }
  })
  const [saved, setSaved] = useState(false)
  const update = <Key extends keyof WorkspaceSettings,>(key: Key, value: WorkspaceSettings[Key]) => setSettings((current) => ({ ...current, [key]: value }))
  const saveSettings = () => {
    localStorage.setItem(settingsStorageKey, JSON.stringify(settings))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2800)
  }
  const restoreSettings = () => {
    setSettings(defaultWorkspaceSettings)
    localStorage.setItem(settingsStorageKey, JSON.stringify(defaultWorkspaceSettings))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2800)
  }
  const toggle = (key: 'twoFactor' | 'emailAlerts' | 'autoBlock', label: string, detail: string) => <div className="setting-row"><div><strong>{label}</strong><p>{detail}</p></div><button type="button" className={`switch ${settings[key] ? 'on' : ''}`} onClick={() => update(key, !settings[key])} role="switch" aria-checked={settings[key]} aria-label={label}><i /></button></div>

  return <div className="section-page">
    <PageTitle eyebrow="PRÉFÉRENCES DE L’ESPACE" title="Paramètres" description="Enregistrez les préférences du tableau de bord sur cet appareil." action={<button type="button" className="primary-action" onClick={saveSettings}><Icon name="shield" size={15} />Enregistrer</button>} />
    {saved && <div className="inline-notice" role="status"><Icon name="shield" size={16} />Préférences enregistrées sur cet appareil.</div>}
    <div className="settings-grid"><SectionCard><div className="section-card-heading"><div><h3>Profil de l’espace</h3><p>Informations affichées dans votre espace local</p></div></div><form className="settings-form" onSubmit={(event) => { event.preventDefault(); saveSettings() }}><label>Nom de l’espace<input value={settings.workspaceName} onChange={(event) => update('workspaceName', event.target.value)} /></label><label>Adresse e-mail de contact<input type="email" value={settings.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} /></label><label>Fuseau horaire<select value={settings.timezone} onChange={(event) => update('timezone', event.target.value)}><option>Indian/Antananarivo</option><option>Europe/Paris</option><option>UTC</option></select></label><button type="submit" className="secondary-action">Enregistrer le profil</button></form></SectionCard>
      <SectionCard><div className="section-card-heading"><div><h3>Préférences de sécurité</h3><p>Ces choix sont locaux et ne déclenchent pas encore d’action côté serveur.</p></div></div><div className="settings-options">{toggle('twoFactor', 'Préférence pour la double authentification', 'La double authentification doit être implémentée dans le backend pour protéger la connexion.')}{toggle('emailAlerts', 'Alertes par e-mail', 'Enregistre votre préférence; un service d’envoi doit être configuré.')}{toggle('autoBlock', 'Préférence de blocage automatique', 'Aucun blocage réseau n’est effectué par cette version.')}</div></SectionCard>
      <SectionCard className="settings-danger"><div className="section-card-heading"><div><h3>Réinitialiser</h3><p>Rétablissez les valeurs initiales de cet espace local.</p></div></div><div className="setting-row"><div><strong>Restaurer les préférences par défaut</strong><p>Le changement est enregistré immédiatement.</p></div><button type="button" className="secondary-action" onClick={restoreSettings}>Restaurer</button></div></SectionCard>
    </div>
  </div>
}
function ProfilePage() {
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    getCurrentUser().then((user) => { setProfile(user); setFullName(user.full_name ?? '') })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Chargement du profil impossible.'))
      .finally(() => setLoading(false))
  }, [])
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setNotice(''); setError('')
    try {
      const updated = await updateMyProfile(fullName.trim(), password || undefined)
      setProfile(updated); setFullName(updated.full_name); setPassword(''); setNotice('Votre profil a été mis à jour.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'La mise à jour a échoué.') }
    finally { setSaving(false) }
  }
  return <div className="section-page">
    <PageTitle eyebrow="COMPTE PERSONNEL" title="Mon profil" description="Modifiez votre nom et votre mot de passe. Votre adresse e-mail reste affichée comme identifiant de connexion." />
    {notice && <div className="inline-notice" role="status">{notice}</div>}{error && <div className="inline-notice" role="alert">{error}</div>}
    {loading ? <SectionCard><div className="section-empty">Chargement du profil…</div></SectionCard> : <SectionCard className="invite-card"><div className="section-card-heading"><div><h3>Informations du compte</h3><p>Rôle : {profile?.role === 'superadmin' ? 'Superadministrateur' : 'Utilisateur'}</p></div></div><form onSubmit={save}><label>Nom complet<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} required /></label><label>Adresse e-mail<input type="email" value={profile?.email ?? ''} readOnly /></label><label>Nouveau mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} autoComplete="new-password" placeholder="Laisser vide pour ne pas le changer" /></label><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer mon profil'}</button></form></SectionCard>}
  </div>
}

function UserActivityPage({ query }: { query: string }) {
  const [activities, setActivities] = useState<AdminActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let mounted = true
    let inFlight = false
    const refresh = () => {
      if (inFlight) return
      inFlight = true
      getAllUserActivity()
        .then((items) => { if (mounted) { setActivities(items); setError('') } })
        .catch((cause: unknown) => { if (mounted) setError(cause instanceof Error ? cause.message : 'Chargement des activités impossible.') })
        .finally(() => { inFlight = false; if (mounted) setLoading(false) })
    }
    void refresh()
    const timer = window.setInterval(refresh, 15_000)
    return () => { mounted = false; window.clearInterval(timer) }
  }, [])
  const filtered = activities.filter((item) => `${item.user_email ?? ''} ${item.type} ${item.target} ${item.status}`.toLowerCase().includes(query.toLowerCase()))
  const threats = activities.filter((item) => ['MALICIOUS', 'SUSPICIOUS'].includes(item.status.toUpperCase())).length
  return <div className="section-page">
    <PageTitle eyebrow="SUPERVISION SUPERADMIN" title="Activités des utilisateurs" description="Historique des analyses de tous les comptes. Cette vue est réservée au superadmin et s’actualise automatiquement." />
    {error && <div className="inline-notice" role="alert">{error}</div>}
    <PageStats><StatCard icon="activity" label="Analyses enregistrées" value={String(activities.length)} detail="Tous les comptes" /><StatCard icon="users" label="Comptes concernés" value={String(new Set(activities.map((item) => item.user_email).filter(Boolean)).size)} detail="Comptes ayant une activité" tone="purple" /><StatCard icon="warning" label="Résultats suspects" value={String(threats)} detail="À examiner" tone="orange" /><StatCard icon="clock" label="Synchronisation" value="15 s" detail="Actualisation automatique" tone="green" /></PageStats>
    <SectionCard><div className="section-card-heading"><div><h3>Analyses des comptes</h3><p>{filtered.length} analyse(s) affichée(s)</p></div></div><div className="responsive-table"><table className="section-table"><thead><tr><th>Date</th><th>Utilisateur</th><th>Type</th><th>Cible</th><th>Résultat</th><th>Score</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString('fr-FR')}</td><td>{item.user_email ?? 'Compte supprimé ou système'}</td><td>{item.type}</td><td title={item.target}>{item.target}</td><td><span className={`table-badge ${item.status.toUpperCase() === 'SAFE' ? 'green' : item.status.toUpperCase() === 'UNKNOWN' ? 'amber' : 'red'}`}>{item.status}</span></td><td>{Math.round(item.score * 100)} %</td></tr>)}</tbody></table></div>{loading && <div className="section-empty">Chargement des activités…</div>}{!loading && filtered.length === 0 && <div className="section-empty">Aucune activité enregistrée.</div>}</SectionCard>
  </div>
}

function LogsPage({ query }: { query: string }) {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [level, setLevel] = useState('Tous les niveaux')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { getHistory().then(setAnalyses).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Le journal est indisponible.')).finally(() => setLoading(false)) }, [])
  const entries = analyses.map((item) => ({ item, tone: item.status.toUpperCase() === 'SAFE' ? 'success' : item.status.toUpperCase() === 'UNKNOWN' ? 'info' : 'warning' }))
    .filter(({ item, tone }) => `${item.type} ${item.target} ${item.status}`.toLowerCase().includes(query.toLowerCase()) && (level === 'Tous les niveaux' || (level === 'Avertissement' ? tone === 'warning' : level === 'Succès' ? tone === 'success' : tone === 'info')))
  const today = new Date().toDateString()
  const todayEntries = analyses.filter((item) => new Date(item.created_at).toDateString() === today)
  const warnings = analyses.filter((item) => ['MALICIOUS', 'SUSPICIOUS'].includes(item.status.toUpperCase())).length
  const exportLogs = () => downloadCsv('cybershield-journal.csv', [['Date', 'Type', 'Cible', 'Résultat', 'Score'], ...entries.map(({ item }) => [item.created_at, item.type, item.target, item.status, item.score])])
  return <div className="section-page"><PageTitle eyebrow="ACTIVITÉ DE LA PLATEFORME" title="Journal système" description="Historique réel des analyses enregistrées par le backend." action={<button type="button" className="secondary-action" onClick={exportLogs} disabled={entries.length === 0}><Icon name="file" size={15} />Télécharger le CSV</button>} />
    {error && <div className="inline-notice" role="alert">{error}</div>}
    <PageStats><StatCard icon="activity" label="Analyses aujourd’hui" value={loading ? '—' : String(todayEntries.length)} detail="Données du backend" /><StatCard icon="warning" label="Résultats suspects" value={loading ? '—' : String(warnings)} detail="À examiner" tone="orange" /><StatCard icon="shield" label="Résultats sûrs" value={loading ? '—' : String(analyses.filter((item) => item.status.toUpperCase() === 'SAFE').length)} detail="Analyses classées sans menace" tone="green" /><StatCard icon="clock" label="Entrées disponibles" value={loading ? '—' : String(analyses.length)} detail="Historique du compte" tone="purple" /></PageStats>
    <SectionCard className="logs-card"><div className="section-card-heading"><div><h3>Événements récents</h3><p>{entries.length} analyse(s) affichée(s)</p></div><select className="section-select" value={level} onChange={(event) => setLevel(event.target.value)}><option>Tous les niveaux</option><option>Avertissement</option><option>Succès</option><option>Information</option></select></div>
      <div className="logs-list">{entries.map(({ item, tone }) => <article className="log-row" key={item.id}><time>{new Date(item.created_at).toLocaleString('fr-FR')}</time><span className={`log-level ${tone}`}>{tone === 'warning' ? 'ALERTE' : tone === 'success' ? 'SÛR' : 'INFO'}</span><span className="log-source">{item.type}</span><strong>{item.status}</strong><code title={item.target}>{item.target}</code></article>)}</div>
      {loading && <div className="section-empty">Chargement du journal…</div>}{!loading && entries.length === 0 && <div className="section-empty">Aucun événement pour ces filtres.</div>}
    </SectionCard>
  </div>
}
function MessagesPage({ role }: { role: AccountRole }) {
  return <div className="section-page message-page">
    <PageTitle eyebrow="MESSAGERIE CYBERSHIELD" title="Messages" description={role === "superadmin" ? "Répondez aux demandes des utilisateurs dans leurs conversations." : "Échangez directement avec l’équipe superadmin."} />
    <SupportChat role={role} />
  </div>
}

function SupportInfoPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  return <div className="section-page">
    <PageTitle eyebrow="CENTRE D’AIDE" title="Support" description="Retrouvez les repères utiles ou contactez directement notre équipe." action={<button className="primary-action" type="button" onClick={() => onNavigate("Messages")}><Icon name="message" size={15} /> Ouvrir les messages</button>} />
    <SectionCard className="support-faq-card">
      <div className="section-card-heading"><div><h3>Aide CyberShield</h3><p>Quelques reperes pour utiliser votre espace.</p></div></div>
      <div className="support-faq-list"><span>Analyser une URL ou un message suspect</span><span>Comprendre une analyse réseau</span><span>Retrouver l’historique des résultats</span></div>
    </SectionCard>
  </div>
}
export function SectionPages({ page, query, onNavigate, role }: SectionPagesProps) {
  switch (page) {
    case 'Analyse IA': return <AnalysisPage role={role} />
    case 'Surveillance auto': return <AutoMonitoringPage />
    case 'Intégrations':
    case 'IntÃ©grations': return <IntegrationsPage role={role} />
    case 'Alertes': return <AlertsPage query={query} />
    case 'Historique': return <HistoryPage query={query} />
    case 'Statistiques': return <StatisticsPage />
    case 'Utilisateurs': return <UsersPage query={query} />
    case 'Mon profil': return <ProfilePage />
    case 'Activités utilisateurs':
    case 'ActivitÃ©s utilisateurs': return role === 'superadmin' ? <UserActivityPage query={query} /> : <div className="section-page"><PageTitle eyebrow="ACCÈS REFUSÉ" title="Accès réservé" description="Cette page est accessible uniquement au superadmin." /></div>
    case 'ParamÃ¨tres': return <SettingsPage />
    case 'Journal systÃ¨me': return <LogsPage query={query} />
    case 'Messages': return <MessagesPage role={role} />
    case 'Support': return <SupportInfoPage onNavigate={onNavigate} />
    default: return <div className="section-page"><PageTitle eyebrow="CYBERSHIELD AI" title={page} description="Cette section est prÃªte Ã  Ãªtre configurÃ©e." /><SectionCard><button className="primary-action" onClick={() => onNavigate('Tableau de bord')}>Retour au tableau de bord</button></SectionCard></div>
  }
}
