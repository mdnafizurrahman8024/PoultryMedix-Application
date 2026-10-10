import { useEffect, useState } from 'react'
import Dashboard from './Dashboard.jsx'
import Icon from './components/Icon.jsx'
import { useLanguage } from './context/useLanguage.js'
import { supabase } from './lib/supabase.js'
import { getCountries } from './data/countries.js'
import './App.css'
import ThemeToggle from './components/ThemeToggle.jsx'

function BrandMark({ compact = false }) {
  return (
    <img className={`brand-mark${compact ? ' brand-mark--compact' : ''}`} src="/images/logo.png" alt="" />
  )
}

function App() {
  const { language, setLanguage, t } = useLanguage()
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [location, setLocation] = useState('')
  const [remember, setRemember] = useState(true)
  const [shareData, setShareData] = useState(false)
  const [authMode, setAuthMode] = useState('password')
  const [isSignUp, setIsSignUp] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [status, setStatus] = useState({ type: '', key: '' })
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState(false)
  const [authInitializing, setAuthInitializing] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Unable to restore the Supabase session.', error)
        if (mounted) setAuthInitializing(false)
        return
      }
      if (mounted && data.session) {
        setDashboard(true)
        setUserName(data.session.user.user_metadata?.full_name || '')
      }
      if (mounted) setAuthInitializing(false)
    }).catch((error) => {
      console.error('Unable to restore the Supabase session.', error)
      if (mounted) setAuthInitializing(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setDashboard(Boolean(session))
      setAuthInitializing(false)
      if (session) setUserName(session.user.user_metadata?.full_name || '')
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const isPhone = authMode === 'phone'
  const isBangla = language === 'bn'
  const countries = getCountries(language)

  function mapAuthError(error) {
    const code = error?.code || ''
    const message = error?.message?.toLowerCase() || ''
    if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'authIncorrectPassword'
    if (code === 'user_already_exists' || message.includes('already registered') || message.includes('already been registered')) return 'authEmailExists'
    if (code === 'weak_password' || message.includes('password should be')) return 'authWeakPassword'
    if (message.includes('rate limit')) return 'authRateLimit'
    return 'authError'
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ type: '', key: '' })
    if (isSignUp) {
      const email = identity.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus({ type: 'error', key: 'authInvalidEmail' })
        return
      }
      if (password.length < 8) {
        setStatus({ type: 'error', key: 'authWeakPassword' })
        return
      }
    }
    setLoading(true)

    try {
      if (isPhone && otpSent) {
        const { error } = await supabase.auth.verifyOtp({
          phone: identity.trim(),
          token: otp.trim(),
          type: 'sms',
        })
        if (error) throw error
        setStatus({ type: 'success', key: 'signedIn' })
        setDashboard(true)
      } else if (isPhone) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: identity.trim(),
          options: { shouldCreateUser: false },
        })
        if (error) throw error
        setOtpSent(true)
        setStatus({ type: 'success', key: 'otpSent' })
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: identity.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setStatus({ type: 'success', key: 'accountCreated' })
      } else {
        const identityValue = identity.trim()
        const credentials = /^[+]?[0-9][\d\s()-]*$/.test(identityValue)
          ? { phone: identityValue }
          : { email: identityValue }
        const { data, error } = await supabase.auth.signInWithPassword({
          ...credentials,
          password,
        })
        if (error) throw error
        setStatus({ type: 'success', key: 'signedIn' })
        setUserName(data.user.user_metadata?.full_name || '')
        setDashboard(true)
      }
    } catch (error) {
      setStatus({ type: 'error', key: mapAuthError(error) })
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setStatus({ type: '', key: '' })
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    } catch (error) {
      setStatus({ type: 'error', key: mapAuthError(error) })
    } finally {
      setLoading(false)
    }
  }

  function switchMode(mode) {
    setAuthMode(mode)
    setIsSignUp(false)
    setOtpSent(false)
    setOtp('')
    setStatus({ type: '', key: '' })
  }

  function continueAsGuest() {
    setUserName('Guest')
    setDashboard(true)
  }

  if (dashboard) {
    return <Dashboard
      onLogout={() => setDashboard(false)}
      initialName={userName || (identity.includes('@') ? identity.split('@')[0] : '')}
      initialLocation={location ? new Intl.DisplayNames([language], { type: 'region' }).of(location) : ''}
    />
  }

  if (authInitializing) {
    return <main className="auth-initializing" role="status"><span className="auth-spinner auth-spinner--dark" />{t('pleaseWait')}</main>
  }

  return (
    <main className="app-shell">
      <section className="story-panel" aria-label={t('brand')}>
        <div className="story-topline">
          <a className="brand" href="#home" aria-label={t('brand')}>
            <BrandMark />
            <span>Poultry<span className="brand-accent">Medix</span></span>
          </a>
          <ThemeToggle />
          <div className="language-switch" aria-label={t('language')}>
            <Icon name="globe" size={16} />
            <button
              type="button"
              className={!isBangla ? 'active' : ''}
              aria-pressed={!isBangla}
              onClick={() => setLanguage('en')}
            >EN</button>
            <span className="language-divider" />
            <button
              type="button"
              className={isBangla ? 'active' : ''}
              aria-pressed={isBangla}
              onClick={() => setLanguage('bn')}
            >বাংলা</button>
          </div>
        </div>

        <div className="story-content">
          <div className="eyebrow"><Icon name="spark" size={15} /> {t('eyebrow')}</div>
          <h1>{t('heroTitle')}</h1>
          <p className="story-description">{t('heroDescription')}</p>

          <div className="flock-art" aria-hidden="true">
            <div className="sun-disc" />
            <div className="field field-back" />
            <div className="field field-front" />
            <div className="coop">
              <div className="coop-roof" />
              <div className="coop-body"><span /><span /><span /></div>
              <div className="coop-door" />
            </div>
            <div className="chicken chicken-one"><Icon name="bird" size={61} /></div>
            <div className="chicken chicken-two"><Icon name="bird" size={43} /></div>
            <div className="art-stamp"><Icon name="leaf" size={20} /><span>{t('artStamp')}</span></div>
            <div className="sun-line sun-line-one" />
            <div className="sun-line sun-line-two" />
          </div>

          <div className="trust-note">
            <span className="trust-icon"><Icon name="shield" size={17} /></span>
            <span><strong>{t('trustTitle')}</strong><br />{t('trustDescription')}</span>
          </div>
        </div>
        <div className="story-footer"><span>{t('footerLine')}</span><span>Copyright 2025 PoultryMedix</span></div>
      </section>

      <section className="login-panel" id="home">
        <div className="mobile-brand-row">
          <a className="brand" href="#home" aria-label={t('brand')}>
            <BrandMark compact />
            <span>Poultry<span className="brand-accent">Medix</span></span>
          </a>
          <ThemeToggle />
          <div className="language-switch language-switch--mobile" aria-label={t('language')}>
            <button type="button" className={!isBangla ? 'active' : ''} aria-pressed={!isBangla} onClick={() => setLanguage('en')}>EN</button>
            <span className="language-divider" />
            <button type="button" className={isBangla ? 'active' : ''} aria-pressed={isBangla} onClick={() => setLanguage('bn')}>বাংলা</button>
          </div>
        </div>

        <div className="login-card">
          <img src="/images/logo.png" alt="PoultryMedix" className="h-16 w-auto mx-auto mb-6 drop-shadow-md" />
          <div className="card-heading">
            <div className="welcome-kicker">{isSignUp ? t('authSignUpKicker') : t('welcomeKicker')}</div>
            <h2>{isSignUp ? t('authSignUpTitle') : t('welcomeTitle')}</h2>
            <p>{isSignUp ? t('authSignUpDescription') : t('welcomeDescription')}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="identity">{isPhone ? t('phoneNumber') : isSignUp ? t('email') : t('phoneOrEmail')}</label>
            <div className="input-wrap">
              <Icon name={isPhone ? 'phone' : 'mail'} size={19} />
              <input
                id="identity"
                type={isPhone ? 'tel' : isSignUp ? 'email' : 'text'}
                autoComplete={isPhone ? 'tel' : isSignUp ? 'email' : 'username'}
                placeholder={isPhone ? t('phonePlaceholder') : isSignUp ? t('emailPlaceholder') : t('identityPlaceholder')}
                value={identity}
                onChange={(event) => setIdentity(event.target.value)}
                required
              />
            </div>

            {!isPhone && (
              <>
                <label className="field-label field-label--spaced" htmlFor="password">{t('password')}</label>
                <div className="input-wrap">
                  <Icon name="lock" size={19} />
                  <input
                    id="password"
                    type="password"
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    minLength={isSignUp ? 8 : undefined}
                    placeholder={isSignUp ? t('passwordMinimumHint') : t('passwordPlaceholder')}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {isPhone && otpSent && (
              <>
                <label className="field-label field-label--spaced" htmlFor="otp">{t('verificationCode')}</label>
                <div className="input-wrap">
                  <Icon name="lock" size={19} />
                  <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder={t('codePlaceholder')} value={otp} onChange={(event) => setOtp(event.target.value)} required />
                </div>
              </>
            )}

            <label className="field-label field-label--spaced" htmlFor="location">{t('location')}</label>
            <div className="input-wrap select-wrap">
              <Icon name="pin" size={19} className="pin-icon" />
              <select id="location" value={location} onChange={(event) => setLocation(event.target.value)} required>
                <option value="" disabled>{t('locationPlaceholder')}</option>
                {countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
              </select>
              <span className="select-chevron" />
            </div>

            <div className="form-options">
              <label className="check-row remember-row">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span className="custom-checkbox"><Icon name="check" size={13} /></span>
                <span>{t('remember')}</span>
              </label>
              <button className="text-button" type="button" onClick={() => setStatus({ type: 'info', key: 'resetInfo' })}>{t('forgotPassword')}</button>
            </div>

            <label className="consent-card">
              <input type="checkbox" checked={shareData} onChange={(event) => setShareData(event.target.checked)} />
              <span className="consent-check custom-checkbox"><Icon name="check" size={13} /></span>
              <span className="consent-shield"><Icon name="shield" size={19} /></span>
              <span className="consent-copy">{t('consent')}</span>
            </label>

            {status.key && <p className={`status-message status-${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>{t(status.key)}</p>}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? <><span className="auth-spinner" aria-hidden="true" />{t('pleaseWait')}</> : isPhone && otpSent ? t('verifyAndContinue') : isPhone ? t('sendCode') : isSignUp ? t('createAccount') : t('signIn')}
              {!loading && <Icon name="arrow" size={18} />}
            </button>
            {import.meta.env.DEV && !isSignUp && !isPhone && (
              <button className="outline-button guest-button" type="button" onClick={continueAsGuest}>
                {t('continueAsGuest')}
              </button>
            )}
          </form>

          <div className="or-divider"><span /><span>{t('or')}</span><span /></div>

          <button className="outline-button google-auth-button" type="button" onClick={handleGoogleSignIn} disabled={loading}>
            {loading ? <span className="auth-spinner auth-spinner--dark" aria-hidden="true" /> : <Icon name="google" size={19} />}
            {t('continueWithGoogle')}
          </button>
          {!isSignUp && <button className="outline-button" type="button" onClick={() => switchMode(isPhone ? 'password' : 'phone')} disabled={loading}>
            <Icon name={isPhone ? 'mail' : 'phone'} size={18} />
            {isPhone ? t('loginWithEmail') : t('loginWithPhone')}
          </button>}
          <button className="outline-button create-button" type="button" onClick={() => {
            setIsSignUp((current) => !current)
            setAuthMode('password')
            setOtpSent(false)
            setStatus({ type: '', key: '' })
          }} disabled={loading}>
            {isSignUp ? t('alreadyHaveAccount') : t('createAccount')} <Icon name="arrow" size={17} />
          </button>

          <p className="legal-note">{t('legalPrefix')} <a href="#terms">{t('terms')}</a> {t('and')} <a href="#privacy">{t('privacy')}</a>.</p>
        </div>
        <div className="mobile-footer">{t('mobileFooter')}</div>
      </section>
    </main>
  )
}

export default App
