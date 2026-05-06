(function () {
  'use strict';

  var EVENTS_API_BASE = '/supabase-events-api';
  var EVENTS_TABLE = 'add_new_event';
  var EVENT_CATEGORIES_TABLE = 'event_categories';
  /** After a failed query against display_name/position/photo, use legacy shape until reload. */
  var eventCategoriesDisplayColumnsKnown = null;
  /** dashboard_shared_settings may exist with old shape (theme only); fall back safely. */
  var sharedSettingsExtraColumnsKnown = null;

  function isMissingEventCategoryDisplayColumnsError(err) {
    var msg = String((err && err.message) || '');
    if (!/does not exist|column .* not found/i.test(msg)) return false;
    if (msg.indexOf('display_name') !== -1) return true;
    if (msg.indexOf('event_categories.position') !== -1) return true;
    if (msg.indexOf('event_categories.photo') !== -1) return true;
    if (/event_categories/i.test(msg) && /\bposition\b/i.test(msg) && msg.indexOf('sort_order') === -1)
      return true;
    if (/event_categories/i.test(msg) && /\bphoto\b/i.test(msg)) return true;
    return false;
  }
  var EVENT_ROW_SELECT =
    'event_id,title,description,location,dates_json,time_raw,time_display,category,status,input_by,recycled_at,created_at,updated_at,is_recycled,user_id';
  var TEAMS_API_BASE = '/supabase-teams-api';
  var MEMBERS_API_BASE = '/supabase-members-api';
  var BIRTHDAYS_API_BASE = '/supabase-birthdays-api';
  var BIRTHDAYS_TABLE = 'birthdate';
  var BIRTHDAY_OPTIONS_TABLE = 'birthdate_options';
  var BIRTHDAY_ROW_SELECT = 'birthday_id,name,position,section,photo,date_of_birth,created_at,updated_at,user_id';
  var TASKS_API_BASE = '/supabase-tasks-api';
  var PROFILE_NOTIFS_API_BASE = '/supabase-profile-notifications-api';
  var USER_LOGS_API_BASE = '/supabase-user-logs-api';
  var ADMIN_ACCOUNT_API_BASE = '/supabase-admin-account-api';
  var TEAM_EXPORT_PDF_API = '/supabase-team-export/pdf';
  var TEAM_EXPORT_PRINT_API = '/supabase-team-export/print';
  var SUPABASE_URL = 'https://wrwjbcpbsxnxnjqohros.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_-YxcXVQc0efHWo8NHKepjw_aNhv-e-V';

  if (!window.supabase || !window.supabase.createClient) {
    return;
  }

  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var TEAMS_TABLE = 'teams';
  var MEMBERS_TABLE = 'members';
  var TASK_LISTS_TABLE = 'task_lists';
  var SHARED_DASHBOARD_SETTINGS_TABLE = 'dashboard_shared_settings';

  function dispatchRpbddSharedDataChange() {
    try {
      window.dispatchEvent(new CustomEvent('rpbdd-shared-data-change'));
    } catch (evErr) {
      /* ignore */
    }
  }

  /** Push DB changes so all open dashboards refresh without manual reload (enable Realtime + publication per table in Supabase). */
  try {
    db
      .channel('rpbdd_shared_data_v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: EVENTS_TABLE }, function () {
        try {
          window.dispatchEvent(new CustomEvent('rpbdd-events-remote-change'));
        } catch (evErr) {
          /* ignore */
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: EVENT_CATEGORIES_TABLE }, function () {
        try {
          window.dispatchEvent(new CustomEvent('rpbdd-event-categories-change'));
        } catch (evErr) {
          /* ignore */
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: TEAMS_TABLE }, dispatchRpbddSharedDataChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: MEMBERS_TABLE }, dispatchRpbddSharedDataChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: BIRTHDAYS_TABLE }, dispatchRpbddSharedDataChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: TASK_LISTS_TABLE }, dispatchRpbddSharedDataChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: SHARED_DASHBOARD_SETTINGS_TABLE }, function (payload) {
        try {
          var nextTheme = '';
          var nextSidebarCollapsed = null;
          var nextDensity = '';
          if (payload && payload.new && payload.new.theme != null) nextTheme = String(payload.new.theme);
          else if (payload && payload.old && payload.old.theme != null) nextTheme = String(payload.old.theme);
          if (payload && payload.new && payload.new.sidebar_collapsed != null) {
            nextSidebarCollapsed = normalizeSharedSidebarCollapsed(payload.new.sidebar_collapsed);
          } else if (payload && payload.old && payload.old.sidebar_collapsed != null) {
            nextSidebarCollapsed = normalizeSharedSidebarCollapsed(payload.old.sidebar_collapsed);
          }
          if (payload && payload.new && payload.new.density != null) nextDensity = normalizeSharedDensity(payload.new.density);
          else if (payload && payload.old && payload.old.density != null) {
            nextDensity = normalizeSharedDensity(payload.old.density);
          }
          window.dispatchEvent(
            new CustomEvent('rpbdd-shared-dashboard-settings-change', {
              detail: { theme: nextTheme, sidebar_collapsed: nextSidebarCollapsed, density: nextDensity },
            }),
          );
        } catch (evErr) {
          /* ignore */
        }
      })
      .subscribe();
  } catch (realtimeErr) {
    try {
      console.warn('[RPBDD] Realtime subscription skipped:', realtimeErr);
    } catch (logErr) {
      /* ignore */
    }
  }
  var originalFetch = window.fetch.bind(window);

  function normalizePath(urlLike) {
    try {
      return new URL(urlLike, window.location.origin).pathname;
    } catch (e) {
      return '';
    }
  }

  function toJsonResponse(payload, status) {
    return new Response(JSON.stringify(payload), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function toHtmlResponse(html, status) {
    return new Response(String(html || ''), {
      status: status || 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  function parseBody(init) {
    if (!init || !init.body) return {};
    try {
      return JSON.parse(String(init.body));
    } catch (e) {
      return {};
    }
  }

  function normalizeDbErrorMessage(err) {
    var msg = String((err && err.message) || '');
    var lower = msg.toLowerCase();
    if (lower.indexOf('duplicate key value violates unique constraint') !== -1 && lower.indexOf('admin') !== -1) {
      return 'Admin email already exists. Use a different email.';
    }
    if (lower.indexOf('uq_admin_account_email_ci') !== -1) {
      return 'Admin email already exists. Use a different email.';
    }
    if (lower.indexOf('row-level security policy') !== -1 && lower.indexOf('admin_account') !== -1) {
      return 'Permission denied by Row Level Security for admin_account. Apply the admin_account RLS policies in supabase-schema.sql.';
    }
    return msg || 'Database error';
  }

  function isAdminAccountRlsError(err) {
    var msg = String((err && err.message) || '').toLowerCase();
    return msg.indexOf('row-level security policy') !== -1 && msg.indexOf('admin_account') !== -1;
  }

  function isMissingTableError(err) {
    var msg = String((err && err.message) || '').toLowerCase();
    return (
      msg.indexOf("could not find the table 'public.admin_account'") !== -1 ||
      (msg.indexOf('could not find the table') !== -1 && msg.indexOf('admin_account') !== -1)
    );
  }

  function isMissingAdminPhotoColumnError(err) {
    var msg = String((err && err.message) || '').toLowerCase();
    return msg.indexOf("could not find the 'photo' column of 'admin_account'") !== -1;
  }

  function getMissingAdminColumnName(err) {
    var msg = String((err && err.message) || '');
    var m = msg.match(/could not find the ['"]([^'"]+)['"] column of ['"]?public\.?admin_account/i);
    if (m && m[1]) return String(m[1]).trim();
    m = msg.match(/could not find the ['"]([^'"]+)['"] column of 'admin_account'/i);
    return m && m[1] ? String(m[1]).trim() : '';
  }

  function adminAccountsMissingResponse() {
    return toJsonResponse(
      {
        ok: false,
        code: 'missing_admin_account_table',
        error:
          'Required Supabase table public.admin_account is missing. Run supabase-schema.sql (includes photo column) then refresh.',
      },
      200,
    );
  }

  function emptyAdminAccount() {
    return {
      id: null,
      employeeId: '',
      email: '',
      fullName: '',
      position: '',
      role: 'Admin',
      password: '',
      passwordPlain: '',
      password_plain: '',
      photo: null,
      created_at: null,
      updated_at: null,
    };
  }

  function mapAdminAccountRow(row) {
    if (!row) return emptyAdminAccount();
    var plain = row.password_plain || '';
    return {
      id: row.id || null,
      employeeId: row.employee_id || '',
      email: row.email || '',
      fullName: row.full_name || '',
      position: row.position || '',
      role: row.role || 'Admin',
      password: plain,
      passwordPlain: plain,
      password_plain: plain,
      photo: row.photo || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  async function fetchAdminAccountRow() {
    var ordered = await db.from('admin_account').select('*').order('created_at', { ascending: false }).limit(1);
    if (!ordered.error) return ordered;
    var missingCol = getMissingAdminColumnName(ordered.error);
    var msg = String((ordered.error && ordered.error.message) || '').toLowerCase();
    if (missingCol === 'created_at' || missingCol === 'updated_at' || msg.indexOf('created_at') !== -1 || msg.indexOf('updated_at') !== -1) {
      return await db.from('admin_account').select('*').limit(1);
    }
    return ordered;
  }

  async function fetchAdminAccountRowByEmail(email) {
    var target = String(email || '').trim().toLowerCase();
    if (!target) return await fetchAdminAccountRow();
    var byEmail = await db
      .from('admin_account')
      .select('*')
      .ilike('email', target)
      .order('created_at', { ascending: false })
      .limit(1);
    var byEmailMissing = byEmail.error ? getMissingAdminColumnName(byEmail.error) : '';
    if (byEmail.error && byEmailMissing === 'email') {
      return await fetchAdminAccountRow();
    }
    if (byEmail.error && (byEmailMissing === 'created_at' || byEmailMissing === 'updated_at')) {
      var plainEmail = await db.from('admin_account').select('*').ilike('email', target).limit(1);
      if (!plainEmail.error && plainEmail.data && plainEmail.data[0]) return plainEmail;
    }
    if (!byEmail.error && byEmail.data && byEmail.data[0]) return byEmail;
    var scan = await db.from('admin_account').select('*').limit(300);
    if (!scan.error && Array.isArray(scan.data) && scan.data.length) {
      var match = scan.data.find(function (row) {
        return String((row && row.email) || '')
          .trim()
          .toLowerCase() === target;
      });
      if (match) return { data: [match], error: null };
    }
    return await fetchAdminAccountRow();
  }

  function normalizeDates(value) {
    if (!Array.isArray(value)) return [];
    return value
      .map(function (v) {
        return String(v || '').trim();
      })
      .filter(function (v) {
        return v !== '';
      });
  }

  function mapEventRow(row) {
    if (!row) return null;
    var pk = row.event_id != null && row.event_id !== '' ? row.event_id : row.id;
    return {
      id: pk,
      title: row.title || '',
      description: row.description || '',
      location: row.location || '',
      dates_json: Array.isArray(row.dates_json) ? JSON.stringify(row.dates_json) : '[]',
      dates: Array.isArray(row.dates_json) ? row.dates_json : [],
      time_raw: row.time_raw || '',
      time_display: row.time_display || '',
      category: row.category || '',
      status: row.status || 'upcoming',
      input_by: row.input_by || '',
      recycled_at: row.recycled_at || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  function mapTeamRow(row) {
    return {
      id: row.id,
      leadId: row.lead_id || '',
      email: row.email || '',
      password: row.password_mask || '',
      passwordPlain: row.password_plain || '',
      hasPassword: !!row.password_plain,
      teamLeader: row.team_leader || '',
      sectionTeam: row.section_team || '',
      position: row.position || '',
      photo: row.photo || null,
      Members: Number(row.members_count || 0),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  function mapMemberRow(row) {
    return {
      id: row.id,
      employeeId: '',
      fullName: '',
      email: row.email || '',
      password: row.password_mask || '',
      passwordPlain: row.password_plain || '',
      hasPassword: !!row.password_plain,
      team: row.team || '',
      position: '',
      photo: row.photo || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  function mapBirthdayRow(row) {
    if (!row) return null;
    var pk = row.birthday_id != null && row.birthday_id !== '' ? row.birthday_id : row.id;
    return {
      id: pk,
      name: row.name || '',
      position: row.position || '',
      section: row.section || '',
      photo: row.photo || '',
      dob: row.date_of_birth || '',
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    };
  }

  async function listBirthdays() {
    var result = await db.from(BIRTHDAYS_TABLE).select(BIRTHDAY_ROW_SELECT).order('date_of_birth', { ascending: true });
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, data: (result.data || []).map(mapBirthdayRow) });
  }

  async function createBirthday(init) {
    var body = parseBody(init);
    var payload = {
      name: String(body.name || '').trim(),
      position: String(body.position || '').trim(),
      section: String(body.section || '').trim(),
      photo: String(body.photo || '').trim(),
      date_of_birth: String(body.dob || '').trim(),
    };
    if (!payload.name || !payload.position || !payload.section || !payload.date_of_birth) {
      return toJsonResponse({ ok: false, error: 'Missing required birthday fields.' }, 400);
    }
    var result = await db.from(BIRTHDAYS_TABLE).insert(payload).select(BIRTHDAY_ROW_SELECT).single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, row: mapBirthdayRow(result.data) });
  }

  async function updateBirthday(id, init) {
    var body = parseBody(init);
    var patch = {
      name: String(body.name || '').trim(),
      position: String(body.position || '').trim(),
      section: String(body.section || '').trim(),
      photo: String(body.photo || '').trim(),
      date_of_birth: String(body.dob || '').trim(),
      updated_at: new Date().toISOString(),
    };
    if (!patch.name || !patch.position || !patch.section || !patch.date_of_birth) {
      return toJsonResponse({ ok: false, error: 'Missing required birthday fields.' }, 400);
    }
    var result = await db
      .from(BIRTHDAYS_TABLE)
      .update(patch)
      .eq('birthday_id', id)
      .select(BIRTHDAY_ROW_SELECT)
      .single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, row: mapBirthdayRow(result.data) });
  }

  async function deleteBirthday(id) {
    var result = await db.from(BIRTHDAYS_TABLE).delete().eq('birthday_id', id);
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true });
  }

  async function listBirthdayOptions() {
    var result = await db
      .from(BIRTHDAY_OPTIONS_TABLE)
      .select('kind,value')
      .order('value', { ascending: true });
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    var positions = [];
    var sections = [];
    (result.data || []).forEach(function (row) {
      var kind = String((row && row.kind) || '').trim().toLowerCase();
      var value = String((row && row.value) || '').trim();
      if (!value) return;
      if (kind === 'position') positions.push(value);
      if (kind === 'section') sections.push(value);
    });
    return toJsonResponse({ ok: true, positions: positions, sections: sections });
  }

  async function createBirthdayOption(init) {
    var body = parseBody(init);
    var kind = String(body.kind || '').trim().toLowerCase();
    var value = String(body.value || '').trim();
    if ((kind !== 'position' && kind !== 'section') || !value) {
      return toJsonResponse({ ok: false, error: 'Invalid option payload.' }, 400);
    }
    var result = await db.from(BIRTHDAY_OPTIONS_TABLE).insert({ kind: kind, value: value }).select('kind,value').single();
    if (result.error) {
      var msg = String(result.error.message || '');
      if (msg.toLowerCase().indexOf('duplicate key value violates unique constraint') !== -1) {
        return toJsonResponse({ ok: true, row: { kind: kind, value: value } });
      }
      return toJsonResponse({ ok: false, error: msg }, 500);
    }
    return toJsonResponse({ ok: true, row: result.data || { kind: kind, value: value } });
  }

  function normalizeTaskListRow(row) {
    return {
      id: row.id,
      title: row.title || 'Untitled',
      status: row.status || 'new',
      creator_notes: row.creator_notes || '',
      published: !!row.published,
      submitted_at: row.submitted_at || null,
      approved_at: row.approved_at || null,
      viewed_at: row.viewed_at || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      items: Array.isArray(row.items_json) ? row.items_json : [],
    };
  }

  function normalizeUserLogRow(row) {
    var exactDate = row.date || row.log_date || null;
    var timeIn = row.time_in || row.login || null;
    var timeOut = row.time_out || row.logout || null;
    return Object.assign({}, row, {
      date: exactDate,
      log_date: exactDate,
      login: timeIn,
      logout: timeOut,
      time_in: timeIn,
      time_out: timeOut,
    });
  }

  function parseNaiveDateTime(value) {
    if (value == null || value === '') return null;
    var s = String(value).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    var yyyy = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10);
    var dd = parseInt(m[3], 10);
    var hh = parseInt(m[4], 10);
    var mi = parseInt(m[5], 10);
    var ss = m[6] != null ? parseInt(m[6], 10) : 0;
    var dt = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    var ts = dt.getTime();
    return isNaN(ts) ? null : ts;
  }

  async function listEvents(recycled) {
    var query = db
      .from(EVENTS_TABLE)
      .select(EVENT_ROW_SELECT)
      .eq('is_recycled', recycled ? true : false)
      .order('created_at', { ascending: false });

    var result = await query;
    if (result.error) {
      return toJsonResponse({ ok: false, error: result.error.message }, 500);
    }

    var rows = (result.data || []).map(mapEventRow);
    return toJsonResponse({ ok: true, data: rows });
  }

  function mapEventCategoryRow(r, legacy) {
    var photoVal = !legacy && r && r.photo;
    return {
      name: String((r && r.name) || '').trim(),
      color: String((r && r.color) || '#3B82F6').trim(),
      display_name: legacy ? '' : String((r && r.display_name) != null ? r.display_name : '').trim(),
      position: legacy ? '' : String((r && r.position) != null ? r.position : '').trim(),
      photo:
        legacy || photoVal == null || String(photoVal).trim() === ''
          ? ''
          : String(photoVal).trim(),
    };
  }

  async function listEventCategories() {
    var selFull = 'name,color,sort_order,display_name,position,photo';
    var selLegacy = 'name,color,sort_order';
    var useLegacy = eventCategoriesDisplayColumnsKnown === false;
    var result = await db
      .from(EVENT_CATEGORIES_TABLE)
      .select(useLegacy ? selLegacy : selFull)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (result.error && !useLegacy && isMissingEventCategoryDisplayColumnsError(result.error)) {
      eventCategoriesDisplayColumnsKnown = false;
      result = await db
        .from(EVENT_CATEGORIES_TABLE)
        .select(selLegacy)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
    } else if (!result.error && !useLegacy) {
      eventCategoriesDisplayColumnsKnown = true;
    }
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    var legacy = eventCategoriesDisplayColumnsKnown === false;
    var rows = (result.data || []).map(function (r) {
      return mapEventCategoryRow(r, legacy);
    });
    return toJsonResponse({ ok: true, data: rows });
  }

  async function putEventCategories(init) {
    var body = parseBody(init);
    var raw = body.categories;
    if (!Array.isArray(raw)) return toJsonResponse({ ok: false, error: 'categories array required' }, 400);
    var preserveMap = {};
    var preserveSelect =
      eventCategoriesDisplayColumnsKnown === false ? 'name' : 'name,display_name,position,photo';
    var existingResult = await db.from(EVENT_CATEGORIES_TABLE).select(preserveSelect);
    if (existingResult.error && isMissingEventCategoryDisplayColumnsError(existingResult.error)) {
      eventCategoriesDisplayColumnsKnown = false;
      existingResult = await db.from(EVENT_CATEGORIES_TABLE).select('name');
    }
    if (
      existingResult.error &&
      eventCategoriesDisplayColumnsKnown !== false &&
      /display_name|position|photo/i.test(String(existingResult.error.message || ''))
    ) {
      eventCategoriesDisplayColumnsKnown = false;
      existingResult = await db.from(EVENT_CATEGORIES_TABLE).select('name');
    }
    if (!existingResult.error && existingResult.data) {
      existingResult.data.forEach(function (r) {
        var n = String((r && r.name) || '').trim();
        if (!n) return;
        if (eventCategoriesDisplayColumnsKnown === false) {
          preserveMap[n] = { display_name: '', position: '', photo: null };
          return;
        }
        preserveMap[n] = {
          display_name: r.display_name != null ? String(r.display_name) : '',
          position: r.position != null ? String(r.position) : '',
          photo: r.photo != null && String(r.photo).trim() !== '' ? String(r.photo).trim() : null,
        };
      });
    }
    var rows = [];
    raw.forEach(function (c, idx) {
      var name = String((c && c.name) || '').trim();
      if (!name) return;
      var color = String((c && c.color) || '#3B82F6').trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = '#3B82F6';
      var preserved = preserveMap[name] || { display_name: '', position: '', photo: null };
      var display_name;
      if (c && Object.prototype.hasOwnProperty.call(c, 'display_name')) {
        display_name = String(c.display_name != null ? c.display_name : '').trim();
      } else {
        display_name = String(preserved.display_name || '').trim();
      }
      var position;
      if (c && Object.prototype.hasOwnProperty.call(c, 'position')) {
        position = String(c.position != null ? c.position : '').trim();
      } else {
        position = String(preserved.position || '').trim();
      }
      var photo;
      if (c && Object.prototype.hasOwnProperty.call(c, 'photo')) {
        var phIn = c.photo;
        photo = phIn != null && String(phIn).trim() !== '' ? String(phIn).trim() : null;
      } else {
        photo = preserved.photo;
      }
      rows.push({
        name: name,
        color: color,
        sort_order: idx,
        display_name: display_name,
        position: position,
        photo: photo,
      });
    });
    var wipe = await db.from(EVENT_CATEGORIES_TABLE).delete().gte('sort_order', -2147483648);
    if (wipe.error) return toJsonResponse({ ok: false, error: wipe.error.message }, 500);
    if (rows.length === 0) {
      return toJsonResponse({ ok: true, data: [] });
    }
    var ins;
    if (eventCategoriesDisplayColumnsKnown === false) {
      var slimInsert = rows.map(function (r) {
        return { name: r.name, color: r.color, sort_order: r.sort_order };
      });
      ins = await db.from(EVENT_CATEGORIES_TABLE).insert(slimInsert).select('name,color,sort_order');
    } else {
      ins = await db
        .from(EVENT_CATEGORIES_TABLE)
        .insert(rows)
        .select('name,color,sort_order,display_name,position,photo');
      if (ins.error && isMissingEventCategoryDisplayColumnsError(ins.error)) {
        eventCategoriesDisplayColumnsKnown = false;
        var slim = rows.map(function (r) {
          return { name: r.name, color: r.color, sort_order: r.sort_order };
        });
        ins = await db.from(EVENT_CATEGORIES_TABLE).insert(slim).select('name,color,sort_order');
      }
    }
    if (ins.error) return toJsonResponse({ ok: false, error: ins.error.message }, 500);
    var legacyOut = eventCategoriesDisplayColumnsKnown === false;
    var out = (ins.data || []).map(function (r) {
      return mapEventCategoryRow(r, legacyOut);
    });
    return toJsonResponse({ ok: true, data: out });
  }

  function normalizeSharedDashboardTheme(t) {
    var s = String(t || '')
      .trim()
      .toLowerCase();
    if (s === 'dark' || s === 'night') return 'night';
    return 'light';
  }

  function normalizeSharedSidebarCollapsed(v) {
    return v === true || String(v || '').toLowerCase() === 'true' || String(v || '') === '1';
  }

  function normalizeSharedDensity(v) {
    var s = String(v || '')
      .trim()
      .toLowerCase();
    if (s === 'comfortable') return 'comfortable';
    return 'compact';
  }

  function isSharedSettingsUnavailableError(err) {
    var msg = String((err && err.message) || '');
    return /does not exist|42P01|relation.*dashboard_shared_settings/i.test(msg);
  }

  async function getSharedDashboardSettings() {
    var selectFull = 'id,theme,sidebar_collapsed,density,updated_at';
    var selectLegacy = 'id,theme,updated_at';
    var useLegacy = sharedSettingsExtraColumnsKnown === false;
    var result = await db
      .from(SHARED_DASHBOARD_SETTINGS_TABLE)
      .select(useLegacy ? selectLegacy : selectFull)
      .eq('id', 1)
      .maybeSingle();
    if (
      result.error &&
      !useLegacy &&
      /sidebar_collapsed|density/i.test(String((result.error && result.error.message) || ''))
    ) {
      sharedSettingsExtraColumnsKnown = false;
      result = await db.from(SHARED_DASHBOARD_SETTINGS_TABLE).select(selectLegacy).eq('id', 1).maybeSingle();
    } else if (!result.error && !useLegacy) {
      sharedSettingsExtraColumnsKnown = true;
    }
    if (result.error) {
      if (isSharedSettingsUnavailableError(result.error)) {
        return toJsonResponse(
          {
            ok: false,
            error: 'shared_settings_table_missing',
            message: result.error.message,
          },
          503,
        );
      }
      return toJsonResponse({ ok: false, error: result.error.message }, 500);
    }
    var row = result.data;
    if (!row) {
      return toJsonResponse({
        ok: true,
        theme: 'light',
        sidebar_collapsed: null,
        density: '',
        updated_at: null,
      });
    }
    return toJsonResponse({
      ok: true,
      theme: normalizeSharedDashboardTheme(row.theme),
      sidebar_collapsed:
        sharedSettingsExtraColumnsKnown === false ? null : normalizeSharedSidebarCollapsed(row.sidebar_collapsed),
      density: sharedSettingsExtraColumnsKnown === false ? '' : normalizeSharedDensity(row.density),
      updated_at: row.updated_at || null,
    });
  }

  async function putSharedDashboardSettings(init) {
    var body = parseBody(init);
    var previous = await getSharedDashboardSettings();
    var prevPayload = null;
    try {
      prevPayload = JSON.parse(await previous.text());
    } catch (e) {
      prevPayload = null;
    }
    var prevTheme = prevPayload && prevPayload.ok ? normalizeSharedDashboardTheme(prevPayload.theme) : 'light';
    var prevSidebar =
      prevPayload && prevPayload.ok ? normalizeSharedSidebarCollapsed(prevPayload.sidebar_collapsed) : false;
    var prevDensity = prevPayload && prevPayload.ok ? normalizeSharedDensity(prevPayload.density) : 'compact';
    var theme =
      body && Object.prototype.hasOwnProperty.call(body, 'theme')
        ? normalizeSharedDashboardTheme(body.theme)
        : prevTheme;
    var sidebarCollapsed =
      body && Object.prototype.hasOwnProperty.call(body, 'sidebar_collapsed')
        ? normalizeSharedSidebarCollapsed(body.sidebar_collapsed)
        : prevSidebar;
    var density =
      body && Object.prototype.hasOwnProperty.call(body, 'density')
        ? normalizeSharedDensity(body.density)
        : prevDensity;
    var payload = {
      id: 1,
      theme: theme,
      sidebar_collapsed: sidebarCollapsed,
      density: density,
      updated_at: new Date().toISOString(),
    };
    var result;
    if (sharedSettingsExtraColumnsKnown === false) {
      result = await db
        .from(SHARED_DASHBOARD_SETTINGS_TABLE)
        .upsert({ id: 1, theme: theme, updated_at: payload.updated_at }, { onConflict: 'id' });
    } else {
      result = await db.from(SHARED_DASHBOARD_SETTINGS_TABLE).upsert(payload, { onConflict: 'id' });
      if (result.error && /sidebar_collapsed|density/i.test(String((result.error && result.error.message) || ''))) {
        sharedSettingsExtraColumnsKnown = false;
        result = await db
          .from(SHARED_DASHBOARD_SETTINGS_TABLE)
          .upsert({ id: 1, theme: theme, updated_at: payload.updated_at }, { onConflict: 'id' });
      }
    }
    if (result.error) {
      if (isSharedSettingsUnavailableError(result.error)) {
        return toJsonResponse(
          {
            ok: false,
            error: 'shared_settings_table_missing',
            message: result.error.message,
          },
          503,
        );
      }
      return toJsonResponse({ ok: false, error: result.error.message }, 500);
    }
    return toJsonResponse({
      ok: true,
      theme: theme,
      sidebar_collapsed: sharedSettingsExtraColumnsKnown === false ? null : sidebarCollapsed,
      density: sharedSettingsExtraColumnsKnown === false ? '' : density,
    });
  }

  async function createEvent(init) {
    var body = parseBody(init);
    var payload = {
      title: String(body.title || '').trim(),
      description: String(body.description || '').trim(),
      location: String(body.location || '').trim(),
      dates_json: normalizeDates(body.dates),
      time_raw: String(body.time_raw || '').trim(),
      time_display: String(body.time_display || '').trim(),
      category: String(body.category || '').trim(),
      status: String(body.status || 'upcoming').trim() || 'upcoming',
      input_by: String(body.input_by || '').trim(),
      is_recycled: false,
    };

    if (!payload.title || payload.dates_json.length === 0) {
      return toJsonResponse({ ok: false, error: 'Missing required event fields.' }, 400);
    }

    var result = await db
      .from(EVENTS_TABLE)
      .insert(payload)
      .select(EVENT_ROW_SELECT)
      .single();

    if (result.error) {
      return toJsonResponse({ ok: false, error: result.error.message }, 500);
    }

    return toJsonResponse({ ok: true, row: mapEventRow(result.data) });
  }

  async function updateEvent(id, init) {
    var body = parseBody(init);
    var patch = {
      title: String(body.title || '').trim(),
      description: String(body.description || '').trim(),
      location: String(body.location || '').trim(),
      time_raw: String(body.time_raw || '').trim(),
      time_display: String(body.time_display || '').trim(),
      category: String(body.category || '').trim(),
      updated_at: new Date().toISOString(),
    };
    var datesArr = normalizeDates(body.dates);
    if (datesArr.length > 0) {
      patch.dates_json = datesArr;
    }

    var result = await db
      .from(EVENTS_TABLE)
      .update(patch)
      .eq('event_id', id)
      .select(EVENT_ROW_SELECT)
      .single();

    if (result.error) {
      return toJsonResponse({ ok: false, error: result.error.message }, 500);
    }
    return toJsonResponse({ ok: true, row: mapEventRow(result.data) });
  }

  async function moveToRecycle(id) {
    var result = await db
      .from(EVENTS_TABLE)
      .update({
        is_recycled: true,
        recycled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', id)
      .select(EVENT_ROW_SELECT)
      .single();

    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, row: mapEventRow(result.data) });
  }

  async function restoreRecycle(id) {
    var result = await db
      .from(EVENTS_TABLE)
      .update({
        is_recycled: false,
        recycled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', id)
      .select(EVENT_ROW_SELECT)
      .single();

    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, row: mapEventRow(result.data) });
  }

  async function purgeRecycle(id) {
    var result = await db.from(EVENTS_TABLE).delete().eq('event_id', id);
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true });
  }

  async function deleteEvent(id) {
    var result = await db.from(EVENTS_TABLE).delete().eq('event_id', id);
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true });
  }

  async function listTeams(recycled) {
    var result = await db
      .from('teams')
      .select('*')
      .eq('is_recycled', recycled ? true : false)
      .order('created_at', { ascending: false });
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, teams: (result.data || []).map(mapTeamRow) });
  }

  async function createTeam(init) {
    var body = parseBody(init);
    var payload = {
      lead_id: String(body.team_lead_id || body.lead_id || '').trim(),
      email: String(body.team_email || body.email || '').trim(),
      password_plain: String(body.team_password || body.password || '').trim(),
      password_mask: '••••••••',
      team_leader: String(body.team_leader || '').trim(),
      section_team: String(body.team_section || body.section_team || '').trim(),
      position: String(body.team_position || body.position || '').trim(),
      photo: body.photo || null,
      members_count: Number(body.members_count || 0),
      is_recycled: false,
    };
    var result = await db.from('teams').insert(payload).select('*').single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, team: mapTeamRow(result.data) });
  }

  async function updateTeam(id, init) {
    var body = parseBody(init);
    var patch = {
      lead_id: String(body.team_lead_id || body.lead_id || '').trim(),
      email: String(body.team_email || body.email || '').trim(),
      team_leader: String(body.team_leader || '').trim(),
      section_team: String(body.team_section || body.section_team || '').trim(),
      position: String(body.team_position || body.position || '').trim(),
      updated_at: new Date().toISOString(),
    };
    if (body.team_password || body.password) {
      patch.password_plain = String(body.team_password || body.password).trim();
      patch.password_mask = '••••••••';
    }
    if (body.photo !== undefined) patch.photo = body.photo || null;
    var result = await db.from('teams').update(patch).eq('id', id).select('*').single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, team: mapTeamRow(result.data) });
  }

  async function moveTeamToRecycle(id) {
    var result = await db
      .from('teams')
      .update({ is_recycled: true, recycled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, team: mapTeamRow(result.data) });
  }

  async function restoreTeamRecycle(id) {
    var result = await db
      .from('teams')
      .update({ is_recycled: false, recycled_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, team: mapTeamRow(result.data) });
  }

  async function purgeTeamRecycle(id) {
    var result = await db.from('teams').delete().eq('id', id);
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true });
  }

  function emailQueryHint(urlObj) {
    try {
      return urlObj && urlObj.searchParams ? String(urlObj.searchParams.get('email') || '').trim() : '';
    } catch (e) {
      return '';
    }
  }

  async function myTeam(urlObj) {
    var target = String(emailQueryHint(urlObj) || '')
      .trim()
      .toLowerCase();
    var result;
    if (target) {
      result = await db
        .from('teams')
        .select('*')
        .eq('is_recycled', false)
        .ilike('email', target)
        .order('created_at', { ascending: false })
        .limit(1);
    } else {
      result = await db.from('teams').select('*').eq('is_recycled', false).order('created_at', { ascending: false }).limit(1);
    }
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, team: result.data && result.data[0] ? mapTeamRow(result.data[0]) : null });
  }

  async function listMembers(recycled) {
    var result = await db
      .from('members')
      .select('*')
      .eq('is_recycled', recycled ? true : false)
      .order('created_at', { ascending: false });
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, members: (result.data || []).map(mapMemberRow) });
  }

  async function createMember(init) {
    var body = parseBody(init);
    var payload = {
      email: String(body.member_email || body.email || '').trim(),
      password_plain: String(body.member_password || body.password || '').trim(),
      password_mask: '••••••••',
      team: String(body.member_team || body.team || '').trim(),
      photo: body.photo || null,
      is_recycled: false,
    };
    var result = await db.from('members').insert(payload).select('*').single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, member: mapMemberRow(result.data) });
  }

  async function updateMember(id, init) {
    var body = parseBody(init);
    var patch = {
      email: String(body.member_email || body.email || '').trim(),
      team: String(body.member_team || body.team || '').trim(),
      updated_at: new Date().toISOString(),
    };
    if (body.member_password || body.password) {
      patch.password_plain = String(body.member_password || body.password).trim();
      patch.password_mask = '••••••••';
    }
    if (body.photo !== undefined) patch.photo = body.photo || null;
    var result = await db.from('members').update(patch).eq('id', id).select('*').single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, member: mapMemberRow(result.data) });
  }

  async function moveMemberToRecycle(id) {
    var result = await db
      .from('members')
      .update({ is_recycled: true, recycled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, member: mapMemberRow(result.data) });
  }

  async function restoreMemberRecycle(id) {
    var result = await db
      .from('members')
      .update({ is_recycled: false, recycled_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, member: mapMemberRow(result.data) });
  }

  async function purgeMemberRecycle(id) {
    var result = await db.from('members').delete().eq('id', id);
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true });
  }

  async function myMember(urlObj) {
    var target = String(emailQueryHint(urlObj) || '')
      .trim()
      .toLowerCase();
    var result;
    if (target) {
      result = await db
        .from('members')
        .select('*')
        .eq('is_recycled', false)
        .ilike('email', target)
        .order('created_at', { ascending: false })
        .limit(1);
    } else {
      result = await db.from('members').select('*').eq('is_recycled', false).order('created_at', { ascending: false }).limit(1);
    }
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, member: result.data && result.data[0] ? mapMemberRow(result.data[0]) : null });
  }

  async function listTasks() {
    var result = await db.from('task_lists').select('*').order('created_at', { ascending: false });
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, lists: (result.data || []).map(normalizeTaskListRow) });
  }

  async function createTaskList(init) {
    var body = parseBody(init);
    var payload = {
      title: String(body.title || body.listTitle || 'Untitled').trim(),
      status: 'new',
      creator_notes: String(body.creator_notes || '').trim(),
      published: true,
      items_json: Array.isArray(body.items) ? body.items : [],
    };
    var result = await db.from('task_lists').insert(payload).select('*').single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, list: normalizeTaskListRow(result.data) });
  }

  async function updateTaskListFields(init) {
    var body = parseBody(init);
    var id = body.listId || body.id;
    if (!id) return toJsonResponse({ ok: false, error: 'Missing list id.' }, 400);
    var patch = {
      title: body.title != null ? String(body.title).trim() : undefined,
      creator_notes: body.creator_notes != null ? String(body.creator_notes).trim() : undefined,
      updated_at: new Date().toISOString(),
    };
    Object.keys(patch).forEach(function (k) {
      if (patch[k] === undefined) delete patch[k];
    });
    var result = await db.from('task_lists').update(patch).eq('id', id).select('*').single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, list: normalizeTaskListRow(result.data) });
  }

  async function updateTaskItemLike(init, toggleOnly) {
    var body = parseBody(init);
    var listId = body.listId || body.id;
    var itemId = body.itemId || body.taskId || body.id;
    if (!listId || !itemId) return toJsonResponse({ ok: false, error: 'Missing list/item id.' }, 400);
    var current = await db.from('task_lists').select('*').eq('id', listId).single();
    if (current.error || !current.data) return toJsonResponse({ ok: false, error: 'Task list not found.' }, 404);
    var items = Array.isArray(current.data.items_json) ? current.data.items_json.slice() : [];
    var found = false;
    items = items.map(function (item) {
      var iid = String(item.id || item.itemId || '');
      if (iid !== String(itemId)) return item;
      found = true;
      var next = Object.assign({}, item);
      if (toggleOnly) {
        next.done = !next.done;
      } else {
        if (body.done !== undefined) next.done = !!body.done;
        if (body.text !== undefined) next.text = String(body.text);
        if (body.notes !== undefined) next.notes = String(body.notes);
      }
      next.updated_at = new Date().toISOString();
      return next;
    });
    if (!found) return toJsonResponse({ ok: false, error: 'Task item not found.' }, 404);
    var upd = await db
      .from('task_lists')
      .update({ items_json: items, updated_at: new Date().toISOString() })
      .eq('id', listId)
      .select('*')
      .single();
    if (upd.error) return toJsonResponse({ ok: false, error: upd.error.message }, 500);
    return toJsonResponse({ ok: true, list: normalizeTaskListRow(upd.data) });
  }

  async function updateTaskWorkflow(status, init) {
    var body = parseBody(init);
    var listId = body.listId || body.id;
    if (!listId) return toJsonResponse({ ok: false, error: 'Missing list id.' }, 400);
    var patch = { status: status, updated_at: new Date().toISOString() };
    if (status === 'sent') patch.submitted_at = new Date().toISOString();
    if (status === 'done') patch.approved_at = new Date().toISOString();
    var result = await db.from('task_lists').update(patch).eq('id', listId).select('*').single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, list: normalizeTaskListRow(result.data) });
  }

  async function markTaskViewed(init) {
    var body = parseBody(init);
    var listId = body.listId || body.id;
    if (!listId) return toJsonResponse({ ok: false, error: 'Missing list id.' }, 400);
    var result = await db
      .from('task_lists')
      .update({ viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', listId)
      .select('*')
      .single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, list: normalizeTaskListRow(result.data) });
  }

  async function deleteTaskList(init) {
    var body = parseBody(init);
    var listId = body.listId || body.id;
    if (!listId) return toJsonResponse({ ok: false, error: 'Missing list id.' }, 400);
    var result = await db.from('task_lists').delete().eq('id', listId);
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true });
  }

  async function listProfileNotifications() {
    var result = await db.from('profile_notifications').select('*').order('created_at', { ascending: false });
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, notifications: result.data || [] });
  }

  async function markProfileNotificationsRead(init) {
    var body = parseBody(init);
    var ids = Array.isArray(body.ids)
      ? body.ids
      : Array.isArray(body.notificationIds)
        ? body.notificationIds
        : [];
    if (!ids.length) {
      return toJsonResponse({ ok: true, updated: 0 });
    }
    var result = await db
      .from('profile_notifications')
      .update({ is_read: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in('id', ids);
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, updated: ids.length });
  }

  async function listUserLogs() {
    var result = await db.from('user_logs').select('*').order('created_at', { ascending: false }).limit(500);
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({
      ok: true,
      logs: (result.data || []).map(normalizeUserLogRow),
    });
  }

  async function logUserLogin(init) {
    var body = parseBody(init);
    var exactDate = body.date || body.log_date || '';
    var timeIn = body.time_in || body.login || '';
    var payload = {
      full_name: body.full_name != null ? String(body.full_name).trim() : '',
      email: body.email != null ? String(body.email).trim() : '',
      role: body.role != null ? String(body.role).trim() : '',
      team: body.team != null ? String(body.team).trim() : '',
      date: exactDate != null ? String(exactDate).trim() : '',
      log_date: exactDate != null ? String(exactDate).trim() : '',
      login: timeIn != null ? String(timeIn).trim() : '',
      time_in: timeIn != null ? String(timeIn).trim() : '',
      logout: '',
      time_out: '',
    };

    var latest = db.from('user_logs').select('*').order('created_at', { ascending: false }).limit(1);
    if (payload.email) latest = latest.eq('email', payload.email);
    if (payload.full_name) latest = latest.eq('full_name', payload.full_name);
    if (payload.date) latest = latest.eq('date', payload.date);
    var lastRes = await latest;
    if (lastRes.error) return toJsonResponse({ ok: false, error: lastRes.error.message }, 500);
    var last = lastRes.data && lastRes.data[0] ? lastRes.data[0] : null;
    if (last) {
      var lastOut = String(last.time_out || last.logout || '').trim();
      var lastIn = String(last.time_in || last.login || '').trim();
      var nowIn = String(payload.time_in || payload.login || '').trim();
      var lastTs = parseNaiveDateTime(lastIn);
      var nowTs = parseNaiveDateTime(nowIn);
      var delta = lastTs != null && nowTs != null ? Math.abs(nowTs - lastTs) : null;
      if (!lastOut && delta != null && delta <= 30000) {
        return toJsonResponse({ ok: true, deduped: true, log: normalizeUserLogRow(last) });
      }
    }

    var result = await db.from('user_logs').insert(payload).select('*').single();
    if (result.error) return toJsonResponse({ ok: false, error: result.error.message }, 500);
    return toJsonResponse({ ok: true, log: normalizeUserLogRow(result.data) });
  }

  async function logUserLogout(init) {
    var body = parseBody(init);
    var email = body.email != null ? String(body.email).trim() : '';
    var fullName = body.full_name != null ? String(body.full_name).trim() : '';
    var exactDate = body.date || body.log_date || '';
    var timeOut = body.time_out || body.logout || '';
    var query = db.from('user_logs').select('*').order('created_at', { ascending: false }).limit(1);
    if (email) query = query.eq('email', email);
    if (fullName) query = query.eq('full_name', fullName);
    if (exactDate) query = query.eq('date', String(exactDate).trim());
    var current = await query;
    if (current.error) return toJsonResponse({ ok: false, error: current.error.message }, 500);
    if (current.data && current.data[0]) {
      var patch = {
        logout: timeOut != null ? String(timeOut).trim() : '',
        time_out: timeOut != null ? String(timeOut).trim() : '',
      };
      if (exactDate) {
        patch.date = String(exactDate).trim();
        patch.log_date = String(exactDate).trim();
      }
      var upd = await db.from('user_logs').update(patch).eq('id', current.data[0].id).select('*').single();
      if (upd.error) return toJsonResponse({ ok: false, error: upd.error.message }, 500);
      return toJsonResponse({ ok: true, log: normalizeUserLogRow(upd.data) });
    }
    var ins = await db
      .from('user_logs')
      .insert({
        full_name: fullName,
        email: email,
        role: body.role != null ? String(body.role).trim() : '',
        team: body.team != null ? String(body.team).trim() : '',
        date: exactDate != null ? String(exactDate).trim() : '',
        log_date: exactDate != null ? String(exactDate).trim() : '',
        logout: timeOut != null ? String(timeOut).trim() : '',
        time_out: timeOut != null ? String(timeOut).trim() : '',
      })
      .select('*')
      .single();
    if (ins.error) return toJsonResponse({ ok: false, error: ins.error.message }, 500);
    return toJsonResponse({ ok: true, log: normalizeUserLogRow(ins.data) });
  }

  async function getAdminAccount(urlObj) {
    var emailHint = '';
    try {
      emailHint = urlObj && urlObj.searchParams ? String(urlObj.searchParams.get('email') || '').trim() : '';
    } catch (e) {
      emailHint = '';
    }
    var result = await fetchAdminAccountRowByEmail(emailHint);
    if (result.error) {
      if (isAdminAccountRlsError(result.error)) {
        return toJsonResponse(
          {
            ok: true,
            admin: emptyAdminAccount(),
            warning:
              'Select blocked by Row Level Security on admin_account. Run admin_account RLS policies in supabase-schema.sql.',
          },
          200,
        );
      }
      if (isMissingTableError(result.error)) {
        return toJsonResponse({
          ok: true,
          admin: emptyAdminAccount(),
          warning:
            'Admin account table is missing. Profile is shown in empty mode until schema is applied.',
        });
      }
      return toJsonResponse({ ok: false, error: result.error.message }, 500);
    }
    return toJsonResponse({
      ok: true,
      admin: result.data && result.data[0] ? mapAdminAccountRow(result.data[0]) : emptyAdminAccount(),
    });
  }

  async function adminAccountSchemaHealth() {
    var expected = ['id', 'email', 'role', 'password_plain', 'photo', 'created_at', 'updated_at'];
    var missing = [];
    var tableExists = true;
    var i;
    for (i = 0; i < expected.length; i++) {
      var col = expected[i];
      var probe = await db.from('admin_account').select(col).limit(1);
      if (probe.error) {
        if (isMissingTableError(probe.error)) {
          tableExists = false;
          missing = expected.slice();
          break;
        }
        var missingCol = getMissingAdminColumnName(probe.error);
        if (missingCol) {
          if (missing.indexOf(missingCol) === -1) missing.push(missingCol);
          continue;
        }
      }
    }
    return toJsonResponse({
      ok: true,
      table: 'admin_account',
      tableExists: tableExists,
      expectedColumns: expected,
      missingColumns: missing,
      healthy: tableExists && missing.length === 0,
      advice:
        tableExists && missing.length === 0
          ? 'Schema is healthy.'
          : 'Run supabase-schema.sql migrations for admin_account, then refresh schema cache.',
    });
  }

  /**
   * When the dashboard is embedded (iframe), the parent SPA holds the Supabase session; the iframe
   * client may not see it (storage/session quirks). Ask the parent to run auth.updateUser first.
   */
  function syncAuthViaParentWindow(oldEmailLower, savedEmailLower, payload) {
    try {
      if (!window.parent || window.parent === window) return Promise.resolve(null);
    } catch (e) {
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      var id = 'rpbdd-auth-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
      var settled = false;
      var timeoutMs = 12000;
      function finish(result) {
        if (settled) return;
        settled = true;
        try {
          window.removeEventListener('message', onMessage);
        } catch (e2) {
          /* ignore */
        }
        clearTimeout(timer);
        resolve(result);
      }
      function onMessage(ev) {
        try {
          if (ev.source !== window.parent) return;
          if (String(ev.origin || '') !== String(window.location.origin)) return;
          var d = ev.data;
          if (!d || d.type !== 'rpbdd-admin-auth-sync-result' || d.id !== id) return;
          finish(d);
        } catch (e3) {
          /* ignore */
        }
      }
      var timer = setTimeout(function () {
        finish(null);
      }, timeoutMs);
      window.addEventListener('message', onMessage);
      try {
        window.parent.postMessage(
          {
            type: 'rpbdd-admin-auth-sync',
            id: id,
            oldEmailLower: String(oldEmailLower || '').trim().toLowerCase(),
            savedEmailLower: String(savedEmailLower || '').trim().toLowerCase(),
            payload: payload,
          },
          window.location.origin,
        );
      } catch (e4) {
        finish(null);
      }
    });
  }

  function normalizeAuthEmailForSync(raw) {
    var s = String(raw || '').trim();
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    s = s.replace(/\uFF20/g, '@').replace(/\uFF0E/g, '.');
    try {
      s = s.normalize('NFKC');
    } catch (e) {
      /* ignore */
    }
    if (
      s.length >= 2 &&
      ((s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ||
        (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'"))
    ) {
      s = s.slice(1, -1).trim();
    }
    return s.toLowerCase();
  }

  function mapParentAuthSyncResult(d) {
    if (!d || typeof d !== 'object') return null;
    if (d.ok === true) {
      return {
        ok: true,
        synced: true,
        pendingEmailChange: !!d.pendingEmailChange,
        pendingEmail: d.pendingEmail ? String(d.pendingEmail) : '',
      };
    }
    if (d.error) return { ok: false, error: String(d.error) };
    if (d.noSession) return { ok: true, skipped: true, noSession: true };
    return { ok: false, error: 'Auth sync failed' };
  }

  /**
   * Keep Supabase Auth in sync with admin_account after save. updateUser only affects the current
   * session’s Auth user (cannot change another account), so no email “match the row” gate is needed.
   */
  async function syncSupabaseAuthFromAdminEdit(oldEmailLower, updatedRow, newPasswordPlain) {
    var oldEm = String(oldEmailLower || '').trim().toLowerCase();
    var rowEmailRaw =
      updatedRow && updatedRow.email != null ? normalizeAuthEmailForSync(updatedRow.email) : '';
    var newEm = rowEmailRaw;
    var pw = String(newPasswordPlain || '').trim();
    if (pw === '••••••••') pw = '';

    var payload = {};
    if (pw) payload.password = pw;
    // Same email + password as Account Management / admin_account — always push saved email to Auth when syncing.
    if (rowEmailRaw) payload.email = rowEmailRaw;

    if (!payload.password && !payload.email) return { ok: true, skipped: true };

    var parentAns = await syncAuthViaParentWindow(oldEm, newEm, payload);
    var mapped = mapParentAuthSyncResult(parentAns);
    if (mapped) return mapped;

    try {
      var sessRes = await db.auth.getSession();
      var session = sessRes && sessRes.data ? sessRes.data.session : null;
      var user = session && session.user ? session.user : null;
      if (!session || !user) return { ok: true, skipped: true, noSession: true };

      var upd = await db.auth.updateUser(payload);
      if (upd.error) {
        var upMsg = String((upd.error && upd.error.message) || 'Auth update failed');
        if (/different from the old password|same password|unchanged/i.test(upMsg)) {
          return { ok: true, synced: true, pendingEmailChange: false, pendingEmail: '' };
        }
        return { ok: false, error: upMsg };
      }
      var u = upd.data && upd.data.user;
      var pend = u && u.new_email ? String(u.new_email).trim() : '';
      return {
        ok: true,
        synced: true,
        pendingEmailChange: !!pend,
        pendingEmail: pend,
      };
    } catch (e) {
      return { ok: false, error: e && e.message ? String(e.message) : String(e) };
    }
  }

  /**
   * Legacy name kept for clarity at call sites that only set password (insert flow).
   */
  async function syncSupabaseAuthPasswordIfSelfService(savedEmailLower, newPasswordPlain) {
    var syntheticRow = { email: savedEmailLower };
    return await syncSupabaseAuthFromAdminEdit(String(savedEmailLower || '').trim().toLowerCase(), syntheticRow, newPasswordPlain);
  }

  async function updateAdminAccount(init) {
    var body = parseBody(init);
    var selectorEmail =
      body.email != null
        ? String(body.email).trim().toLowerCase()
        : body.email_address != null
          ? String(body.email_address).trim().toLowerCase()
          : '';
    var current = await fetchAdminAccountRowByEmail(selectorEmail);
    if (current.error) {
      if (isAdminAccountRlsError(current.error)) {
        return toJsonResponse(
          {
            ok: true,
            admin: emptyAdminAccount(),
            warning:
              'Select blocked by Row Level Security on admin_account. Run admin_account RLS policies in supabase-schema.sql.',
          },
          200,
        );
      }
      if (isMissingTableError(current.error)) {
        return adminAccountsMissingResponse();
      }
      return toJsonResponse({ ok: false, error: current.error.message }, 500);
    }
    var patch = {
      email: body.email != null ? String(body.email).trim().toLowerCase() : undefined,
      role: body.role != null ? String(body.role).trim() : undefined,
      password_plain:
        body.password_plain != null
          ? String(body.password_plain).trim()
          : body.password != null
            ? String(body.password).trim()
            : undefined,
      updated_at: new Date().toISOString(),
    };
    Object.keys(patch).forEach(function (k) {
      if (patch[k] === undefined) delete patch[k];
    });

    async function updateWithFallbackById(id, patchObj) {
      var effectivePatch = Object.assign({}, patchObj);
      for (var i = 0; i < 12; i++) {
        var updTry = await db.from('admin_account').update(effectivePatch).eq('id', id).select('*').single();
        if (!updTry.error) return updTry;
        var missingCol = getMissingAdminColumnName(updTry.error);
        if (!missingCol || effectivePatch[missingCol] === undefined) return updTry;
        delete effectivePatch[missingCol];
      }
      return { error: { message: 'Failed to update admin_account due to missing columns.' } };
    }

    async function insertWithFallback(patchObj) {
      var effectivePatch = Object.assign({}, patchObj);
      for (var i = 0; i < 12; i++) {
        var insTry = await db.from('admin_account').insert(effectivePatch).select('*').single();
        if (!insTry.error) return insTry;
        var missingCol = getMissingAdminColumnName(insTry.error);
        if (!missingCol || effectivePatch[missingCol] === undefined) return insTry;
        delete effectivePatch[missingCol];
      }
      return { error: { message: 'Failed to insert admin_account due to missing columns.' } };
    }

    if (current.data && current.data[0]) {
      var rowBeforeUpdate = current.data[0];
      var oldEmailForAuth = String(rowBeforeUpdate.email || '').trim().toLowerCase();

      var upd = await updateWithFallbackById(rowBeforeUpdate.id, patch);
      if (upd.error) {
        if (isAdminAccountRlsError(upd.error)) {
          return toJsonResponse(
            {
              ok: true,
              admin: mapAdminAccountRow(current.data[0]),
              warning:
                'Update blocked by Row Level Security on admin_account. Run admin_account RLS policies in supabase-schema.sql.',
            },
            200,
          );
        }
        return toJsonResponse({ ok: false, error: normalizeDbErrorMessage(upd.error) }, 500);
      }
      var mappedAdmin = mapAdminAccountRow(upd.data);
      var pwdForAuth =
        patch.password_plain !== undefined && patch.password_plain !== null ? String(patch.password_plain).trim() : '';
      if (pwdForAuth === '••••••••') pwdForAuth = '';

      var oldPlainFromRow = String(rowBeforeUpdate.password_plain != null ? rowBeforeUpdate.password_plain : '').trim();
      var pwdForAuthSync = pwdForAuth;
      if (pwdForAuthSync && oldPlainFromRow && pwdForAuthSync === oldPlainFromRow) {
        pwdForAuthSync = '';
      }

      var newEmailLower = String((upd.data && upd.data.email) || '').trim().toLowerCase();
      var shouldSyncAuth =
        pwdForAuthSync !== '' || (newEmailLower !== '' && newEmailLower !== oldEmailForAuth);

      if (shouldSyncAuth) {
        var authSync = await syncSupabaseAuthFromAdminEdit(oldEmailForAuth, upd.data, pwdForAuthSync);
        if (!authSync.ok) {
          return toJsonResponse(
            {
              ok: true,
              admin: mappedAdmin,
              warning:
                'Profile saved in the database, but Supabase login could not be updated: ' +
                (authSync.error || 'Unknown error') +
                '. Fix under Authentication → Users in the Supabase dashboard if needed.',
            },
            200,
          );
        }
        if (authSync.noSession) {
          return toJsonResponse(
            {
              ok: true,
              admin: mappedAdmin,
              warning:
                'Profile saved. Sign in through the portal first, then save email/password again so Supabase Auth can update.',
            },
            200,
          );
        }
        if (authSync.pendingEmailChange) {
          return toJsonResponse(
            {
              ok: true,
              admin: mappedAdmin,
              warning:
                'Profile saved. Supabase sent a confirmation link for your new email (check inbox / Junk). Until you confirm, sign in with your previous email; your new password already applies to this account.',
            },
            200,
          );
        }
      }
      return toJsonResponse({ ok: true, admin: mappedAdmin });
    }
    var ins = await insertWithFallback(patch);
    if (ins.error) {
      var msg = String((ins.error && ins.error.message) || '').toLowerCase();
      if (msg.indexOf('row-level security policy') !== -1) {
        return toJsonResponse(
          {
            ok: true,
            admin: emptyAdminAccount(),
            warning:
              'Insert blocked by Row Level Security on admin_account. Run admin_account RLS policies in supabase-schema.sql.',
          },
          200,
        );
      }
      return toJsonResponse({ ok: false, error: normalizeDbErrorMessage(ins.error) }, 500);
    }
    var mappedIns = mapAdminAccountRow(ins.data);
    var pwdIns =
      patch.password_plain !== undefined && patch.password_plain !== null ? String(patch.password_plain).trim() : '';
    if (pwdIns) {
      var rowEmailIns = String((ins.data && ins.data.email) || body.email || selectorEmail || '')
        .trim()
        .toLowerCase();
      var authSyncIns = await syncSupabaseAuthPasswordIfSelfService(rowEmailIns, pwdIns);
      if (!authSyncIns.ok) {
        return toJsonResponse(
          {
            ok: true,
            admin: mappedIns,
            warning:
              'Account created, but Supabase Auth password could not be set: ' +
              (authSyncIns.error || 'Unknown error') +
              '. Set the password from the Supabase dashboard or sign in as this user and save again.',
          },
          200,
        );
      }
      if (authSyncIns.noSession) {
        return toJsonResponse({
          ok: true,
          admin: mappedIns,
          warning:
            'Account created. Sign in through the portal, then save the password again to sync Supabase login.',
        });
      }
    }
    return toJsonResponse({ ok: true, admin: mappedIns });
  }

  async function updateAdminPhoto(init) {
    var body = parseBody(init);
    var selectorEmail =
      body.email != null
        ? String(body.email).trim().toLowerCase()
        : body.email_address != null
          ? String(body.email_address).trim().toLowerCase()
          : '';
    var current = await fetchAdminAccountRowByEmail(selectorEmail);
    if (current.error) {
      if (isAdminAccountRlsError(current.error)) {
        return toJsonResponse(
          {
            ok: true,
            admin: emptyAdminAccount(),
            warning:
              'Select blocked by Row Level Security on admin_account. Run admin_account RLS policies in supabase-schema.sql.',
          },
          200,
        );
      }
      if (isMissingTableError(current.error)) {
        return adminAccountsMissingResponse();
      }
      return toJsonResponse({ ok: false, error: current.error.message }, 500);
    }
    var photo = body.photo || body.photoData || null;
    if (current.data && current.data[0]) {
      var upd = await db
        .from('admin_account')
        .update({ photo: photo, updated_at: new Date().toISOString() })
        .eq('id', current.data[0].id)
        .select('*')
        .single();
      if (upd.error) {
        if (getMissingAdminColumnName(upd.error) === 'updated_at') {
          upd = await db.from('admin_account').update({ photo: photo }).eq('id', current.data[0].id).select('*').single();
        }
      }
      if (upd.error) {
        if (isAdminAccountRlsError(upd.error)) {
          return toJsonResponse(
            {
              ok: true,
              admin: mapAdminAccountRow(current.data[0]),
              warning:
                'Update blocked by Row Level Security on admin_account. Run admin_account RLS policies in supabase-schema.sql.',
            },
            200,
          );
        }
        if (isMissingAdminPhotoColumnError(upd.error)) {
          var noPhotoUpd = await db
            .from('admin_account')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', current.data[0].id)
            .select('*')
            .single();
          if (noPhotoUpd.error && getMissingAdminColumnName(noPhotoUpd.error) === 'updated_at') {
            return toJsonResponse({
              ok: true,
              admin: mapAdminAccountRow(current.data[0]),
              warning:
                "Column 'photo' is missing in admin_account, and 'updated_at' is also missing. Run supabase-schema.sql migrations.",
            });
          }
          if (noPhotoUpd.error) return toJsonResponse({ ok: false, error: normalizeDbErrorMessage(noPhotoUpd.error) }, 500);
          return toJsonResponse({
            ok: true,
            admin: mapAdminAccountRow(noPhotoUpd.data),
            warning: "Column 'photo' is missing in admin_account. Run schema migration to enable photo saving.",
          });
        }
        return toJsonResponse({ ok: false, error: normalizeDbErrorMessage(upd.error) }, 500);
      }
      return toJsonResponse({ ok: true, admin: mapAdminAccountRow(upd.data) });
    }
    var ins = await db.from('admin_account').insert({ photo: photo }).select('*').single();
    if (ins.error) {
      if (isAdminAccountRlsError(ins.error)) {
        return toJsonResponse(
          {
            ok: true,
            admin: emptyAdminAccount(),
            warning:
              'Insert blocked by Row Level Security on admin_account. Run admin_account RLS policies in supabase-schema.sql.',
          },
          200,
        );
      }
      if (isMissingAdminPhotoColumnError(ins.error)) {
        var insNoPhoto = await db.from('admin_account').insert({}).select('*').single();
        if (insNoPhoto.error) return toJsonResponse({ ok: false, error: normalizeDbErrorMessage(insNoPhoto.error) }, 500);
        return toJsonResponse({
          ok: true,
          admin: mapAdminAccountRow(insNoPhoto.data),
          warning: "Column 'photo' is missing in admin_account. Run schema migration to enable photo saving.",
        });
      }
      return toJsonResponse({ ok: false, error: normalizeDbErrorMessage(ins.error) }, 500);
    }
    return toJsonResponse({ ok: true, admin: mapAdminAccountRow(ins.data) });
  }

  async function exportTeamHtml() {
    var teamsRes = await db.from('teams').select('*').eq('is_recycled', false).order('created_at', { ascending: false });
    if (teamsRes.error) return toHtmlResponse('<h1>Export error</h1><p>' + teamsRes.error.message + '</p>', 500);
    var rows = teamsRes.data || [];
    var html =
      '<!doctype html><html><head><meta charset="utf-8"><title>Team Export</title></head><body>' +
      '<h1>Team Export</h1><table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>Lead ID</th><th>Email</th><th>Section Chief</th><th>Section Team</th><th>Position</th><th>Members</th></tr></thead><tbody>' +
      rows
        .map(function (r) {
          return (
            '<tr><td>' +
            (r.lead_id || '') +
            '</td><td>' +
            (r.email || '') +
            '</td><td>' +
            (r.team_leader || '') +
            '</td><td>' +
            (r.section_team || '') +
            '</td><td>' +
            (r.position || '') +
            '</td><td>' +
            String(r.members_count || 0) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></body></html>';
    return toHtmlResponse(html, 200);
  }

  async function tasksAttachmentStub(path, method) {
    if (path.indexOf('/item-attachment') === -1) return null;
    if (method === 'POST') return toJsonResponse({ ok: true, attachment: null, warning: 'Attachment storage not yet enabled.' }, 200);
    if (method === 'DELETE') return toJsonResponse({ ok: true, warning: 'Attachment storage not yet enabled.' }, 200);
    if (method === 'GET') return toJsonResponse({ ok: false, error: 'Attachment endpoint placeholder.' }, 404);
    return toJsonResponse({ ok: false, error: 'Unsupported attachment action.' }, 400);
  }

  window.fetch = async function (input, init) {
    var method = ((init && init.method) || 'GET').toUpperCase();
    var url = typeof input === 'string' ? input : input && input.url ? input.url : '';
    var urlObj = null;
    try {
      urlObj = new URL(url, window.location.origin);
    } catch (e) {
      urlObj = null;
    }
    var path = normalizePath(url);

    var isEvents = path === EVENTS_API_BASE || path.indexOf(EVENTS_API_BASE + '/') === 0;
    var isTeams = path === TEAMS_API_BASE || path.indexOf(TEAMS_API_BASE + '/') === 0;
    var isMembers = path === MEMBERS_API_BASE || path.indexOf(MEMBERS_API_BASE + '/') === 0;
    var isBirthdays = path === BIRTHDAYS_API_BASE || path.indexOf(BIRTHDAYS_API_BASE + '/') === 0;
    var isTasks = path === TASKS_API_BASE || path.indexOf(TASKS_API_BASE + '/') === 0;
    var isProfileNotifs = path === PROFILE_NOTIFS_API_BASE || path.indexOf(PROFILE_NOTIFS_API_BASE + '/') === 0;
    var isUserLogs = path === USER_LOGS_API_BASE || path.indexOf(USER_LOGS_API_BASE + '/') === 0;
    var isAdminAccount = path === ADMIN_ACCOUNT_API_BASE || path.indexOf(ADMIN_ACCOUNT_API_BASE + '/') === 0;
    var isTeamExport = path === TEAM_EXPORT_PDF_API || path === TEAM_EXPORT_PRINT_API;

    if (!path || (!isEvents && !isTeams && !isMembers && !isBirthdays && !isTasks && !isProfileNotifs && !isUserLogs && !isAdminAccount && !isTeamExport)) {
      return originalFetch(input, init);
    }

    try {
      if (isEvents) {
        if (path === EVENTS_API_BASE + '/shared-settings' && method === 'GET') return await getSharedDashboardSettings();
        if (path === EVENTS_API_BASE + '/shared-settings' && method === 'PUT') return await putSharedDashboardSettings(init);
        if (path === EVENTS_API_BASE + '/categories' && method === 'GET') return await listEventCategories();
        if (path === EVENTS_API_BASE + '/categories' && method === 'PUT') return await putEventCategories(init);
        if (path === EVENTS_API_BASE && method === 'GET') return await listEvents(false);
        if (path === EVENTS_API_BASE && method === 'POST') return await createEvent(init);
        if (path === EVENTS_API_BASE + '/recycled' && method === 'GET') return await listEvents(true);
        var mUpdate = path.match(/^\/supabase-events-api\/([^/]+)\/update$/);
        if (mUpdate && method === 'POST') return await updateEvent(mUpdate[1], init);
        var mToRecycle = path.match(/^\/supabase-events-api\/([^/]+)\/to-recycle$/);
        if (mToRecycle && method === 'POST') return await moveToRecycle(mToRecycle[1]);
        var mRestore = path.match(/^\/supabase-events-api\/recycle\/([^/]+)\/restore$/);
        if (mRestore && method === 'POST') return await restoreRecycle(mRestore[1]);
        var mPurge = path.match(/^\/supabase-events-api\/recycle\/([^/]+)$/);
        if (mPurge && method === 'DELETE') return await purgeRecycle(mPurge[1]);
        var mDelete = path.match(/^\/supabase-events-api\/([^/]+)$/);
        if (mDelete && method === 'DELETE') return await deleteEvent(mDelete[1]);
      }

      if (isTeams) {
        if (path === TEAMS_API_BASE && method === 'GET') return await listTeams(false);
        if (path === TEAMS_API_BASE && method === 'POST') return await createTeam(init);
        if (path === TEAMS_API_BASE + '/recycled' && method === 'GET') return await listTeams(true);
        if (path === TEAMS_API_BASE + '/my-team' && method === 'GET') return await myTeam(urlObj);
        var tUpdate = path.match(/^\/supabase-teams-api\/([^/]+)\/update$/);
        if (tUpdate && method === 'POST') return await updateTeam(tUpdate[1], init);
        var tRecycle = path.match(/^\/supabase-teams-api\/([^/]+)\/to-recycle$/);
        if (tRecycle && method === 'POST') return await moveTeamToRecycle(tRecycle[1]);
        var tRestore = path.match(/^\/supabase-teams-api\/recycle\/([^/]+)\/restore$/);
        if (tRestore && method === 'POST') return await restoreTeamRecycle(tRestore[1]);
        var tPurge = path.match(/^\/supabase-teams-api\/recycle\/([^/]+)$/);
        if (tPurge && method === 'DELETE') return await purgeTeamRecycle(tPurge[1]);
      }

      if (isMembers) {
        if (path === MEMBERS_API_BASE && method === 'GET') return await listMembers(false);
        if (path === MEMBERS_API_BASE && method === 'POST') return await createMember(init);
        if (path === MEMBERS_API_BASE + '/recycled' && method === 'GET') return await listMembers(true);
        if (path === MEMBERS_API_BASE + '/my-member' && method === 'GET') return await myMember(urlObj);
        var mUpdateMember = path.match(/^\/supabase-members-api\/([^/]+)\/update$/);
        if (mUpdateMember && method === 'POST') return await updateMember(mUpdateMember[1], init);
        var mRecycleMember = path.match(/^\/supabase-members-api\/([^/]+)\/to-recycle$/);
        if (mRecycleMember && method === 'POST') return await moveMemberToRecycle(mRecycleMember[1]);
        var mRestoreMember = path.match(/^\/supabase-members-api\/recycle\/([^/]+)\/restore$/);
        if (mRestoreMember && method === 'POST') return await restoreMemberRecycle(mRestoreMember[1]);
        var mPurgeMember = path.match(/^\/supabase-members-api\/recycle\/([^/]+)$/);
        if (mPurgeMember && method === 'DELETE') return await purgeMemberRecycle(mPurgeMember[1]);
      }

      if (isBirthdays) {
        if (path === BIRTHDAYS_API_BASE + '/options' && method === 'GET') return await listBirthdayOptions();
        if (path === BIRTHDAYS_API_BASE + '/options' && method === 'POST') return await createBirthdayOption(init);
        if (path === BIRTHDAYS_API_BASE && method === 'GET') return await listBirthdays();
        if (path === BIRTHDAYS_API_BASE && method === 'POST') return await createBirthday(init);
        var bUpdate = path.match(/^\/supabase-birthdays-api\/([^/]+)\/update$/);
        if (bUpdate && method === 'POST') return await updateBirthday(bUpdate[1], init);
        var bDelete = path.match(/^\/supabase-birthdays-api\/([^/]+)$/);
        if (bDelete && method === 'DELETE') return await deleteBirthday(bDelete[1]);
      }

      if (isTasks) {
        var att = await tasksAttachmentStub(path, method);
        if (att) return att;
        if (path === TASKS_API_BASE && method === 'GET') return await listTasks();
        if (path === TASKS_API_BASE && method === 'POST') return await createTaskList(init);
        if (path === TASKS_API_BASE + '/update-list' && method === 'POST') return await updateTaskListFields(init);
        if (path === TASKS_API_BASE + '/update-task' && method === 'POST') return await updateTaskItemLike(init, false);
        if (path === TASKS_API_BASE + '/toggle-item' && method === 'POST') return await updateTaskItemLike(init, true);
        if (path === TASKS_API_BASE + '/submit-list' && method === 'POST') return await updateTaskWorkflow('sent', init);
        if (path === TASKS_API_BASE + '/approve-list' && method === 'POST') return await updateTaskWorkflow('done', init);
        if (path === TASKS_API_BASE + '/request-revision' && method === 'POST')
          return await updateTaskWorkflow('pending', init);
        if (path === TASKS_API_BASE + '/mark-list-viewed' && method === 'POST') return await markTaskViewed(init);
        if (path === TASKS_API_BASE + '/delete-list' && method === 'POST') return await deleteTaskList(init);
      }

      if (isProfileNotifs) {
        if (path === PROFILE_NOTIFS_API_BASE && method === 'GET') return await listProfileNotifications();
        if (path === PROFILE_NOTIFS_API_BASE + '/mark-read' && method === 'POST')
          return await markProfileNotificationsRead(init);
      }

      if (isUserLogs) {
        if (path === USER_LOGS_API_BASE && method === 'GET') return await listUserLogs();
        if (path === USER_LOGS_API_BASE + '/login' && method === 'POST') return await logUserLogin(init);
        if (path === USER_LOGS_API_BASE + '/logout' && method === 'POST') return await logUserLogout(init);
      }

      if (isAdminAccount) {
        if (path === ADMIN_ACCOUNT_API_BASE + '/schema-health' && method === 'GET') return await adminAccountSchemaHealth();
        if (path === ADMIN_ACCOUNT_API_BASE && method === 'GET') return await getAdminAccount(urlObj);
        if (path === ADMIN_ACCOUNT_API_BASE + '/update' && method === 'POST') return await updateAdminAccount(init);
        if (path === ADMIN_ACCOUNT_API_BASE + '/photo' && method === 'POST') return await updateAdminPhoto(init);
      }

      if (isTeamExport && method === 'POST') {
        return await exportTeamHtml();
      }

      return toJsonResponse({ ok: false, error: 'Unsupported endpoint.' }, 404);
    } catch (err) {
      if (isAdminAccountRlsError(err)) {
        return toJsonResponse(
          {
            ok: true,
            admin: emptyAdminAccount(),
            warning:
              'Permission denied by Row Level Security for admin_account. Apply the admin_account RLS policies in supabase-schema.sql.',
          },
          200,
        );
      }
      return toJsonResponse({ ok: false, error: err && err.message ? err.message : 'Adapter error' }, 500);
    }
  };
})();
