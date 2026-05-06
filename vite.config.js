import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** GoTrue / SMTP quota errors — do not chain fallbacks that send more mail. */
function isAuthEmailRateLimitError(msg) {
  return /rate\s*limit|too\s+many\s+(requests|emails)|email\s+rate|429/i.test(String(msg || ''));
}

/** Strip invisible chars / smart quotes so GoTrue accepts the same address as the modal. */
function normalizeAuthEmail(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
  /* Fullwidth @ and . (common copy/paste issue) */
  s = s.replace(/\uFF20/g, '@').replace(/\uFF0E/g, '.');
  try {
    s = s.normalize('NFKC');
  } catch (e) {
    /* ignore */
  }
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
    s = s.slice(1, -1).trim();
  }
  return s.toLowerCase();
}

/** Dev/preview only: commit email+password to Supabase Auth with email_confirm (needs SUPABASE_SERVICE_ROLE_KEY in .env). */
function adminCommitAuthPlugin() {
  function attachMiddleware(middlewares) {
    middlewares.use((req, res, next) => {
      const path = String(req.url || '').split('?')[0];
      if (path !== '/api/admin-commit-auth-profile' || req.method !== 'POST') {
        return next();
      }

      const env = loadEnv('', process.cwd(), '');
      const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const anonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (!serviceKey || !supabaseUrl || !anonKey) {
        res.statusCode = 501;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            code: 'no_service_role',
            message:
              'Add SUPABASE_SERVICE_ROLE_KEY to .env (Dashboard → Settings → API). Restart dev server. New login email will apply immediately.',
          }),
        );
        return;
      }

      let buf = '';
      req.on('data', (c) => {
        buf += c;
      });
      req.on('end', async () => {
        try {
          const authHeader = req.headers.authorization || '';
          const m = authHeader.match(/^Bearer\s+(.+)$/i);
          if (!m) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Missing bearer token' }));
            return;
          }
          const jwt = m[1].trim();
          let body = {};
          try {
            body = JSON.parse(buf || '{}');
          } catch (e) {
            body = {};
          }

          const { createClient } = await import('@supabase/supabase-js');
          const anon = createClient(supabaseUrl, anonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data: userData, error: userErr } = await anon.auth.getUser(jwt);
          if (userErr || !userData?.user) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: userErr?.message || 'Invalid session' }));
            return;
          }
          const uid = userData.user.id;

          const emailIn = body.email != null ? normalizeAuthEmail(body.email) : '';
          const passwordIn = body.password != null ? String(body.password).trim() : '';
          const currentEmail = normalizeAuthEmail(userData.user.email || '');
          const wantEmailChange = Boolean(emailIn && emailIn !== currentEmail);

          if (!passwordIn && !wantEmailChange) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Nothing to update' }));
            return;
          }

          if (emailIn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailIn)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Invalid email format.' }));
            return;
          }

          const admin = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          if (passwordIn) {
            const { error: pwErr } = await admin.auth.admin.updateUserById(uid, { password: passwordIn });
            if (pwErr) {
              const pmsg = String(pwErr.message || '');
              if (!/different from the old password|same password|unchanged/i.test(pmsg)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: pwErr.message }));
                return;
              }
              /* Password matches current Auth — treat as no-op and continue. */
            }
          }

          let outUser = null;
          if (wantEmailChange) {
            const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
              page: 1,
              perPage: 1000,
            });
            if (!listErr && listData?.users?.length) {
              const taken = listData.users.find(
                (u) => normalizeAuthEmail(u.email || '') === emailIn && u.id !== uid,
              );
              if (taken) {
                res.statusCode = 409;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    ok: false,
                    error:
                      'That email is already used by another Auth user. In Supabase → Authentication → Users, remove or change that account first.',
                  }),
                );
                return;
              }
            }

            let emData = null;
            let emErr = null;
            /* One call with admin-confirmed email avoids extra confirmation emails vs {email} first + later confirm (reduces “email rate limit exceeded”). */
            let emailUpdatedWithConfirm = false;
            ({ data: emData, error: emErr } = await admin.auth.admin.updateUserById(uid, {
              email: emailIn,
              email_confirm: true,
            }));
            if (!emErr) emailUpdatedWithConfirm = true;

            if (emErr && isAuthEmailRateLimitError(emErr.message)) {
              res.statusCode = 429;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: false,
                  code: 'email_rate_limited',
                  error: String(emErr.message || 'Email rate limit exceeded'),
                }),
              );
              return;
            }

            if (emErr) {
              ({ data: emData, error: emErr } = await admin.auth.admin.updateUserById(uid, { email: emailIn }));
            }

            if (emErr && isAuthEmailRateLimitError(emErr.message)) {
              res.statusCode = 429;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: false,
                  code: 'email_rate_limited',
                  error: String(emErr.message || 'Email rate limit exceeded'),
                }),
              );
              return;
            }

            if (!emErr && !emailUpdatedWithConfirm) {
              await admin.auth.admin.updateUserById(uid, { email_confirm: true }).catch(() => {});
            }
            if (!emErr) {
              const gu = await admin.auth.admin.getUserById(uid);
              if (!gu.error && gu.data?.user) outUser = gu.data.user;
              else outUser = emData?.user ?? null;
            }
            if (emErr) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: emErr.message }));
              return;
            }
          } else if (passwordIn) {
            const { data: gu, error: guErr } = await admin.auth.admin.getUserById(uid);
            if (guErr) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: guErr.message }));
              return;
            }
            outUser = gu?.user ?? null;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, user: outUser }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
        }
      });
    });
  }

  return {
    name: 'admin-commit-auth-profile',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), adminCommitAuthPlugin()],
  /** Lets other PCs on the LAN open http://YOUR_IP:5173 so everyone hits the same dev server + Supabase (shared data before “real” hosting). */
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
