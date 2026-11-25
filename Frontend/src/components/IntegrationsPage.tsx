import { useCallback, useEffect, useState } from 'react'
import { ArrowUpRight, Cloud, Globe2, KeyRound, Network, RefreshCw, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { getThreatFeedStatus, syncThreatFeed, type AccountRole, type ThreatFeedStatus } from '../service_rout/ApiService'

const sources = [
  {
    id: 'web',
    title: 'Sites web et serveurs',
    description: 'Centralisez les journaux de vos sites, serveurs, DNS et pare-feu applicatifs.',
    providers: 'Cloudflare · AWS · Azure · hebergeurs · journaux applicatifs',
    method: 'API fournisseur, export de journaux ou agent installe sur un serveur autorise.',
    data: 'Requetes, evenements WAF, connexions et erreurs serveur.',
    icon: Globe2,
  },
  {
    id: 'identity',
    title: 'Identite et messagerie',
    description: 'Reperez les connexions inhabituelles et les messages de phishing signales.',
    providers: 'Microsoft 365 · Google Workspace · autres services compatibles',
    method: 'API officielle avec consentement administrateur.',
    data: 'Alertes de securite et evenements exposes par le fournisseur.',
    icon: KeyRound,
  },
  {
    id: 'social',
    title: 'Reseaux sociaux et marque',
    description: 'Surveillez les comptes professionnels et les tentatives d’usurpation visibles.',
    providers: 'Meta · LinkedIn · X · autres plateformes disposant d’API',
    method: 'API officielle pour les comptes de l’entreprise; veille de marque selon les sources autorisees.',
    data: 'Evenements et contenus auxquels l’API donne acces, ainsi que les liens suspects.',
    icon: Network,
  },
  {
    id: 'intel',
    title: 'Flux mondiaux de menaces',
    description: 'Actualisez les indicateurs de phishing et domaines malveillants connus.',
    providers: 'Flux de renseignement compatibles · listes de blocage gerees par l’entreprise',
    method: 'Synchronisation planifiee depuis des sources de confiance configurees.',
    data: 'Domaines, URL et indicateurs publies par ces sources; ils ne couvrent pas toutes les menaces.',
    icon: RefreshCw,
  },
  {
    id: 'cloud',
    title: 'Services cloud et depot de code',
    description: 'Regroupez les alertes de securite provenant des outils de travail de l’entreprise.',
    providers: 'GitHub · plateformes cloud · outils SaaS compatibles',
    method: 'API, webhook ou export d’audit configure par un administrateur.',
    data: 'Journaux d’audit, alertes et changements de configuration disponibles.',
    icon: Cloud,
  },
]

export function IntegrationsPage({ role }: { role: AccountRole }) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [feed, setFeed] = useState<ThreatFeedStatus | null>(null)
  const [feedError, setFeedError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const selected = sources.find((source) => source.id === selectedSource)

  const refreshStatus = useCallback(async () => {
    try { setFeed(await getThreatFeedStatus()); setFeedError('') }
    catch (error) { setFeedError(error instanceof Error ? error.message : 'Impossible de lire l’état du flux.') }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshStatus() }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshStatus])
  const synchronize = async () => {
    setSyncing(true); setFeedError('')
    try { setFeed(await syncThreatFeed()) }
    catch (error) { setFeedError(error instanceof Error ? error.message : 'Échec de la synchronisation.') }
    finally { setSyncing(false) }
  }
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('fr-FR') : 'Jamais'
  const feedLabel = feed?.status === 'online' ? 'Tous les flux connectés' : feed?.status === 'partial' ? 'Flux partiellement connectés' : feed?.status === 'syncing' ? 'Synchronisation…' : feed?.status === 'error' ? 'Erreur de connexion' : 'En attente de synchronisation'

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Veille multi-plateforme</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sources de surveillance</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Connectez les actifs de votre entreprise et les services qu’elle administre. Chaque fournisseur limite les donnees accessibles selon ses API et autorisations.</p>
      </div>
      <Badge variant="outline" className="gap-2 rounded-full px-3 py-1.5"><span className={`size-2 rounded-full ${feed?.status === 'online' ? 'bg-emerald-500' : feed?.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground'}`} />{feed?.feeds ? `${feed.feeds.filter((item) => item.status === 'online').length}/${feed.feeds.length} flux actifs` : 'Chargement des flux'}</Badge>
    </div>

    <Alert>
      <ShieldCheck />
      <AlertTitle>La surveillance doit etre configuree pour chaque source</AlertTitle>
      <AlertDescription>Il n’existe pas d’acces universel aux systemes internes de tous les sites. CyberShield peut reunir les journaux autorises, les API officielles et les flux de renseignement sur les menaces.</AlertDescription>
    </Alert>

    <Card className="rounded-2xl border-primary/30">
      <CardHeader><CardTitle>Recevoir les événements des plateformes</CardTitle><CardDescription>Point d’entrée webhook pour relier un service que vous administrez à CyberShield.</CardDescription></CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>Configurez <code className="rounded bg-muted px-1.5 py-0.5">INTEGRATION_WEBHOOK_SECRET</code> dans l’environnement du backend, puis envoyez les événements à <code className="break-all rounded bg-muted px-1.5 py-0.5">POST /webhooks/events</code> avec l’en-tête <code className="rounded bg-muted px-1.5 py-0.5">X-CyberShield-Signature: sha256=&lt;HMAC-SHA256 du corps brut&gt;</code>.</p>
        <pre className="overflow-x-auto rounded-xl bg-muted p-3 text-xs text-foreground">{`{"provider":"meta","type":"url","target":"https://exemple.com/login"}\n{"provider":"cloudflare","type":"intrusion","source_ip":"203.0.113.8","features":{"Flow Duration":1200,"SYN Flag Count":1}}`}</pre>
        <p>Les fournisseurs comme Meta signent leurs webhooks avec leur propre format : utilisez une fonction relais côté serveur pour vérifier la signature du fournisseur, traduire l’événement vers ce format et signer le corps avec le secret CyberShield. L’application n’accède pas aux comptes Facebook et ne contourne pas leurs autorisations. N’envoyez que les événements de comptes et systèmes dont vous avez l’autorisation.</p>
      </CardContent>
    </Card>

    <Card className="rounded-2xl border-primary/30">
      <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>{feed?.source ?? 'OpenPhish Community'}</CardTitle><CardDescription>Flux réel d’URL de phishing, synchronisé par le backend local.</CardDescription></div><Badge variant={feed?.status === 'online' ? 'default' : 'secondary'}>{feedLabel}</Badge></div></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">Indicateurs chargés</p><p className="font-semibold">{feed?.entry_count.toLocaleString('fr-FR') ?? '—'}</p></div><div><p className="text-muted-foreground">Dernière mise à jour</p><p className="font-semibold">{formatDate(feed?.last_updated_at ?? null)}</p></div><div><p className="text-muted-foreground">Prochaine vérification</p><p className="font-semibold">{formatDate(feed?.next_update_at ?? null)}</p></div></div>
        {feedError && <Alert variant="destructive"><AlertTitle>API indisponible</AlertTitle><AlertDescription>{feedError}. Vérifiez que le backend local est démarré.</AlertDescription></Alert>}
        {feed?.last_error && <Alert variant="destructive"><AlertTitle>Synchronisation échouée</AlertTitle><AlertDescription>{feed.last_error}. Les indicateurs déjà enregistrés sont conservés.</AlertDescription></Alert>}
        {feed?.preview_urls?.length ? <div><p className="mb-2 text-sm font-medium">Exemples du flux (non cliquables)</p><ul className="space-y-1 rounded-lg bg-muted p-3 font-mono text-xs">{feed.preview_urls.map((url) => <li key={url} className="break-all">{url}</li>)}</ul></div> : null}
        <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => void refreshStatus()}><RefreshCw data-icon="inline-start" />Actualiser l’état</Button>{role === 'superadmin' && <Button onClick={() => void synchronize()} disabled={syncing}><RefreshCw data-icon="inline-start" className={syncing ? 'animate-spin' : ''} />{syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}</Button>}</div>
        <p className="text-xs leading-5 text-muted-foreground">{feed?.license_note ?? 'Flux Community réservé à la démonstration et à un usage non commercial.'} Mise à jour automatique toutes les 12 heures lorsque le backend reste lancé. Pour un usage commercial, il faut une licence adaptée.</p>
      </CardContent>
    </Card>

    <div className="grid gap-4 md:grid-cols-2">
      {sources.map((source) => {
        const SourceIcon = source.icon
        return <Card key={source.id} className="rounded-2xl">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><SourceIcon /></span>
              <Badge variant="secondary">A configurer</Badge>
            </div>
            <CardTitle className="pt-2">{source.title}</CardTitle>
            <CardDescription>{source.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs leading-5 text-muted-foreground">{source.providers}</p>
            <Button variant="outline" className="w-fit" onClick={() => setSelectedSource(selectedSource === source.id ? null : source.id)}>
              {selectedSource === source.id ? 'Masquer les prerequis' : 'Voir les prerequis'}<ArrowUpRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      })}
    </div>

    {selected && <Card className="rounded-2xl">
      <CardHeader><CardTitle>Prerequis : {selected.title}</CardTitle><CardDescription>Cette version locale affiche les prerequis; elle ne connecte pas encore de compte et ne collecte aucun secret.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
        <div><p className="font-medium">Methode de connexion</p><p className="mt-1 text-muted-foreground">{selected.method}</p></div>
        <div><p className="font-medium">Donnees accessibles</p><p className="mt-1 text-muted-foreground">{selected.data}</p></div>
      </CardContent>
    </Card>}

    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground"><RefreshCw /></span><div><CardTitle>Mises a jour automatiques</CardTitle><CardDescription>Regles de detection et flux de renseignement sur les menaces</CardDescription></div></div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Le flux OpenPhish est actualisé automatiquement côté backend pendant son exécution. Les détections phishing utilisent les indicateurs synchronisés; la liste existante est gardée en cas d’échec réseau.</p>
        <Badge variant="outline">{feed?.status === 'online' ? 'Automatique · 12 h' : 'En attente'}</Badge>
      </CardContent>
    </Card>
  </div>
}
