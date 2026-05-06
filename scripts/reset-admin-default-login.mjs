import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const TARGET_EMAIL = 'johnpaultogonon123@gmail.com';
const TARGET_PASSWORD = 'janjan@123';

function readEnvFileIntoProcess() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const txt = readFileSync(envPath, 'utf8');
  txt.split(/\r?\n/).forEach((line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  });
}

readEnvFileIntoProcess();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Add them to .env, then run again.',
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function extractMissingColumn(error) {
  const msg = String(error?.message || '');
  const m = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
  return m ? m[1] : '';
}

async function updateAdminAccountRow(existingRow, patch) {
  let candidate = { ...patch };
  for (let i = 0; i < 8; i += 1) {
    const { error } = await admin.from('admin_account').update(candidate).eq('id', existingRow.id);
    if (!error) return true;
    const missing = extractMissingColumn(error);
    if (!missing || !(missing in candidate)) {
      throw new Error(`Could not update admin_account: ${error.message}`);
    }
    delete candidate[missing];
  }
  return false;
}

async function insertAdminAccountRow(patch) {
  let candidate = { ...patch };
  for (let i = 0; i < 8; i += 1) {
    const { error } = await admin.from('admin_account').insert(candidate);
    if (!error) return true;
    const missing = extractMissingColumn(error);
    if (!missing || !(missing in candidate)) {
      throw new Error(`Could not insert admin_account: ${error.message}`);
    }
    delete candidate[missing];
  }
  return false;
}

async function syncAdminAccountTable() {
  const { data, error } = await admin.from('admin_account').select('*').limit(1);
  if (error) throw new Error(`Could not read admin_account: ${error.message}`);

  const patch = {
    email: TARGET_EMAIL,
    role: 'Admin',
    password_plain: TARGET_PASSWORD,
    updated_at: new Date().toISOString(),
  };

  if (Array.isArray(data) && data.length > 0) {
    const row = data[0];
    if (row && row.id) {
      await updateAdminAccountRow(row, patch);
      return;
    }
  }
  await insertAdminAccountRow(patch);
}

async function findUserByEmail(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list auth users: ${error.message}`);
    const users = data?.users || [];
    const hit = users.find((u) => String(u.email || '').trim().toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < 1000) return null;
    page += 1;
  }
}

async function syncAuthUser() {
  const existing = await findUserByEmail(TARGET_EMAIL);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      email: TARGET_EMAIL,
      email_confirm: true,
      password: TARGET_PASSWORD,
      user_metadata: { role: 'admin' },
    });
    if (error) throw new Error(`Could not update auth user: ${error.message}`);
    return;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TARGET_EMAIL,
    password: TARGET_PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'admin' },
  });
  if (error) throw new Error(`Could not create auth user: ${error.message}`);
  if (!data?.user?.id) throw new Error('Auth user creation did not return a user id.');
}

async function run() {
  await syncAdminAccountTable();
  await syncAuthUser();
  console.log('Done. Account Management and Supabase Auth now use:');
  console.log(`Email: ${TARGET_EMAIL}`);
  console.log(`Password: ${TARGET_PASSWORD}`);
}

run().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
