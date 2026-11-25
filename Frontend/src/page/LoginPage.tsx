import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Icon } from '../components/Icon'
import { login as loginUser, register, verifyLoginCode } from '../service_rout/ApiService'
import type { AccountRole, LoginStep } from '../service_rout/ApiService'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, FieldGroup, FieldLabel } from '../components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../components/ui/input-group'
import './LoginPage.css'
import './LoginPageModes.css'

interface LoginPageProps {
  onAuthenticated: (role: AccountRole) => void
  onBackHome: () => void
}

export function LoginPage({ onAuthenticated, onBackHome }: LoginPageProps) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [isSuperadmin, setIsSuperadmin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginStep, setLoginStep] = useState<LoginStep | null>(null)
  const [verificationCode, setVerificationCode] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isRegistering) await register(email.trim(), password)
      if (loginStep) {
        const role = await verifyLoginCode(verificationCode, loginStep.challenge_token)
        onAuthenticated(role)
      } else {
        const step = await loginUser(email.trim(), password, isSuperadmin ? 'superadmin' : 'user')
        setLoginStep(step)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Connexion impossible. Vérifiez vos informations et réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="login-page">
    <header className="login-header">
      <button className="login-brand" onClick={onBackHome} aria-label="Retour à l’accueil CyberShield"><span><Icon name="shield" size={24} /></span><b>CyberShield <i>AI</i></b></button>
      <button className="login-back" onClick={onBackHome}>← Retour au site</button>
    </header>
    <div className="login-shell">
      <section className="login-story" aria-label="Protection CyberShield">
        <span className="login-eyebrow"><Icon name="activity" size={15} /> ESPACE SÉCURISÉ</span>
        <h1>La sécurité de votre réseau, <em>à portée de vue.</em></h1>
        <p>Connectez-vous pour retrouver vos alertes, lancer une analyse et consulter votre historique CyberShield.</p>
        <div className="login-shield-art"><div className="shield-ring ring-back" /><div className="shield-ring ring-front" /><span className="shield-core"><Icon name="shield" size={45} /></span><i className="shield-spark spark-a" /><i className="shield-spark spark-b" /><i className="shield-spark spark-c" /><div className="shield-status"><span><i /> PROTECTION</span><b>ACTIVE</b></div></div>
        <div className="login-story-foot"><span><Icon name="lock" size={15} /> Espace réservé à votre compte</span><span>CYBERSHIELD / 01</span></div>
      </section>

      <section className="login-form-panel" aria-labelledby="login-title">
        <span className="form-overline">{isSuperadmin ? 'ACCÈS ADMINISTRATEUR' : 'VOTRE ESPACE CYBERSHIELD'}</span>
        <h2 id="login-title">{loginStep ? 'Vérification en deux étapes' : isRegistering ? 'Créer un compte' : isSuperadmin ? 'Espace superadmin.' : 'Bon retour.'}</h2>
        <p className="login-subtitle">{loginStep ? <>Un code à six chiffres a été envoyé à <b>{loginStep.email}</b>. Il est valable cinq minutes.</> : isRegistering ? 'Créez votre compte pour accéder au tableau de bord.' : isSuperadmin ? 'Connectez-vous avec le compte superadmin configuré par votre administrateur.' : 'Connectez-vous pour continuer vers votre tableau de bord.'}</p>
        {!loginStep && <div className="login-mode" role="tablist" aria-label="Type d’accès"><button type="button" role="tab" aria-selected={!isSuperadmin && !isRegistering} className={!isSuperadmin && !isRegistering ? 'selected' : ''} onClick={() => { setIsSuperadmin(false); setIsRegistering(false); setError('') }}>Utilisateur</button><button type="button" role="tab" aria-selected={isSuperadmin} className={isSuperadmin ? 'selected' : ''} onClick={() => { setIsSuperadmin(true); setIsRegistering(false); setError('') }}>Superadmin</button><button type="button" role="tab" aria-selected={isRegistering} className={isRegistering ? 'selected' : ''} onClick={() => { setIsSuperadmin(false); setIsRegistering(true); setError('') }}>Créer un compte</button></div>}
        <form onSubmit={submit}>
          <FieldGroup className="login-form">
            {loginStep ? <>
              <Field className="login-field"><FieldLabel htmlFor="login-otp" className="login-field-label">Code reçu par e-mail</FieldLabel><InputGroup className="login-input-group"><InputGroupInput id="login-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" required /></InputGroup></Field>
            </> : <>
            <Field className="login-field">
              <FieldLabel htmlFor="login-email" className="login-field-label">Adresse e-mail</FieldLabel>
              <InputGroup className="login-input-group">
                <InputGroupInput id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@entreprise.com" required />
                <InputGroupAddon align="inline-start"><Icon name="users" size={17} /></InputGroupAddon>
              </InputGroup>
            </Field>
            <Field className="login-field">
              <FieldLabel htmlFor="login-password" className="login-field-label">Mot de passe</FieldLabel>
              <InputGroup className="login-input-group">
                <InputGroupInput id="login-password" type={showPassword ? 'text' : 'password'} autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Saisissez votre mot de passe" required />
                <InputGroupAddon align="inline-start"><Icon name="lock" size={17} /></InputGroupAddon>
                <InputGroupAddon align="inline-end"><InputGroupButton aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Masquer' : 'Afficher'}</InputGroupButton></InputGroupAddon>
              </InputGroup>
            </Field>
            </>}
            {error && <Alert variant="destructive" className="login-error"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button className="login-submit w-full" type="submit" disabled={loading}>{loading ? 'Vérification en cours…' : loginStep ? 'Vérifier le code' : isRegistering ? 'Créer mon compte' : isSuperadmin ? 'Connexion superadmin' : 'Se connecter'}<ArrowRight data-icon="inline-end" /></Button>
            {loginStep && <Button variant="outline" type="button" onClick={() => { setLoginStep(null); setVerificationCode(''); setError('') }}>Retour à la connexion</Button>}
          </FieldGroup>
        </form>
        <div className="login-persist"><span><Icon name="shield" size={17} /></span><p><b>Votre espace vous attend.</b><br />Votre session reste enregistrée sur cet appareil après connexion.</p></div>
        <p className="login-help">Besoin d’aide ? <a href="mailto:support@cybershield.ai">Contacter le support</a></p>
      </section>
    </div>
    <footer className="login-footer"><span>© 2026 CyberShield AI</span><span>IA + cybersécurité</span><a href="#accueil" onClick={(event) => { event.preventDefault(); onBackHome() }}>Accueil</a></footer>
  </main>
}
