import { useState } from 'react'

function AttackTrend() {
  const [period, setPeriod] = useState('7 derniers jours')
  return <section className="panel line-panel"><div className="panel-heading"><div><h2>Évolution des attaques</h2><p>Activité détectée sur votre réseau</p></div><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Période du graphique"><option>7 derniers jours</option><option>30 derniers jours</option><option>Cette année</option></select></div><svg className="line-chart" viewBox="0 0 560 220" role="img" aria-label={`Évolution des attaques : ${period}`}><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3168ff" stopOpacity=".24" /><stop offset="1" stopColor="#3168ff" stopOpacity="0" /></linearGradient></defs>{[24, 66, 108, 150, 192].map((y, index) => <g key={y}><line x1="52" y1={y} x2="548" y2={y} stroke="#15243a" strokeDasharray="2 5" /><text x="4" y={y + 4} fill="#91a0b7" fontSize="12">{200 - index * 50}</text></g>)}{[70, 148, 226, 304, 382, 460, 538].map((x) => <line key={x} x1={x} y1="20" x2={x} y2="192" stroke="#101d31" />)}<path d="M70 126 C100 120 120 83 148 66 S202 109 226 126 S281 99 304 87 S359 111 382 107 S436 67 460 52 S511 105 538 24 L538 192 L70 192Z" fill="url(#area)" /><path d="M70 126 C100 120 120 83 148 66 S202 109 226 126 S281 99 304 87 S359 111 382 107 S436 67 460 52 S511 105 538 24" fill="none" stroke="#3168ff" strokeWidth="3" />{[[70, 126], [148, 66], [226, 126], [304, 87], [382, 107], [460, 52], [538, 24]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4.5" fill="#3975ff" stroke="#102449" strokeWidth="2" />)}{['12 Mai', '13 Mai', '14 Mai', '15 Mai', '16 Mai', '17 Mai', '18 Mai'].map((label, index) => <text key={label} x={70 + index * 78} y="215" fill="#b5c0d1" fontSize="12" textAnchor="middle">{label}</text>)}</svg></section>
}

function AttackDistribution() {
  const categories = [['Brute Force', '35%', 'blue'], ['Port Scan', '25%', 'indigo'], ['DDoS', '20%', 'green'], ['Malware', '10%', 'orange'], ['Web Attack', '10%', 'red']]
  return <section className="panel distribution-panel"><div className="panel-heading"><div><h2>Répartition des attaques</h2><p>Incidents classés par type</p></div><button className="select-button">Par type <span>⌄</span></button></div><div className="distribution-content"><div className="donut attack-donut"><div className="donut-hole" /></div><div className="legend">{categories.map(([name, percentage, color]) => <div className="legend-row" key={name}><i className={color} /><span>{name}</span><b>{percentage}</b></div>)}</div></div></section>
}

export function AttackCharts() {
  return <><AttackTrend /><AttackDistribution /></>
}
