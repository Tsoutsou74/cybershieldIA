import { Activity, CircleCheck, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { Analysis } from '../service_rout/ApiService'
import { Badge } from './ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface MetricsCardsProps {
  analyses: Analysis[]
  loading: boolean
}

export function MetricsCards({ analyses, loading }: MetricsCardsProps) {
  const threats = analyses.filter((item) => ['MALICIOUS', 'SUSPICIOUS'].includes(item.status.toUpperCase()))
  const safe = analyses.filter((item) => item.status.toUpperCase() === 'SAFE').length
  const uncertain = analyses.filter((item) => item.status.toUpperCase() === 'UNKNOWN').length
  const metrics = [
    { icon: Activity, label: 'Analyses enregistrées', value: analyses.length, detail: 'Toutes les analyses du compte', variant: 'secondary' as const },
    { icon: ShieldAlert, label: 'Menaces confirmées', value: threats.length, detail: 'Résultats malveillants ou suspects', variant: 'destructive' as const },
    { icon: ShieldCheck, label: 'Résultats sûrs', value: safe, detail: 'Classés SAFE par le backend', variant: 'default' as const },
    { icon: CircleCheck, label: 'À vérifier', value: uncertain, detail: 'Résultats sans conclusion ferme', variant: 'outline' as const },
  ]

  return <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs de sécurité">
    {metrics.map(({ icon: MetricIcon, label, value, detail, variant }) => <Card key={label} className="rounded-2xl border-border/80 bg-card/90 shadow-sm shadow-black/5">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="grid gap-1.5"><CardDescription>{label}</CardDescription><CardTitle className="text-3xl font-semibold tabular-nums">{loading ? '—' : value}</CardTitle></div>
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><MetricIcon aria-hidden="true" /></span>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-muted-foreground">{detail}</p>
        <Badge variant={variant} className="shrink-0">{loading ? '…' : 'Compte'}</Badge>
      </CardContent>
    </Card>)}
  </section>
}
