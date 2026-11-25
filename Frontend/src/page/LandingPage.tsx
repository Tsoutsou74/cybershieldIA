import { useState } from 'react'
import { Icon } from '../components/Icon'
import './LandingPage.css'
import './LandingStickyNav.css'

interface LandingPageProps {
  onEnterDashboard: () => void
}

const landingLinks = [
  { href: '#accueil', label: 'Accueil' },
  { href: '#pourquoi', label: 'Pourquoi' },
  { href: '#comment', label: 'Comment utiliser' },
  { href: '#demo', label: 'Démo' },
  { href: '#apropos', label: 'À propos' },
]

const features = [
  { icon: 'shield' as const, title: 'Détection de phishing', text: 'Examinez des URL et des messages suspects en quelques secondes.', tone: 'mint' },
  { icon: 'activity' as const, title: 'Analyse des intrusions', text: 'Repérez les flux réseau à risque et les comportements anormaux.', tone: 'blue' },
  { icon: 'chart' as const, title: 'Vue claire des menaces', text: 'Suivez vos alertes, leur gravité et leur évolution.', tone: 'violet' },
  { icon: 'file' as const, title: 'Rapports accessibles', text: 'Retrouvez vos analyses et partagez les informations utiles.', tone: 'green' },
]

export function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [activeLink, setActiveLink] = useState('#accueil')
  const [demoPlaying, setDemoPlaying] = useState(false)

  return <div className="landing-page" id="accueil">
    <header className="landing-header">
      <a className="landing-brand" href="#accueil" aria-label="CyberShield AI, accueil" onClick={() => setActiveLink('#accueil')}><span className="landing-brand-mark"><Icon name="shield" size={25} /></span><span>CyberShield <b>AI</b></span></a>
      <nav className="landing-nav" aria-label="Navigation du site">
        {landingLinks.map((link) => <a key={link.href} className={activeLink === link.href ? 'active' : ''} href={link.href} aria-current={activeLink === link.href ? 'location' : undefined} onClick={() => setActiveLink(link.href)}>{link.label}</a>)}
      </nav>
      <button className="landing-signin" onClick={onEnterDashboard}><Icon name="users" size={17} /> Se Connecter</button>
    </header>

    <main>
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-copy">
          <span className="hero-kicker"><Icon name="activity" size={16} /> IA + cybersécurité</span>
          <h1 id="landing-title">Gardez une longueur d’avance sur <em>les menaces.</em></h1>
          <p>Une vue claire de vos alertes et des outils d’analyse pour examiner les signaux qui comptent.</p>
          <div className="hero-actions"><button className="landing-primary" onClick={onEnterDashboard}>Accéder au tableau de bord <Icon name="arrow" size={17} /></button><a className="landing-secondary" href="#demo"><span className="play-mark">▶</span> Découvrir la plateforme</a></div>
          <div className="hero-promises"><span><i /> Alertes centralisées</span><span><i /> Analyses assistées par IA</span><span><i /> Historique consultable</span></div>
        </div>

        <div className="hero-visual" aria-label="Aperçu du tableau de bord CyberShield">
          <div className="signal-orbit orbit-one" /><div className="signal-orbit orbit-two" />
          <div className="mini-dashboard">
            <div className="mini-top"><span className="mini-brand"><i /> CYBERSHIELD / MON RÉSEAU</span><span className="mini-online"><i /> ACTIF</span></div>
            <div className="mini-heading"><div><small>VUE D’ENSEMBLE</small><strong>Activité de sécurité</strong></div><span>7 derniers jours⌄</span></div>
            <div className="mini-metrics"><div><small>Événements analysés</small><b>2 481</b><span>+12,8 % cette semaine</span></div><div><small>Alertes à examiner</small><b className="metric-alert">08</b><span>3 priorité élevée</span></div></div>
            <div className="mini-chart-title"><b>Signaux réseau</b><span>● Détectés&nbsp;&nbsp; <i>●</i> Normaux</span></div>
            <div className="mini-chart"><div className="chart-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 520 125" preserveAspectRatio="none" aria-hidden="true"><path className="chart-fill" d="M0 101 C35 88 42 96 70 82 S105 91 133 68 S166 80 193 72 S227 43 255 61 S290 75 320 48 S348 64 375 45 S407 58 435 28 S469 49 490 22 S507 30 520 14 V125 H0Z"/><path className="chart-line" d="M0 101 C35 88 42 96 70 82 S105 91 133 68 S166 80 193 72 S227 43 255 61 S290 75 320 48 S348 64 375 45 S407 58 435 28 S469 49 490 22 S507 30 520 14"/></svg></div>
            <div className="mini-bottom"><span>09:00</span><span>11:00</span><span>13:00</span><span>15:00</span><span>17:00</span></div>
          </div>
          <div className="floating-alert alert-left"><span><Icon name="shield" size={16} /></span><div><small>Protection active</small><b>Réseau surveillé</b></div><i>✓</i></div>
          <div className="floating-alert alert-right"><span><Icon name="warning" size={16} /></span><div><small>Nouvelle alerte</small><b>Activité à vérifier</b></div></div>
          <div className="hero-stamp"><Icon name="scan" size={17} /><span>ANALYSE<br /><b>EN CONTINU</b></span></div>
        </div>

        <aside className="hero-note"><span className="note-icon"><Icon name="spark" size={20} /></span><small>UNE VUE, DES SIGNAUX PLUS CLAIRS</small><h2>Comprendre avant d’agir.</h2><p>Rassemblez les analyses et les alertes dans un espace conçu pour faciliter vos décisions.</p><a href="#pourquoi">Découvrir l’approche <Icon name="arrow" size={15} /></a></aside>
      </section>

      <section className="landing-how" id="comment"><div className="how-intro"><span className="section-overline">UN PARCOURS SIMPLE</span><h2>De l’analyse à l’action.</h2><p>Les informations utiles restent au même endroit, de la première vérification au suivi.</p></div><div className="how-step"><span className="step-number">01</span><span className="step-icon"><Icon name="scan" size={22} /></span><h3>Analyser</h3><p>Soumettez un lien, un message ou un fichier réseau à vérifier.</p><span className="step-rule" /></div><div className="how-step"><span className="step-number">02</span><span className="step-icon step-blue"><Icon name="activity" size={22} /></span><h3>Comprendre</h3><p>Consultez le niveau de risque et les résultats retournés par l’analyse.</p><span className="step-rule" /></div><div className="how-step"><span className="step-number">03</span><span className="step-icon step-violet"><Icon name="shield" size={22} /></span><h3>Agir</h3><p>Retrouvez les alertes et l’historique pour décider de la suite.</p></div></section>

      <section className="landing-features" id="pourquoi"><div className="features-heading"><div><span className="section-overline">CYBERSHIELD AI</span><h2>La sécurité, plus lisible.</h2></div><p>Les outils essentiels pour examiner les risques et garder une trace de votre activité.</p></div><div className="feature-grid">{features.map((feature, index) => <article className="feature-card" key={feature.title}><span className={`feature-icon ${feature.tone}`}><Icon name={feature.icon} size={22} /></span><div><small>0{index + 1} / OUTIL</small><h3>{feature.title}</h3><p>{feature.text}</p></div><button aria-label={`Ouvrir le tableau de bord : ${feature.title}`} onClick={onEnterDashboard}><Icon name="arrow" size={18} /></button></article>)}</div></section>

      <section className="landing-demo" id="demo" aria-labelledby="demo-title">
        <div className="demo-copy"><span className="section-overline">APERÇU RAPIDE</span><h2 id="demo-title">CyberShield en quelques secondes.</h2><p>Un aperçu animé du tableau de bord et des alertes.</p><button className="demo-enter" onClick={onEnterDashboard}>Découvrir la plateforme <Icon name="arrow" size={15} /></button></div>
        <div className={`demo-preview ${demoPlaying ? 'is-playing' : ''}`} aria-label="Aperçu animé du tableau de bord CyberShield">
          <div className="demo-window-bar"><span><i /> CYBERSHIELD AI</span><small>{demoPlaying ? 'ANALYSE EN COURS' : 'APERÇU DU TABLEAU DE BORD'}</small></div>
          <div className="demo-window-content"><div className="demo-side"><i /><i /><i /><i /></div><div className="demo-screen"><div className="demo-screen-head"><span>Vue d’ensemble</span><b>● Protégé</b></div><div className="demo-screen-stats"><div><small>Événements analysés</small><strong>2 481</strong></div><div><small>Alertes à examiner</small><strong className="demo-alert-count">08</strong></div></div><div className="demo-chart"><i /><i /><i /><i /><svg viewBox="0 0 420 75" preserveAspectRatio="none" aria-hidden="true"><path d="M0 62 C35 52 42 58 68 43 S108 54 134 34 S168 45 194 37 S228 16 254 30 S293 42 320 24 S350 34 377 17 S401 21 420 8" /></svg><span className="demo-scan-line" /></div><div className="demo-alert"><Icon name="warning" size={13} /><span>Activité inhabituelle détectée</span><b>ÉLEVÉ</b></div></div></div>
          <div className="demo-player-controls"><button type="button" onClick={() => setDemoPlaying((playing) => !playing)} aria-label={demoPlaying ? 'Mettre la démonstration en pause' : 'Lire la démonstration'}>{demoPlaying ? 'Ⅱ' : '▶'}</button><span className="demo-timeline"><i /></span><small>{demoPlaying ? '00:08' : '00:00'} / 00:18</small><span className="demo-hd">HD</span></div>
        </div>
      </section>
      <section className="landing-about" id="apropos" aria-labelledby="about-title">
        <div className="about-heading"><span className="about-mark"><Icon name="shield" size={21} /></span><span className="section-overline">À PROPOS DE CYBERSHIELD AI</span><h2 id="about-title">La cybersécurité, plus facile à comprendre.</h2></div>
        <div className="about-copy"><p>CyberShield AI rassemble des outils pour examiner les liens et messages suspects, suivre les signaux réseau et garder une trace des alertes.</p><p>Notre objectif : rendre les informations de sécurité plus claires, afin que chacun puisse mieux comprendre une menace et décider de la suite.</p><a href="#accueil">Retour à l’accueil <span aria-hidden="true">↑</span></a></div>
      </section>
    </main>

    <footer className="landing-footer"><a className="landing-brand footer-brand" href="#accueil"><span className="landing-brand-mark"><Icon name="shield" size={22} /></span><span>CyberShield <b>AI</b></span></a><span>Une meilleure lecture des signaux de sécurité.</span><button onClick={onEnterDashboard}>Ouvrir le tableau de bord <Icon name="arrow" size={15} /></button><small>© 2026 CyberShield AI</small></footer>
  </div>
}
