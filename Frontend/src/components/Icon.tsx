import type { IconName } from '../dashboardData'

const paths: Record<IconName, string> = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3m0-4h16M12 4v16',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0',
  clock: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v6l4 2',
  chart: 'M4 19V5m0 14h16M7 15l3-4 3 2 5-7m-1 0h1v1',
  card: 'M3 5h18v14H3zM3 9h18m-14 5h4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m10 10v-2a4 4 0 0 0-3-3.87m-1-11.13a4 4 0 0 1 0 7.75',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0-5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6M8 13h8m-8 4h8',
  help: 'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  message: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-4.9a8.5 8.5 0 1 1 16.1-4.6zM8 11h8m-8 4h5',
  shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zm-3-10 2 2 4-4',
  search: 'm21 21-4.34-4.34M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
  moon: 'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  lock: 'M5 11h14v10H5zm3 0V7a4 4 0 1 1 8 0v4m-4 4v2',
  warning: 'M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3l-7.6-13.1a2 2 0 0 0-3.4 0zM12 9v4m0 4h.01',
  server: 'M4 4h16v6H4zm0 10h16v6H4zm3-7h.01m0 10h.01m4-10h6m-6 10h6',
  arrow: 'M7 17 17 7M7 7h10v10',
  spark: 'm12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm-10-10h20m-10-10a15 15 0 0 1 0 20m0-20a15 15 0 0 0 0 20',
  crown: 'm2 8 5 4 5-8 5 8 5-4-2 12H4L2 8z',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  chevron: 'm9 18 6-6-6-6',
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
