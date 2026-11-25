import type { Analysis } from '../service_rout/ApiService'
import { ArrowRight, CircleHelp, ShieldAlert } from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface AlertsPanelProps {
  query: string
  analyses: Analysis[]
  onViewAll: () => void
}

export function AlertsPanel({ query, analyses, onViewAll }: AlertsPanelProps) {
  const filteredAlerts = analyses.filter((item) => item.status.toUpperCase() !== 'SAFE' && `${item.type} ${item.target} ${item.status}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
  return <Card className="rounded-2xl border-border/80 bg-card/90 shadow-sm shadow-black/5">
    <CardHeader className="flex-row items-start justify-between gap-4">
      <div className="grid gap-1"><CardTitle>À examiner</CardTitle><CardDescription>Résultats non classés comme sûrs par le backend.</CardDescription></div>
      <Button variant="ghost" size="sm" onClick={onViewAll} className="shrink-0 rounded-lg">Tout voir<ArrowRight data-icon="inline-end" /></Button>
    </CardHeader>
    <CardContent>
      {filteredAlerts.length > 0 ? <div className="divide-y divide-border/70">
        {filteredAlerts.map((alert) => {
          const confirmed = ['MALICIOUS', 'SUSPICIOUS'].includes(alert.status.toUpperCase())
          const level = !confirmed ? 'Inconclusif' : alert.score >= 0.7 ? 'Risque élevé' : 'Suspect'
          return <article key={alert.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${confirmed ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}>
              {confirmed ? <ShieldAlert aria-hidden="true" /> : <CircleHelp aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{alert.type === 'phishing' ? 'Phishing' : 'Intrusion'} · {alert.status}</p>
              <p className="truncate text-xs text-muted-foreground" title={alert.target}>{alert.target}</p>
            </div>
            <div className="grid shrink-0 justify-items-end gap-1.5">
              <Badge variant={confirmed ? 'destructive' : 'secondary'}>{level}</Badge>
              <time className="text-[11px] text-muted-foreground" dateTime={alert.created_at}>{new Date(alert.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</time>
            </div>
          </article>
        })}
      </div> : <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
        <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><ShieldAlert aria-hidden="true" /></span>
        <p className="text-sm font-medium">Aucun résultat à examiner</p>
        <p className="mt-1 text-xs text-muted-foreground">{query ? `Aucune analyse ne correspond à « ${query} ».` : 'Les résultats suspects apparaîtront ici après une analyse.'}</p>
      </div>}
    </CardContent>
  </Card>
}
