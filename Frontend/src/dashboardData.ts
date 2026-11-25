export type IconName = 'grid' | 'scan' | 'bell' | 'clock' | 'chart' | 'card' | 'users' | 'settings' | 'file' | 'help' | 'message' | 'shield' | 'search' | 'moon' | 'menu' | 'lock' | 'warning' | 'server' | 'arrow' | 'spark' | 'activity' | 'globe' | 'crown' | 'more' | 'chevron'

export interface SecurityAlert {
  icon: IconName
  tone: 'red' | 'amber' | 'green'
  title: string
  detail: string
  level: string
  time: string
}

export const navigationItems: { label: string; icon: IconName }[] = [
  { label: 'Surveillance auto', icon: 'activity' },
  { label: 'Tableau de bord', icon: 'grid' }, { label: 'Analyse IA', icon: 'scan' }, { label: 'Intégrations', icon: 'globe' },
  { label: 'Alertes', icon: 'bell' }, { label: 'Historique', icon: 'clock' },
  { label: 'Statistiques', icon: 'chart' },
  { label: 'Utilisateurs', icon: 'users' }, { label: 'Paramètres', icon: 'settings' },
  { label: 'Mon profil', icon: 'users' }, { label: 'Activités utilisateurs', icon: 'activity' },
  { label: 'Journal système', icon: 'file' }, { label: 'Support', icon: 'help' },
  { label: 'Messages', icon: 'message' },
]

export const securityAlerts: SecurityAlert[] = [
  { icon: 'warning', tone: 'red', title: 'Attaque par force brute détectée', detail: '192.168.1.45 · Tentatives multiples de connexion échouées', level: 'Élevé', time: '10:24' },
  { icon: 'scan', tone: 'amber', title: 'Scan de ports détecté', detail: '192.168.1.22 · Scan de ports sur plusieurs services', level: 'Moyen', time: '09:15' },
  { icon: 'activity', tone: 'green', title: 'Trafic anormal détecté', detail: '192.168.1.78 · Volume inhabituel de trafic sortant', level: 'Faible', time: '08:47' },
  { icon: 'warning', tone: 'red', title: 'Tentative d’intrusion détectée', detail: '192.168.1.90 · Motif d’attaque suspecté', level: 'Élevé', time: '07:30' },
]

export const weeklyAttacks = [
  { day: 'Lun', value: 41 }, { day: 'Mar', value: 18 }, { day: 'Mer', value: 22 },
  { day: 'Jeu', value: 31 }, { day: 'Ven', value: 42 }, { day: 'Sam', value: 24 },
  { day: 'Dim', value: 33 },
]

export const recentActivities = [
  { icon: 'users' as const, tone: 'purple', title: 'Nouvel utilisateur inscrit', detail: 'user@example.com', time: '10:24' },
  { icon: 'chart' as const, tone: 'orange', title: 'Analyse terminée', detail: 'Dataset network_logs.csv', time: '07:30' },
]
