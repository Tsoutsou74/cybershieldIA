import { useState } from 'react'
import type { Analysis } from '../service_rout/ApiService'

const threatStatuses = new Set(['MALICIOUS', 'SUSPICIOUS'])
const renderedAt = Date.now()
const ranges = [{ label: '7 jours', days: 7 }, { label: '30 jours', days: 30 }, { label: '90 jours', days: 90 }]

export function ThreatMap({ analyses }: { analyses: Analysis[] }) {
  const [rangeDays, setRangeDays] = useState(30)
  const cutoff = renderedAt - rangeDays * 86400000
  const recent = analyses.filter((item) => new Date(item.created_at).getTime() >= cutoff)
  const threats = recent.filter((item) => threatStatuses.has(item.status.toUpperCase()))
  const targets = new Set(recent.map((item) => item.target).filter(Boolean)).size

  return <section className="panel map-panel">
    <div className="panel-heading"><div><h2>Activité surveillée</h2><p>Analyses enregistrées sur {rangeDays} jours</p></div><select className="section-select" aria-label="Période de l’activité surveillée" value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))}>{ranges.map((range) => <option key={range.days} value={range.days}>{range.label}</option>)}</select></div>
    <div className="world-map" aria-hidden="true"><svg viewBox="0 0 600 260"><path className="land" d="m48 69 25-22 39-8 22 9 33-4 22 15-7 17-22 4-8 17-20 3-11 21-21 2-8 28-15 2-6-22-18-9-11-20-21-4-9-19-18-3-7-17zm121 61 23 4 13 16-9 29-17 23-7 37-15 8-7-21 6-26-10-22 7-21zm74-72 17-20 38-11 26 7 27-8 35 8 22 14 40 2 29 18-5 17-24 4-8 19-30 2-19 14-31-3-13 18-27 1-10 18-24-5-16-18-19-4-12-17-24-2-12-21 7-20zm104 112 28-10 31 7 12 17-12 13-23 3-24-11zm119-38 24-10 31 8 15 16-18 10-28-5-22-10zm43 48 24 7 12 17-12 10-20-7-11-15z" /><g className="map-grid"><path d="M20 125h560M300 25v210M90 70h420M90 180h420" /></g></svg></div>
    <div className="overview-state-list"><div><span><small>Analyses</small><strong>{recent.length}</strong></span></div><div><span><small>Résultats suspects</small><strong>{threats.length}</strong></span></div><div><span><small>Cibles uniques</small><strong>{targets}</strong></span></div></div>
    <p className="text-xs text-muted-foreground">Les analyses actuelles ne contiennent pas de données de géolocalisation. La carte ne représente donc pas des attaques par pays.</p>
  </section>
}
export function NetworkPanels({ analyses }: { analyses: Analysis[] }) {
  return <ThreatMap analyses={analyses} />
}
