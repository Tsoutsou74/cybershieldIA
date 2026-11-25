import { Icon } from './Icon'

export function SecurityFooter() {
  return <footer className="security-footer"><div className="footer-shield"><Icon name="shield" size={36} /></div><div className="footer-intro"><h2>CyberShield AI vous protège 24h/24 et 7j/7</h2><p>Notre intelligence artificielle analyse en continu votre réseau pour détecter et bloquer les menaces en temps réel.</p></div><div className="footer-feature"><span className="feature-icon blue"><Icon name="activity" /></span><div><strong>Détection en temps réel</strong><p>Surveillance continue 24h/24 et 7j/7</p></div></div><div className="footer-feature"><span className="feature-icon purple"><Icon name="spark" /></span><div><strong>IA avancée</strong><p>Algorithmes de détection intelligents</p></div></div><div className="footer-feature"><span className="feature-icon green"><Icon name="shield" /></span><div><strong>Protection complète</strong><p>Couverture de tous les points d’entrée</p></div></div></footer>
}
