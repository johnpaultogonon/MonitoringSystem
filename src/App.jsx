import { useEffect, useMemo, useState } from 'react';
import './App.css';
import darLogo from './assets/dar-logo.png';
import bagongPilipinasLogo from './assets/bagong-pilipinas-logo.png';
import { createClient } from '@supabase/supabase-js';

const bundledDashboardUrl = '/legacy-dashboard/index.html';
const userLogsApiBase = '/supabase-user-logs-api';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseAnonKey) : null;

/** After Auth login succeeds, mirror the password into `admin_account.password_plain` so it matches Auth. */
/** Avoid client updateUser after admin failure — it triggers another confirmation email and worsens GoTrue rate limits. */
function isSupabaseAuthEmailRateLimited(httpStatus, message) {
  if (httpStatus === 429) return true;
  return /rate\s*limit|too\s+many\s+(requests|emails)|email\s+rate/i.test(String(message || ''));
}

async function syncAdminAccountPasswordPlain(client, emailAddr, plain) {
  if (!client || !emailAddr || !plain) return;
  try {
    const { error } = await client
      .from('admin_account')
      .update({ password_plain: plain, updated_at: new Date().toISOString() })
      .ilike('email', emailAddr);
    if (error) console.warn('[MonitoringSystem] admin_account password mirror:', error.message);
  } catch (e) {
    console.warn('[MonitoringSystem] admin_account password mirror', e);
  }
}

function manilaNowParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function buildUserLogTimestamps() {
  const p = manilaNowParts();
  const date = `${p.year}-${p.month}-${p.day}`;
  const dateTime = `${date} ${p.hour}:${p.minute}:${p.second}`;
  return { date, dateTime };
}

function extractUserLogIdentity(sessionValue) {
  const user = sessionValue?.user;
  const emailValue = String(user?.email || '').trim();
  const meta = user?.user_metadata || {};
  const fullName =
    String(meta.full_name || meta.name || '').trim() ||
    (emailValue.includes('@') ? emailValue.split('@')[0] : emailValue) ||
    'RPBDD User';
  return {
    full_name: fullName,
    email: emailValue,
    role: String(meta.role || 'admin').trim() || 'admin',
    team: String(meta.team || meta.section_team || '').trim(),
  };
}

/** Remember “RPBDD Access → Login” so refresh stays on login instead of flashing welcome first. */
function persistPortalLoginIntent() {
  try {
    sessionStorage.setItem('rpbdd_portal_login_intent', '1');
  } catch {
    /* ignore */
  }
}

function clearPortalLoginIntent() {
  try {
    sessionStorage.removeItem('rpbdd_portal_login_intent');
  } catch {
    /* ignore */
  }
}

function shouldRestoreLoginPortalScreen() {
  try {
    return sessionStorage.getItem('rpbdd_portal_login_intent') === '1';
  } catch {
    return false;
  }
}

function resolveSignedOutPortalScreen() {
  return shouldRestoreLoginPortalScreen() ? 'login' : 'welcome';
}

/** If URL is /?logout=1, show the login form on first paint (no welcome flash). */
function readInitialAuthGate() {
  try {
    if (typeof window === 'undefined') {
      return { screen: 'welcome', checkingSession: true };
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('logout') === '1') {
      return { screen: 'login', checkingSession: false };
    }
    if (shouldRestoreLoginPortalScreen()) {
      return { screen: 'login', checkingSession: true };
    }
  } catch {
    /* ignore */
  }
  return { screen: 'welcome', checkingSession: true };
}

async function postUserLog(kind, sessionValue) {
  try {
    if (!sessionValue?.user) return;
    const { date, dateTime } = buildUserLogTimestamps();
    const identity = extractUserLogIdentity(sessionValue);
    const isLogin = kind === 'login';
    await fetch(`${userLogsApiBase}/${isLogin ? 'login' : 'logout'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...identity,
        date,
        log_date: date,
        login: isLogin ? dateTime : '',
        time_in: isLogin ? dateTime : '',
        logout: isLogin ? '' : dateTime,
        time_out: isLogin ? '' : dateTime,
      }),
    });
  } catch (e) {
    // Keep auth flow smooth even when user log write fails.
  }
}

function App() {
  const initialGate = useMemo(() => readInitialAuthGate(), []);
  const [loadError, setLoadError] = useState(false);
  const [screen, setScreen] = useState(initialGate.screen);
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(initialGate.checkingSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isDashboard = screen === 'dashboard';
  const dashboardUrl = useMemo(() => {
    if (!session?.user) return bundledDashboardUrl;
    const meta = session.user.user_metadata || {};
    const qs = new URLSearchParams();
    qs.set('email', String(session.user.email || '').trim().toLowerCase());
    qs.set(
      'name',
      String(meta.full_name || meta.name || '').trim() ||
        String(session.user.email || '').trim().split('@')[0] ||
        'RPBDD User',
    );
    qs.set('role', String(meta.role || 'admin').trim() || 'admin');
    qs.set('team', String(meta.team || meta.section_team || '').trim());
    return `${bundledDashboardUrl}?${qs.toString()}`;
  }, [session]);

  useEffect(() => {
    try {
      if (!session?.user) {
        localStorage.removeItem('rpbdd_current_user');
        return;
      }
      const meta = session.user.user_metadata || {};
      let prev = {};
      try {
        prev = JSON.parse(localStorage.getItem('rpbdd_current_user') || '{}');
      } catch {
        prev = {};
      }
      const payload = {
        ...prev,
        email: String(session.user.email || '').trim(),
        name:
          String(meta.full_name || meta.name || '').trim() ||
          String(session.user.email || '').trim().split('@')[0] ||
          'RPBDD User',
        role: String(meta.role || 'admin').trim() || 'admin',
        team: String(meta.team || meta.section_team || '').trim(),
      };
      localStorage.setItem('rpbdd_current_user', JSON.stringify(payload));
    } catch (e) {
      // Ignore storage errors.
    }
  }, [session]);
  const statusText = useMemo(() => {
    if (!hasSupabase) return 'Missing Supabase config. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
    if (checkingSession) return 'Checking session...';
    return '';
  }, [checkingSession]);

  useEffect(() => {
    if (!hasSupabase) {
      setCheckingSession(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('logout') === '1') {
      supabase.auth.getSession().then(({ data }) => {
        const active = data?.session ?? null;
        return postUserLog('logout', active).finally(() => supabase.auth.signOut());
      }).finally(() => {
        setSession(null);
        persistPortalLoginIntent();
        setScreen('login');
        setCheckingSession(false);
        params.delete('logout');
        const next = params.toString();
        const cleanUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      });
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const active = data.session ?? null;
      setSession(active);
      if (active) {
        clearPortalLoginIntent();
        setScreen('dashboard');
      } else {
        setScreen(resolveSignedOutPortalScreen());
      }
      setCheckingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const next = nextSession ?? null;
      setSession(next);
      if (next) {
        clearPortalLoginIntent();
        setScreen('dashboard');
      } else {
        /* Match getSession: signed out → welcome, unless user opened Login (persisted intent). */
        setScreen(resolveSignedOutPortalScreen());
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  /** Legacy dashboard runs in an iframe; Supabase session lives here. Forward auth updates from the child so login email/password stay in sync with admin_account. */
  useEffect(() => {
    if (!hasSupabase || !supabase) return;

    async function syncPortalSessionState() {
      try {
        await supabase.auth.refreshSession();
      } catch (e) {
        /* ignore */
      }
      var gs = await supabase.auth.getSession();
      var next = gs && gs.data && gs.data.session ? gs.data.session : null;
      if (next) setSession(next);
    }

    function onMessage(ev) {
      var data = ev.data;
      if (data && data.type === 'rpbdd-portal-refresh-session') {
        if (ev.origin !== window.location.origin) return;
        syncPortalSessionState();
        return;
      }
      if (!data || data.type !== 'rpbdd-admin-auth-sync') return;
      if (ev.origin !== window.location.origin) return;
      var id = data.id;
      var payload = data.payload && typeof data.payload === 'object' ? data.payload : {};
      var src = ev.source;
      if (!id || !src) return;

      function reply(extra) {
        try {
          src.postMessage(
            Object.assign({ type: 'rpbdd-admin-auth-sync-result', id: id }, extra || {}),
            window.location.origin,
          );
        } catch (e) {
          /* ignore */
        }
      }

      supabase.auth.getSession().then(async function (sessRes) {
        var session = sessRes && sessRes.data ? sessRes.data.session : null;
        var user = session && session.user ? session.user : null;
        if (!session || !user) {
          reply({ ok: false, noSession: true });
          return;
        }

        var bodyOut = {};
        if (payload.email) bodyOut.email = payload.email;
        if (payload.password) bodyOut.password = payload.password;

        var adminErrorHint = '';
        var adminRes = null;
        try {
          adminRes = await fetch('/api/admin-commit-auth-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + session.access_token,
            },
            body: JSON.stringify(bodyOut),
          });
          if (adminRes.status === 401) {
            var err401 = await adminRes.text();
            var msg401 = 'Invalid session';
            try {
              var j401 = JSON.parse(err401);
              if (j401.error) msg401 = String(j401.error);
            } catch (e401) {
              /* ignore */
            }
            reply({ ok: false, error: msg401 });
            return;
          }
          if (adminRes.status === 409) {
            var err409 = await adminRes.text();
            var msg409 = 'That email is already in use by another account.';
            try {
              var j409 = JSON.parse(err409);
              if (j409.error) msg409 = String(j409.error);
            } catch (e409) {
              /* ignore */
            }
            reply({ ok: false, error: msg409 });
            return;
          }
          if (adminRes.status === 429) {
            var err429 = await adminRes.text();
            var msg429 = 'Email rate limit exceeded. Wait a few minutes before changing email again.';
            try {
              var j429 = JSON.parse(err429);
              if (j429.error) msg429 = String(j429.error);
            } catch (e429) {
              /* ignore */
            }
            reply({ ok: false, error: msg429 });
            return;
          }
          if (adminRes.status === 501) {
            /* no SUPABASE_SERVICE_ROLE_KEY — client updateUser below */
          } else if (adminRes.ok) {
            var adminJson = await adminRes.json();
            if (adminJson && adminJson.ok) {
              await syncPortalSessionState();
              reply({ ok: true, pendingEmailChange: false });
              return;
            }
            adminErrorHint = String((adminJson && adminJson.error) || 'Auth update failed');
          } else {
            var errText = await adminRes.text();
            try {
              var ej = JSON.parse(errText);
              if (ej.error) adminErrorHint = String(ej.error);
            } catch (e) {
              /* ignore */
            }
            if (!adminErrorHint) adminErrorHint = 'Auth update failed (HTTP ' + adminRes.status + ')';
          }
        } catch (fetchErr) {
          adminErrorHint = '';
        }

        if (
          adminRes &&
          adminErrorHint &&
          isSupabaseAuthEmailRateLimited(adminRes.status, adminErrorHint)
        ) {
          reply({
            ok: false,
            error:
              adminErrorHint +
              ' Wait several minutes, then save again (avoid repeating while testing).',
          });
          return;
        }

        supabase.auth.updateUser(payload).then(async function (updRes) {
          if (updRes.error) {
            var msg = String(updRes.error.message || 'Auth update failed');
            if (/different from the old password|same password|unchanged/i.test(msg)) {
              await syncPortalSessionState();
              reply({ ok: true, pendingEmailChange: false });
              return;
            }
            if (adminErrorHint) msg = adminErrorHint + ' · Fallback: ' + msg;
            reply({ ok: false, error: msg });
            return;
          }
          var u = updRes.data && updRes.data.user;
          var pend = u && u.new_email ? String(u.new_email).trim() : '';
          await syncPortalSessionState();
          reply({
            ok: true,
            pendingEmailChange: !!pend,
            pendingEmail: pend,
          });
        });
      });
    }

    window.addEventListener('message', onMessage);
    return function () {
      window.removeEventListener('message', onMessage);
    };
  }, [hasSupabase, setSession]);

  async function handleLogin(event) {
    event.preventDefault();
    if (!hasSupabase || !supabase) {
      setAuthError('Supabase is not configured.');
      return;
    }
    setAuthError('');
    setBusy(true);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword,
    });
    setBusy(false);
    if (error) {
      const msg = String(error.message || 'Login failed.');
      if (/invalid login credentials/i.test(msg)) {
        setAuthError(
          'Invalid email or password. If you recently changed your email in Account Management, use your previous email until you open the confirmation link Supabase sent (check inbox / Junk). If you only changed the password, open Edit Admin Account, type the new password, and save again — then use that password.',
        );
      } else if (/email not confirmed/i.test(msg)) {
        setAuthError('Email is not confirmed yet. Please verify your email first.');
      } else {
        setAuthError(msg);
      }
      return;
    }
    const active = data?.session ?? null;
    if (active) {
      await postUserLog('login', active);
      await syncAdminAccountPasswordPlain(supabase, trimmedEmail, trimmedPassword);
      clearPortalLoginIntent();
      setSession(active);
      setScreen('dashboard');
      setCheckingSession(false);
    } else {
      const { data: next } = await supabase.auth.getSession();
      if (next?.session) {
        await postUserLog('login', next.session);
        await syncAdminAccountPasswordPlain(supabase, trimmedEmail, trimmedPassword);
        clearPortalLoginIntent();
        setSession(next.session);
        setScreen('dashboard');
        setCheckingSession(false);
      } else {
        setAuthError('Signed in but no active session was returned. Please try again.');
        return;
      }
    }
    setPassword('');
  }

  function renderWelcome() {
    return (
      <section className="portalCard welcomePortalCard">
        <header className="portalHeader">
          <img src={darLogo} alt="Department of Agrarian Reform logo" className="headerLogoDar" />
          <div className="headerText">
            <p>Regional Program Beneficiaries Development Division</p>
            <p>(RPBDD)</p>
            <h1>Monitoring System</h1>
          </div>
          <img src={bagongPilipinasLogo} alt="Bagong Pilipinas logo" className="headerLogoBagong" />
        </header>
        <div className="portalBody">
          <p className="kicker">Official Monitoring Portal</p>
          <h2>Welcome to RPBDD Portal</h2>
          <p className="portalSub">Please select your access level to continue.</p>
          <div className="accessGrid">
            <button
              type="button"
              className="accessCard adminCard"
              onClick={() => {
                persistPortalLoginIntent();
                setScreen('login');
              }}
            >
              <span className="accessBadge">Portal Access</span>
              <span className="accessIcon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <path
                    d="M12 3l6.5 2.7v5.1c0 4.3-2.6 7.6-6.5 9.2-3.9-1.6-6.5-4.9-6.5-9.2V5.7L12 3z"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinejoin="round"
                  />
                  <path d="M12 8.3v7.7" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
                </svg>
              </span>
              <strong>RPBDD Access</strong>
              <small>Open Monitoring Portal</small>
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderLogin() {
    return (
      <section className="portalCard authPortalCard">
        <div className="authPanel">
          <header className="authPanelHeader">
            <button
              type="button"
              className="authBack"
              onClick={() => {
                clearPortalLoginIntent();
                setScreen('welcome');
              }}
              aria-label="Back to welcome"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="authPortalLabel">Member Portal</p>
            <div className="authLockIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M7 10V8a5 5 0 0110 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h2>RPBDD Login</h2>
            <p className="authAccessLabel">Member Access</p>
          </header>

          <form className="authPanelBody" onSubmit={handleLogin}>
            {statusText ? <p className="hint">{statusText}</p> : null}
            {authError ? <p className="authErrorText">{authError}</p> : null}

            <label>
              Email Address
              <div className="fieldWrap">
                <span className="fieldIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="3" y="6" width="18" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your email" />
              </div>
            </label>

            <label>
              Password
              <div className="fieldWrap">
                <span className="fieldIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <path d="M7 10V8a5 5 0 0110 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="toggleVisibility"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
                      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
                      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M10.6 10.6a2 2 0 002.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path
                        d="M6.4 6.6C4.3 8.1 3 10 3 12c2 4 5.3 6 9 6 1.7 0 3.3-.4 4.8-1.2M9.3 4.4A9.8 9.8 0 0112 4c3.7 0 7 2 9 8-.6 1.9-1.5 3.4-2.6 4.6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <button type="submit" disabled={busy || !hasSupabase}>
              {busy ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <main className={isDashboard ? 'legacy-system-root' : 'welcome-root'}>
      {isDashboard ? (
        <>
          <iframe
            key={session?.user?.email ?? session?.user?.id ?? 'legacy-dash'}
            src={dashboardUrl}
            title="RPBDD Monitoring System"
            className="legacy-system-frame"
            onError={() => setLoadError(true)}
          />
          {loadError ? (
            <p className="legacy-system-error">
              Unable to load bundled legacy system page: {bundledDashboardUrl}
            </p>
          ) : null}
        </>
      ) : screen === 'login' ? (
        renderLogin()
      ) : (
        renderWelcome()
      )}
    </main>
  );
}

export default App;
