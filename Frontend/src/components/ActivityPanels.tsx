import { recentActivities } from '../dashboardData'
import { Icon } from './Icon'

interface ActivityPanelsProps {
  onNavigate: (page: string) => void
}

function RecentActivity({ onNavigate }: ActivityPanelsProps) {
  return <section className="panel recent-panel"><div className="panel-heading"><div><h2>Activités récentes</h2><p>Derniers événements</p></div><button className="text-link" onClick={() => onNavigate('Historique')}>Voir tout</button></div><div className="activity-list">{recentActivities.map((activity) => <div className="activity-row" key={activity.title}><span className={`activity-icon ${activity.tone}`}><Icon name={activity.icon} size={15} /></span><div><strong>{activity.title}</strong><span>{activity.detail}</span></div><time>{activity.time}</time></div>)}</div></section>
}

export function ActivityPanels({ onNavigate }: ActivityPanelsProps) {
  return <RecentActivity onNavigate={onNavigate} />
}
