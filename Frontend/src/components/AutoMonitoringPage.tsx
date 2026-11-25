import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, CirclePause, CirclePlay, FileUp, Globe2, Network, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { analyzeCsv, analyzePhishing, getHistory, getToken, type Analysis, type IntrusionSummary } from '../service_rout/ApiService'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

const intervalMs = 15_000
const intrusionIntervalMs = 30_000
const maxCsvBytes = 20 * 1024 * 1024
const storageKey = `cs-monitor-targets-${getToken()?.slice(-12) ?? 'guest'}`
const riskTone = (item: Analysis) => ['MALICIOUS', 'SUSPICIOUS'].includes(item.status.toUpperCase()) ? 'danger' : item.status.toUpperCase() === 'SAFE' ? 'safe' : 'unknown'

export function AutoMonitoringPage({ compact = false, onOpen }: { compact?: boolean; onOpen?: () => void }) {
  const [targets, setTargets] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[] } catch { return [] }
  })
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(() => {
    try { return (JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]).length > 0 } catch { return false }
  })
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<Analysis[]>([])
  const [notice, setNotice] = useState<Analysis | null>(null)
  const [error, setError] = useState('')
  const [intrusionFile, setIntrusionFile] = useState<File | null>(null)
  const [intrusionRunning, setIntrusionRunning] = useState(false)
  const [intrusionBusy, setIntrusionBusy] = useState(false)
  const [intrusionSummary, setIntrusionSummary] = useState<IntrusionSummary | null>(null)
  const [intrusionLastRun, setIntrusionLastRun] = useState<Date | null>(null)
  const [intrusionError, setIntrusionError] = useState('')

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(targets)) }, [targets])
  useEffect(() => { getHistory().then(setHistory).catch(() => {}) }, [])

  useEffect(() => {
    if (!running || targets.length === 0) return
    let active = true
    let inFlight = false
    const scan = async () => {
      if (inFlight) return
      inFlight = true
      setBusy(true)
      for (const url of targets) {
        if (!active) break
        try {
          const result = await analyzePhishing(url)
          if (active) {
            setHistory((items) => [result, ...items].slice(0, 100))
            setNotice(result)
            setError('')
            window.setTimeout(() => setNotice((current) => current?.id === result.id ? null : current), 6500)
          }
        } catch (cause) {
          if (active) setError(cause instanceof Error ? cause.message : `Analyse impossible pour ${url}`)
        }
      }
      inFlight = false
      if (active) setBusy(false)
    }
    void scan()
    const timer = window.setInterval(() => { void scan() }, intervalMs)
    return () => { active = false; window.clearInterval(timer) }
  }, [running, targets])

  const runIntrusionScan = useCallback(async () => {
    if (!intrusionFile) return
    setIntrusionBusy(true)
    setIntrusionError('')
    try {
      const summary = await analyzeCsv(intrusionFile)
      setIntrusionSummary(summary)
      setIntrusionLastRun(new Date())
      void getHistory().then(setHistory).catch(() => undefined)
    } catch (cause) {
      setIntrusionError(cause instanceof Error ? cause.message : 'Analyse IDS impossible.')
    } finally {
      setIntrusionBusy(false)
    }
  }, [intrusionFile])

  useEffect(() => {
    if (!intrusionRunning || !intrusionFile) return
    let active = true
    let inFlight = false
    const scan = async () => {
      if (inFlight) return
      inFlight = true
      await runIntrusionScan()
      inFlight = false
    }
    void scan()
    const timer = window.setInterval(() => { if (active) void scan() }, intrusionIntervalMs)
    return () => { active = false; window.clearInterval(timer) }
  }, [intrusionFile, intrusionRunning, runIntrusionScan])

  const counts = useMemo(() => ({
    dangerous: history.filter((item) => riskTone(item) === 'danger').length,
    safe: history.filter((item) => riskTone(item) === 'safe').length,
    uncertain: history.filter((item) => riskTone(item) === 'unknown').length,
  }), [history])
  const totalAnalyses = history.length
  const percentage = (count: number) => totalAnalyses ? Math.round((count / totalAnalyses) * 100) : 0

  const addTarget = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = draft.trim()
    try {
      const url = new URL(value.includes('://') ? value : `https://${value}`)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
      const normalized = url.href.replace(/\/$/, '')
      if (!targets.includes(normalized) && targets.length < 10) {
        setTargets((items) => [...items, normalized])
        setRunning(true)
      }
      setDraft('')
      setError('')
    } catch { setError('Saisissez une URL http ou https valide.') }
  }

  const selectIntrusionFile = (file: File | null) => {
    setIntrusionError('')
    setIntrusionSummary(null)
    setIntrusionLastRun(null)
    if (!file) {
      setIntrusionFile(null)
      setIntrusionRunning(false)
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setIntrusionFile(null)
      setIntrusionRunning(false)
      setIntrusionError('Sélectionnez un fichier CSV de flux réseau.')
      return
    }
    if (file.size > maxCsvBytes) {
      setIntrusionFile(null)
      setIntrusionRunning(false)
      setIntrusionError('Le fichier dépasse la limite de 20 Mo.')
      return
    }
    setIntrusionFile(file)
  }

  if (compact) return <aside className="fixed bottom-4 left-1/2 z-40 w-[min(38rem,calc(100vw-1.5rem))] -translate-x-1/2" aria-label="État de la surveillance automatique">
    <Card className="rounded-2xl border-primary/30 bg-card/95 shadow-xl backdrop-blur">
      <CardContent className="flex flex-wrap items-center gap-3 p-3 sm:px-4">
        <span className={`size-2 shrink-0 rounded-full ${running ? busy ? 'animate-pulse bg-amber-500' : 'bg-emerald-500' : 'bg-muted-foreground'}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Surveillance {running ? busy ? 'en cours' : 'active' : 'en pause'}</p>
          <p className="text-xs text-muted-foreground">{targets.length} URL · IDS {intrusionRunning ? 'actif' : 'en pause'} · {counts.dangerous} menace(s) URL</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => running ? setRunning(false) : targets.length > 0 && setRunning(true)} disabled={!running && targets.length === 0}>
          {running ? 'Mettre en pause' : 'Démarrer'}
        </Button>
        <Button size="sm" onClick={onOpen}>Ouvrir la surveillance</Button>
      </CardContent>
    </Card>
  </aside>

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-24">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Centre de surveillance</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Surveillance automatique</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Les URL suivies sont contrôlées toutes les 15 secondes. Pour la détection d’intrusion, chargez un export CSV de flux autorisé : le moteur IDS le réanalyse toutes les 30 secondes tant que cette page est ouverte. Chaque analyse est conservée dans l’historique.</p></div>
      <Button onClick={() => setRunning((value) => !value)} disabled={!targets.length && !running}>{running ? <><CirclePause data-icon="inline-start" />Mettre en pause</> : <><CirclePlay data-icon="inline-start" />Démarrer la surveillance</>}</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="rounded-2xl"><CardContent className="flex items-center gap-3 p-5"><span className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive"><ShieldAlert /></span><div><p className="text-xs text-muted-foreground">Sites dangereux</p><strong className="text-2xl tabular-nums">{counts.dangerous}</strong><p className="text-xs text-muted-foreground">{percentage(counts.dangerous)} % des analyses</p></div></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="flex items-center gap-3 p-5"><span className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><ShieldCheck /></span><div><p className="text-xs text-muted-foreground">Sites à faible risque</p><strong className="text-2xl tabular-nums">{counts.safe}</strong><p className="text-xs text-muted-foreground">{percentage(counts.safe)} % des analyses</p></div></CardContent></Card>
      <Card className="rounded-2xl"><CardContent className="flex items-center gap-3 p-5"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground"><Activity /></span><div><p className="text-xs text-muted-foreground">À examiner</p><strong className="text-2xl tabular-nums">{counts.uncertain}</strong><p className="text-xs text-muted-foreground">{percentage(counts.uncertain)} % des analyses</p></div></CardContent></Card>
    </div>
    <Card className="rounded-2xl"><CardHeader><CardTitle>Sites suivis</CardTitle><CardDescription>Maximum 10 URL. Chaque contrôle est une nouvelle entrée d’historique.</CardDescription></CardHeader><CardContent className="space-y-4">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addTarget}><input className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" aria-label="URL à surveiller" placeholder="https://exemple.com" value={draft} onChange={(event) => setDraft(event.target.value)} /><Button type="submit" variant="outline" disabled={targets.length >= 10}>Ajouter une URL</Button></form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {targets.length ? <ul className="divide-y divide-border">{targets.map((url) => <li key={url} className="flex min-w-0 items-center gap-3 py-3"><Globe2 size={17} className="shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm" title={url}>{url}</span><button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Retirer ${url}`} onClick={() => setTargets((items) => items.filter((item) => item !== url))}><Trash2 size={16} /></button></li>)}</ul> : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ajoutez une URL que vous êtes autorisé à surveiller pour commencer.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><i className={`size-2 rounded-full ${running ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />{running ? busy ? 'Analyse en cours…' : 'Surveillance active' : 'Surveillance en pause'}</span><span>Cycle : 15 secondes · Dernière analyse enregistrée côté serveur</span></div>
    </CardContent></Card>
    <Card className="rounded-2xl border-primary/20"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Network className="text-primary" />Détection d’intrusion automatique</CardTitle><CardDescription className="mt-2">Importez uniquement des journaux de flux que vous êtes autorisé à examiner. Le fichier reste dans ce navigateur et n’est envoyé qu’au moment d’une analyse.</CardDescription></div><Badge variant={intrusionRunning ? 'default' : 'outline'}>{intrusionRunning ? intrusionBusy ? 'Analyse IDS en cours' : 'IDS actif' : 'IDS en pause'}</Badge></div></CardHeader><CardContent className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/35 bg-primary/5 p-4 sm:flex-row sm:items-center"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileUp /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{intrusionFile ? intrusionFile.name : 'Choisir un export de flux CSV'}</p><p className="text-xs text-muted-foreground">{intrusionFile ? `${(intrusionFile.size / 1024 / 1024).toFixed(2)} Mo · limite 20 Mo` : 'Colonnes compatibles CICIDS recommandées · fichier conservé uniquement pour cette session.'}</p></div><label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"><FileUp className="mr-2 size-4" />Sélectionner<input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => selectIntrusionFile(event.target.files?.[0] ?? null)} /></label></div>
      {intrusionError && <p role="alert" className="text-sm text-destructive">{intrusionError}</p>}
      {intrusionFile && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm"><span className="flex items-center gap-2"><i className={`size-2 rounded-full ${intrusionRunning ? intrusionBusy ? 'animate-pulse bg-amber-500' : 'bg-emerald-500' : 'bg-muted-foreground'}`} />{intrusionRunning ? intrusionBusy ? 'Classification des flux en cours…' : 'Réanalyse automatique active' : 'Réanalyse automatique en pause'}</span><span className="text-xs text-muted-foreground">{intrusionLastRun ? `Dernier passage : ${intrusionLastRun.toLocaleTimeString('fr-FR')}` : 'Aucune analyse IDS lancée'}</span><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void runIntrusionScan()} disabled={intrusionBusy}><RefreshCw data-icon="inline-start" />Analyser maintenant</Button><Button size="sm" onClick={() => setIntrusionRunning((value) => !value)} disabled={intrusionBusy}>{intrusionRunning ? <><CirclePause data-icon="inline-start" />Mettre en pause</> : <><CirclePlay data-icon="inline-start" />Activer l’IDS</>}</Button></div></div>}
      {intrusionSummary && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Flux examinés</p><strong className="text-xl tabular-nums">{intrusionSummary.total_flows}</strong></div><div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3"><p className="text-xs text-muted-foreground">Intrusions détectées</p><strong className="text-xl tabular-nums text-destructive">{intrusionSummary.malicious_flows}</strong></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">À vérifier</p><strong className="text-xl tabular-nums">{intrusionSummary.low_confidence_flows}</strong></div><div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Confiance moyenne</p><strong className="text-xl tabular-nums">{Math.round(intrusionSummary.mean_confidence * 100)}%</strong></div></div>}
      {intrusionSummary?.dominant_attack && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground"><ShieldAlert className="mr-2 inline size-4 text-amber-600" />Type d’attaque dominant : <strong>{intrusionSummary.dominant_attack}</strong></p>}
    </CardContent></Card>
    <Card className="rounded-2xl"><CardHeader><CardTitle>Résultats récents</CardTitle><CardDescription>Score de risque estimé par les modèles et flux de menaces configurés.</CardDescription></CardHeader><CardContent>{history.length ? <div className="space-y-2">{history.slice(0, 12).map((item) => <article key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"><span className={`size-2 rounded-full ${riskTone(item) === 'danger' ? 'bg-destructive' : riskTone(item) === 'safe' ? 'bg-emerald-500' : 'bg-amber-500'}`} /><span className="min-w-0 flex-1 truncate text-sm" title={item.target}>{item.target}</span><Badge variant={riskTone(item) === 'danger' ? 'destructive' : 'secondary'}>{item.status}</Badge><strong className="min-w-12 text-right text-sm tabular-nums">{Math.round(item.score * 100)}%</strong><time className="w-full text-right text-xs text-muted-foreground sm:w-auto">{new Date(item.created_at).toLocaleString('fr-FR')}</time></article>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">Les résultats apparaîtront après le premier cycle.</p>}</CardContent></Card>
    {notice && <div className={`fixed bottom-5 right-5 z-50 flex w-[min(28rem,calc(100vw-2.5rem))] items-center gap-3 rounded-xl border bg-card p-4 shadow-xl ${riskTone(notice) === 'danger' ? 'border-destructive/50' : 'border-border'}`} role="status" aria-live="polite"><span className={`grid size-9 shrink-0 place-items-center rounded-full ${riskTone(notice) === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>{riskTone(notice) === 'danger' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{riskTone(notice) === 'danger' ? 'Site potentiellement dangereux' : riskTone(notice) === 'safe' ? 'Site à faible risque' : 'Résultat à examiner'} · {Math.round(notice.score * 100)}%</p><p className="truncate text-xs text-muted-foreground">{notice.target}</p></div><Badge variant={riskTone(notice) === 'danger' ? 'destructive' : 'secondary'}>{notice.status}</Badge><button aria-label="Fermer la notification" onClick={() => setNotice(null)} className="px-1 text-lg text-muted-foreground">×</button></div>}
  </div>
}
