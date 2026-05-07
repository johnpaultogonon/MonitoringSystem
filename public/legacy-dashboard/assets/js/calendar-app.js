/**
 * RPBDD calendar dashboard — vanilla JS port of Downloads/src CalendarApp.tsx
 * Shared “one system”: when `eventsApi` / `teamsApi` / `membersApi` / `birthdaysApi` are set in #rpbdd-app-config, that module’s data is loaded from the API only—localStorage copies are ignored so every browser shows the same rows. Event categories sync via `/supabase-events-api/categories`. Dashboard theme (Light / Night sky) syncs via `/supabase-events-api/shared-settings` (table `dashboard_shared_settings`).
 */
(function () {
  'use strict';

  var LS_EVENTS = 'rpbdd_events';
  var LS_DELETED = 'rpbdd_deleted_events';
  var LS_TEAMS = 'rpbdd_teams';
  var LS_DELETED_TEAMS = 'rpbdd_teams_recycle_local';
  var LS_DELETED_MEMBERS = 'rpbdd_members_recycle_local';
  var LS_MEMBERS = 'rpbdd_members';
  /** Role-targeted profile update notifications (localStorage shared on this browser). */
  var LS_PROFILE_NOTIFS = 'rpbdd_profile_notifications';
  /** Read-tab items moved to the notifications Recycle Bin (snapshots + source ids). */
  var LS_PROFILE_NOTIF_RECYCLE = 'rpbdd_profile_notif_recycle';
  /** Server profile_notification row ids permanently removed from the bin (never merge again). */
  var LS_PROFILE_NOTIF_PURGED = 'rpbdd_profile_notif_purged_servers';
  /** Choices for Add Team dropdowns only — not the same key as `rpbdd_teams` (team rows). */
  var LS_DD_SECTION = 'rpbdd_dd_section_team';
  var LS_DD_POSITION = 'rpbdd_dd_position';
  var LS_BIRTHDAY_CELEBRANTS = 'rpbdd_birthday_celebrants_v1';
  var LS_BIRTHDAY_POSITIONS = 'rpbdd_birthday_positions_v1';
  var LS_BIRTHDAY_SECTIONS = 'rpbdd_birthday_sections_v1';
  var LS_EVENT_CATEGORIES = 'rpbdd_event_categories';
  /** Dashboard appearance — `html[data-rpbdd-theme]`: light | night only */
  var LS_THEME = 'rpbdd_theme';
  var LS_SIDEBAR_COLLAPSED = 'rpbdd-sidebar-collapsed';
  var LS_DENSITY = 'rpbdd_density';
  /** After we PUT theme, brief GET polls may still return the old row — skip reverting the UI. */
  var sharedThemeWriteGuard = null;
  var sharedThemeWriteGuardTimer = null;
  var SHARED_THEME_WRITE_GUARD_MS = 12000;
  var LS_REPORT_CATEGORY_DISPLAY = 'rpbdd_report_category_display_v1';
  var EVENT_CATEGORY_PALETTE = [
    '#FACC15', // Yellow
    '#22C55E', // Green
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#F97316', // Orange
    '#8B5CF6', // Violet
    '#F8BBD0', // Baby Pink
    '#8D6E63', // Brown
    '#06B6D4',
    '#14B8A6',
    '#84CC16',
    '#A3E635',
    '#EAB308',
    '#FB7185',
    '#EC4899',
    '#D946EF',
    '#6366F1',
    '#0EA5E9',
    '#38BDF8',
    '#10B981',
    '#4ADE80',
    '#F59E0B',
    '#FDBA74',
    '#A78BFA',
    '#FCA5A5',
    '#334155',
    '#94A3B8',
  ];
  var COLOR_NAME_BY_HEX = {
    '#FACC15': 'Yellow',
    '#22C55E': 'Green',
    '#3B82F6': 'Blue',
    '#EF4444': 'Red',
    '#F97316': 'Orange',
    '#8B5CF6': 'Violet',
    '#F8BBD0': 'Baby Pink',
    '#8D6E63': 'Brown',
    '#06B6D4': 'Cyan',
    '#14B8A6': 'Teal',
    '#84CC16': 'Lime',
    '#A3E635': 'Light Lime',
    '#EAB308': 'Amber',
    '#FB7185': 'Rose',
    '#EC4899': 'Pink',
    '#D946EF': 'Fuchsia',
    '#6366F1': 'Indigo',
    '#0EA5E9': 'Sky Blue',
    '#38BDF8': 'Light Sky',
    '#10B981': 'Emerald',
    '#4ADE80': 'Mint Green',
    '#F59E0B': 'Gold',
    '#FDBA74': 'Peach',
    '#A78BFA': 'Lavender',
    '#FCA5A5': 'Soft Red',
    '#334155': 'Slate',
    '#94A3B8': 'Silver',
  };
  var eventCategories = [];
  var DEFAULT_BIRTHDAY_SECTIONS = ['SIB', 'EDES', 'CRFPS', 'M&E'];
  var DEFAULT_BIRTHDAY_POSITIONS = [];

  /** Primary citation URLs (verify yearly Proclamations for exact non-working dates). */
  /** Chan Robles Virtual Law Library — Executive Order No. 292 (Administrative Code of 1987), full HTML text. */
  var H_CHANROBLES_EO292 = 'https://www.chanrobles.com/executiveorderno292.htm';
  /** LawPhil (Arellano Law Foundation) — stable mirror of statutes. */
  var H_LAWPHIL_RA9492 = 'https://lawphil.net/statutes/repacts/ra2007/ra_9492_2007.html';
  var H_LAWPHIL_RA3022 = 'https://lawphil.net/statutes/repacts/ra1961/ra_3022_1961.html';
  var H_LAWPHIL_PROC28 = 'https://lawphil.net/executive/proc/proc1962/proc_28_1962.html';
  var H_NHCP = 'https://nhcp.gov.ph/';
  var H_DOLE = 'https://www.dole.gov.ph/';
  var H_LAWPHIL_RA9177 = 'https://lawphil.net/statutes/repacts/ra2002/ra_9177_2002.html';
  var H_LAWPHIL_RA9849 = 'https://lawphil.net/statutes/repacts/ra2009/ra_9849_2009.html';

  /**
   * National Muslim holidays (R.A. No. 9177 — Eid'l Fitr; R.A. No. 9849 — Eid'l Adha).
   * Civil dates are set by Presidential Proclamation each year (NCMF recommendation, Islamic/Hijri calendar).
   * Optional rows (e.g. first day of Ramadan) are for calendar awareness; they are not the same as the two nationwide legal feast days.
   * Extend this map when new proclamations are issued.
   */
  var PH_MUSLIM_HOLIDAYS_BY_YEAR = {
    2023: [
      { month: 3, date: 21, name: "Eid'l Fitr (Feast of Ramadhan)" },
      { month: 5, date: 28, name: "Eid'l Adha (Feast of Sacrifice)" },
    ],
    2024: [
      { month: 3, date: 10, name: "Eid'l Fitr (Feast of Ramadhan)" },
      { month: 5, date: 17, name: "Eid'l Adha (Feast of Sacrifice)" },
    ],
    2025: [
      { month: 3, date: 1, name: "Eid'l Fitr (Feast of Ramadhan)" },
      { month: 5, date: 6, name: "Eid'l Adha (Feast of Sacrifice)" },
    ],
    2026: [
      { month: 1, date: 16, name: 'Ramadan Mubarak (Beginning of Ramadan)' },
      { month: 2, date: 20, name: "Eid'l Fitr (Feast of Ramadhan)" },
      { month: 4, date: 27, name: "Eid'l Adha (Feast of Sacrifice)" },
    ],
  };

  /**
   * Chinese New Year (Lunar New Year) — civil date follows the lunisolar calendar; often in January or February.
   * Declared as an additional special non-working day by Presidential Proclamation. Extend when new proclamations issue.
   */
  var PH_CHINESE_NEW_YEAR_BY_YEAR = {
    2023: { month: 0, date: 22, name: 'Chinese New Year (Lunar New Year)' },
    2024: { month: 1, date: 10, name: 'Chinese New Year (Lunar New Year)' },
    2025: { month: 0, date: 29, name: 'Chinese New Year (Lunar New Year)' },
    2026: { month: 1, date: 17, name: 'Chinese New Year (Lunar New Year)' },
    2027: { month: 1, date: 6, name: 'Chinese New Year (Lunar New Year)' },
    2028: { month: 0, date: 26, name: 'Chinese New Year (Lunar New Year)' },
    2029: { month: 1, date: 13, name: 'Chinese New Year (Lunar New Year)' },
    2030: { month: 1, date: 3, name: 'Chinese New Year (Lunar New Year)' },
  };

  /**
   * Bonifacio Day is not a single fixed cell: R.A. No. 9492 uses the Monday nearest November 30.
   * Month/date are applied per civil year via mondayNearestAnchorParts + bonifacioHolidayRecord.
   */
  var HOLIDAY_BONIFACIO_META = {
    name: 'Bonifacio Day',
    firstDeclaredDate: 'November 30 (historical observance)',
    approvedBy: 'President of the Philippines / Congress (statutory framework as amended)',
    law: 'Republic Act No. 9492 — Bonifacio Day on the Monday nearest November 30 (unless otherwise modified); see also Administrative Code table in E.O. No. 292',
    lawUrl: H_LAWPHIL_RA9492,
    description:
      'Bonifacio Day honors Andrés Bonifacio. R.A. No. 9492 sets legal observance on the Monday nearest November 30; this app places the label on that Monday for the selected civil year (always confirm the Presidential Proclamation and DOLE advisory for payroll).',
    descriptionSource: 'LawPhil — Republic Act No. 9492 (full text)',
    descriptionUrl: H_LAWPHIL_RA9492,
    trivia:
      'Tumatulong si Bonifacio magpatakbo ng Katipunan parang lihim na organisasyon: may mga kodigo, antas, at imprenta na kumakalat ng ideya. Sa R.A. No. 9492 maaaring Lunes ang kaarawan; patuloy na naglalahad ang NHCP ng bagong anggulo upang manatiling buhay ang imahe ng Supremo.',
    triviaSource: 'National Historical Commission of the Philippines',
    triviaUrl: H_NHCP,
    whyCelebrated:
      'Ang Nobyembre 30 ay kaarawan ni Andrés Bonifacio at diwa ng Katipunan—bahagi ng pagbuo ng bansa, binibigyang-diin ang papel ng ordinaryong tao sa paghahangad ng kalayaan at katarungang panlipunan.',
  };

  var allPhilippineHolidays = [
    {
      month: 0,
      date: 1,
      name: "New Year's Day",
      firstDeclaredDate: 'April 13, 1917',
      approvedBy: 'Philippine Legislature (U.S. insular period)',
      law: 'Act No. 3458 (1917), codified with later issuances in Executive Order No. 292 (Administrative Code of 1987)',
      lawUrl: H_CHANROBLES_EO292,
      description:
        'January 1 is listed as a regular holiday in the national schedule under the Administrative Code of 1987 (E.O. No. 292).',
      descriptionSource: 'Chan Robles Virtual Law Library — Executive Order No. 292',
      descriptionUrl: H_CHANROBLES_EO292,
      trivia:
        'Madalas salubungin ng mga Pilipino ang Enero 1 ng paputok (kung pinapayagan), pagtalon kapag hatinggabi (“para tumangkad”), at mesang puno ng bilog na prutas para sa swerte—halong paniniwalang Tsino, sigla ng piyesta, at enerhiya ng barkada. Naglalathala pa rin ang DOLE ng mga abiso taon-taon tungkol sa bayad sa holiday kapag nagbabago ang kalendaryo.',
      triviaSource: 'Department of Labor and Employment',
      triviaUrl: H_DOLE,
      whyCelebrated:
        'Higit pa sa legal na holiday, ang Enero 1 ay okasyon ng pamilya: marami ang umuwi sa probinsya, nagbabahagihan ng pagkain, at sumusunod sa kaugaliang bayan (hal. prutas na bilog, ingay na pagsalubong) para sa swerte—isang timpla ng tradisyong Katoliko, popular, at bagong simula.',
    },
    {
      month: 1,
      date: 25,
      name: 'EDSA People Power Revolution',
      firstDeclaredDate: 'February 25, 1986',
      approvedBy: 'President of the Philippines (Presidential Proclamation, varies by year)',
      law: 'Framework for national holidays: Executive Order No. 292 and Republic Act No. 9492 (as amended); February 25 observance is set by yearly Presidential Proclamation (working vs non-working). Note: R.A. No. 11014 is a different law (First Philippine Republic Day, January 23).',
      lawUrl: H_LAWPHIL_RA9492,
      description:
        'February 25 commemorates the People Power Revolution of 1986. Whether it is a special non-working day, a special working holiday, or observed on another date is set by Presidential Proclamation for that year—cross-check with DOLE labor advisories.',
      descriptionSource: 'LawPhil — Republic Act No. 9492 (holiday framework; full text)',
      descriptionUrl: H_LAWPHIL_RA9492,
      trivia:
        'Dilaw na ribon, confetti, madreng may rosaryo na harap sa sundalo, at mga naghahatid ng pagkain sa estranghero—iniwan ng EDSA 1986 ang mga larawang itinatatak sa alaala: isang pagtutol na mistulang kombinasyon ng prusisyon at perya, na natapos nang huminto ang mga tangke sa halip na bumaril.',
      triviaSource: 'National Historical Commission of the Philippines',
      triviaUrl: H_NHCP,
      whyCelebrated:
        'Ginugunita ang mapayapang People Power noong 1986 sa EDSA na muling nagbalik ng demokrasya—simbolo ito ng tapang ng mamamayan, pambansang alaala, at pagmamalaki sa “People Power” bilang bahagi ng modernong pagkakakilanlan ng Pilipinas.',
    },
    {
      month: 3,
      date: 2,
      name: 'Maundy Thursday',
      firstDeclaredDate: 'July 24, 1987',
      approvedBy: 'President of the Philippines',
      law: 'Executive Order No. 292 — Administrative Code of 1987 (regular holidays, movable dates); Republic Act No. 9492 rationalized certain observance rules',
      lawUrl: H_CHANROBLES_EO292,
      description:
        'Maundy Thursday is listed among regular holidays with a movable date tied to the ecclesiastical calendar (see Administrative Code holiday table).',
      descriptionSource: 'Chan Robles Virtual Law Library — Executive Order No. 292',
      descriptionUrl: H_CHANROBLES_EO292,
      trivia:
        'Maraming pamilyang Katoliko ang nagsasagawa ng Visita Iglesia—minsan pitong simbahan sa isang gabi—habang napupuno ang mga terminal ng bus habang milyun-milyong tao ay “nag-uwi para sa Semana Santa.” Tinutukoy pa rin ng Pangulo ang eksaktong petsa taon-taon; hinihimok ng R.A. No. 9492 ang maagang proklamasyon para makapaghanda ang lahat.',
      triviaSource: 'LawPhil — Republic Act No. 9492 (full text)',
      triviaUrl: H_LAWPHIL_RA9492,
      whyCelebrated:
        'Para sa napakaraming Katoliko, ito ang pasimula ng tuktok ng Semana Santa: Misa, Visita Iglesia, o biyahe sa probinsya—pananampalataya at tradisyon ng pamilya ang humuhubog sa araw na ito.',
    },
    {
      month: 3,
      date: 3,
      name: 'Good Friday',
      firstDeclaredDate: 'July 24, 1987',
      approvedBy: 'President of the Philippines',
      law: 'Executive Order No. 292 — Administrative Code of 1987; Republic Act No. 9492',
      lawUrl: H_CHANROBLES_EO292,
      description:
        'Good Friday is listed as a regular holiday with a movable date (Administrative Code of 1987).',
      descriptionSource: 'Chan Robles Virtual Law Library — Executive Order No. 292',
      descriptionUrl: H_CHANROBLES_EO292,
      trivia:
        'Ang mga prusisyon sa Biyernes Santo ay mistulang dahan-dahang dula: mataas na carroza, mga “Romanong sundalo,” at bayan kung saan linggo-linggo pa nagsasanay ang mga aktor ng Senákulo. Iniuurong ng R.A. No. 9492 ang ilang holiday sa Lunes—pero umiikot pa rin ang Semana Santa sa kalendaryo ng buwan.',
      triviaSource: 'LawPhil — Republic Act No. 9492 (full text)',
      triviaUrl: H_LAWPHIL_RA9492,
      whyCelebrated:
        'Inaalala ng mga Pilipino ang Pasyon at kamatayan ng Panginoon sa tahimik na prusisyon (Senákulo), pag-aayuno, at pagmumuni—pamana ng tradisyong Katoliko mula sa panahon ng Espanya na buhay pa sa bayan at lungsod.',
    },
    {
      month: 3,
      date: 4,
      name: 'Black Saturday',
      firstDeclaredDate: 'July 25, 2007',
      approvedBy: 'Congress of the Philippines / President of the Philippines',
      law: 'Holy Week non-working days (including Black Saturday when included) are typically established together via Presidential Proclamation for each year; R.A. No. 9492 and related issuances govern the overall holiday framework',
      lawUrl: H_LAWPHIL_RA9492,
      description:
        'Black Saturday falls between Good Friday and Easter Sunday. Confirm whether it is a special non-working day for your year using the Presidential Proclamation and DOLE advisory for that calendar year.',
      descriptionSource: 'Department of Labor and Employment (holiday advisories)',
      descriptionUrl: H_DOLE,
      trivia:
        'Tila nakatapis ang ingay ng lungsod: may istasyon ng radyo na humihina sa musika, mall na maikling oras, at simbahang naghahanda ng kandila para sa Easter Vigil. Depende pa rin sa Proklamasyon ng taon kung may premium pay ang mga manggagawa—ipinaliliwanag ito ng mga abiso ng DOLE.',
      triviaSource: 'Department of Labor and Employment',
      triviaUrl: H_DOLE,
      whyCelebrated:
        'Ang Sabado de Gloria ay araw ng pagluluksa at katahimikan bago ang Easter—maraming pamilya ang nananatili sa tahanan, umiiwas sa maingay na selebrasyon, at sumusunod sa kaugaliang simbahan hanggang sa vigil; bahagi ito ng iisang ritmo ng Semana Santa sa buong bansa.',
    },
    {
      month: 3,
      date: 9,
      name: 'Araw ng Kagitingan',
      firstDeclaredDate: 'April 6, 1961',
      approvedBy: 'Congress of the Philippines',
      law: 'Republic Act No. 3022 (proclaimed April 9 as Bataan Day / legal holiday); national schedule also reflected in Executive Order No. 292 and Republic Act No. 9492 (observance may move to Monday nearest April 9 per R.A. No. 9492)',
      lawUrl: H_LAWPHIL_RA3022,
      description:
        'R.A. No. 3022 proclaims the ninth of April as Bataan Day and declares it a legal holiday, with rites honoring the defenders of Bataan.',
      descriptionSource: 'LawPhil — Republic Act No. 3022 (full text)',
      descriptionUrl: H_LAWPHIL_RA3022,
      trivia:
        'Ang mga nakaligtas sa Death March sa Bataan ay naglakad nang napakahabang distansya sa ilalim ng init, gutom, at sakit—naging pandaigdigang simbolo ng tindi ng loob. Maaaring ilipat sa Lunes ang petsa alinsunod sa R.A. No. 9492, kaya tingnan ang Proklamasyon bago magplano ng long weekend.',
      triviaSource: 'LawPhil — Republic Act No. 9492 (full text)',
      triviaUrl: H_LAWPHIL_RA9492,
      whyCelebrated:
        'Ipinagdiriwang ang tapang ng mga sundalong Pilipino at kaalyado sa kampanya sa Bataan at Death March—itinuturo sa eskwelahan, may mga seremonya ng paggunita, at bahagi ng pagmamahal sa bayan at pasasalamat sa beterano.',
    },
    {
      month: 4,
      date: 1,
      name: 'Labor Day',
      firstDeclaredDate: 'April 8, 1908',
      approvedBy: 'Philippine Commission; later codified by President of the Philippines (E.O. No. 292)',
      law: 'Act No. 1870 (1908); Executive Order No. 292 — Administrative Code of 1987; Republic Act No. 9492 (Monday nearest May 1)',
      lawUrl: H_CHANROBLES_EO292,
      description:
        'Labor Day (May 1) appears in the regular holiday table under the Administrative Code; R.A. No. 9492 provides rules for observance on the Monday nearest May 1.',
      descriptionSource: 'Chan Robles Virtual Law Library — Executive Order No. 292',
      descriptionUrl: H_CHANROBLES_EO292,
      trivia:
        'Noon sa Maynila ang Mayo 1 ay sigaw sa Mendiola at mga isyu sa kartulina; ngayon kasama na ang TikTok at diskusyon tungkol sa remittance ng OFW. Puwede ring ilipat ng R.A. No. 9492 ang holiday sa pinakamalapit na Lunes—kaya kung minsan magkapareho ang “math” ng nagpoprotesta at ng nagba-beach sa long weekend.',
      triviaSource: 'LawPhil — Republic Act No. 9492 (full text)',
      triviaUrl: H_LAWPHIL_RA9492,
      whyCelebrated:
        'Tinataguyod ng Mayo 1 ang dignidad ng pagmamanggawa sa konteksto ng Pilipinas: martsa, unyon, at talumpati—ugaling ikinabit sa Pandaigdigang Araw ng Paggawa at sa lokal na laban para sa makatarungang sahod at disenteng trabaho.',
    },
    {
      month: 5,
      date: 12,
      name: 'Independence Day',
      firstDeclaredDate: 'June 12, 1898',
      approvedBy: 'President of the Philippines (Proclamation No. 28, 1962, restored June 12 observance)',
      law: 'Proclamation No. 28, s. 1962; Executive Order No. 292; Republic Act No. 9492 (Monday nearest June 12)',
      lawUrl: H_LAWPHIL_PROC28,
      description:
        'Proclamation No. 28 (1962) declares June 12 as Philippine Independence Day in commemoration of the 1898 declaration of independence.',
      descriptionSource: 'LawPhil — Proclamation No. 28 (1962)',
      descriptionUrl: H_LAWPHIL_PROC28,
      trivia:
        'Ang watawat na winagayway sa proklamasyon noong 1898 ay bahagyang tinahi nina Marcela Agoncillo at mga kasama sa Hong Kong—kaya ang kasarinlan ay may kuwentong biyahe, hindi lang talumpati mula balkonahe sa Kawit. Maaari ring ilipat sa Lunes ang Hunyo 12; ang Proklamasyon at abiso ng DOLE ang magpapasya kung sino ang may long weekend.',
      triviaSource: 'LawPhil — Republic Act No. 9492 (full text)',
      triviaUrl: H_LAWPHIL_RA9492,
      whyCelebrated:
        'Ipinagdiriwang ang Hunyo 12 bilang sandali ng kasarinlan noong 1898—watawat, programa sa paaralan, at seremonyang pampubliko bilang pagpapahayag ng pagmamalaki sa kasaysayan at soberanya, kadalasang may kasamang pamilya o lokal na pistahan.',
    },
    {
      month: 7,
      date: 31,
      name: 'National Heroes Day',
      firstDeclaredDate: 'July 24, 1987',
      approvedBy: 'President of the Philippines',
      law: 'Executive Order No. 292 — Administrative Code of 1987; Republic Act No. 9492 (last Monday of August)',
      lawUrl: H_LAWPHIL_RA9492,
      description:
        'R.A. No. 9492 lists National Heroes Day on the last Monday of August. This app may show a placeholder calendar date in August—always confirm the exact Monday in the Presidential Proclamation.',
      descriptionSource: 'LawPhil — Republic Act No. 9492 (full text)',
      descriptionUrl: H_LAWPHIL_RA9492,
      trivia:
        'Isang handaan ng alaala: manunulat, sundalo, guro, nars, at mga mandirigma sa barrio na ibinabahagi ang huling Lunes ng Agosto—habang binibiringkas ng TV ang mga kuwento ng himagsikan. Taun-taon pa ring itinutuwid ng Pangulo ang long weekend, kaya mistulang “suspense” ang kalendaryo ng holiday economics.',
      triviaSource: 'LawPhil — Republic Act No. 9492 (full text)',
      triviaUrl: H_LAWPHIL_RA9492,
      whyCelebrated:
        'Humihinto ang mga Pilipino upang parangalan ang lumaban para sa kalayaan at reporma—mula sa rebolusyonaryo hanggang sa mga martir—sa pamamagitan ng korona, programa sa paaralan, at midya; pinapatibay ang kultura at pagkamamamayan sa pamamagitan ng pag-alala.',
    },
    {
      month: 10,
      date: 1,
      name: "All Saints' Day",
      firstDeclaredDate: 'November 1',
      approvedBy: 'President of the Philippines (annual Presidential Proclamation)',
      law: 'Nationwide special non-working days are proclaimed yearly; November 1 is traditionally observed as All Saints\' Day (kalendaryong simbahan at Proklamasyon ng Pangulo).',
      lawUrl: H_LAWPHIL_RA9492,
      description:
        'November 1 is widely observed as All Saints\' Day in the Philippines. Whether it is a special non-working day for a given year is set in that year\'s Presidential Proclamation and DOLE labor advisory—cross-check before payroll.',
      descriptionSource: 'LawPhil — Republic Act No. 9492 (holiday framework)',
      descriptionUrl: H_LAWPHIL_RA9492,
      trivia:
        'Samu\'t saring alamat ng mga santo ang dumudungaw sa kandila at bulaklak sa mga sementeryo—iba ang tono ng Nobyembre 1 kaysa pistang bayan: mas tahimik, mas pamilya, at minsan mas maingay sa trapiko papunta sa libingan.',
      triviaSource: 'Department of Labor and Employment',
      triviaUrl: H_DOLE,
      whyCelebrated:
        'Inaalala ng mga Katoliko ang kaluwalhatian ng mga santo—may dalaw sa puntod, panalangin, at pagtitipon ng pamilya bilang pagpaparangal sa mga nauna at bilang pag-asang pananampalataya.',
    },
    {
      month: 10,
      date: 2,
      name: "All Souls' Day",
      firstDeclaredDate: 'November 2',
      approvedBy: 'President of the Philippines (annual Presidential Proclamation)',
      law: 'Special (working or non-working) holiday status for November 2 is set per Presidential Proclamation; confirm each calendar year with the Official Gazette / DOLE.',
      lawUrl: H_LAWPHIL_RA9492,
      description:
        'November 2 (All Souls\' Day) is part of the Undás tradition in the Philippines. Status as working vs special holiday varies by yearly proclamation—verify for your payroll year.',
      descriptionSource: 'Department of Labor and Employment',
      descriptionUrl: H_DOLE,
      trivia:
        'Ang Undás ay mistulang reunion sa mga puntod: nagdadala ng pagkain, nagbabahaginan ng kuwento, at nagpapatugtog—pinagsasama ang pagluksa at kasiyahan sa iisang araw ng pamilya.',
      triviaSource: 'Department of Labor and Employment',
      triviaUrl: H_DOLE,
      whyCelebrated:
        'Ginugunita ang mga kaluluwa ng mga yumao—panalangin, kandila, at pagbisita sa puntod bilang pagmamahal at pagpaparangal sa ninuno at mahal sa buhay.',
    },
    {
      month: 11,
      date: 25,
      name: 'Christmas Day',
      firstDeclaredDate: 'April 13, 1917',
      approvedBy: 'Philippine Legislature; codified in Executive Order No. 292',
      law: 'Act No. 3458 (1917); Executive Order No. 292 — Administrative Code of 1987 (December 25 as regular holiday)',
      lawUrl: H_CHANROBLES_EO292,
      description:
        'December 25 is listed as a regular holiday (Christmas Day) in the Administrative Code holiday schedule.',
      descriptionSource: 'Chan Robles Virtual Law Library — Executive Order No. 292',
      descriptionUrl: H_CHANROBLES_EO292,
      trivia:
        'Bago sumapit ang Disyembre 25, maraming Pilipino ang nakaranas na ng siyam na misa sa madaling araw—Simbang Gabi—kaya ang Pasko ay hindi simula kundi tuktok ng mahabang “Ber months” na madalas sabihing kabilang sa pinakamatagal na kapaskuhan sa mundo. Paalala pa rin ng DOLE sa payroll ang holiday premium kapag tapos na ang handaan.',
      triviaSource: 'Department of Labor and Employment',
      triviaUrl: H_DOLE,
      whyCelebrated:
        'Pinaghahalo ng Pasko ang katuwaang Kristiyano at kinaugaliang Pilipino: Simbang Gabi, Noche Buena kasama ang pamilya, pagdalaw sa mga inaanak, at mahabang kapaskuhan—pananampalataya, pagmamalasakit, at pagsasama sa tahanan ang sentro ng araw.',
    },
    {
      month: 11,
      date: 30,
      name: 'Rizal Day',
      firstDeclaredDate: 'February 1, 1902',
      approvedBy: 'U.S. Philippine Commission; later codified by President of the Philippines (E.O. No. 292)',
      law: 'Act No. 345 (1902); Executive Order No. 292; Republic Act No. 9492 (Monday nearest December 30)',
      lawUrl: H_CHANROBLES_EO292,
      description:
        'Rizal Day commemorates Dr. José Rizal. The national schedule is in the Administrative Code; R.A. No. 9492 sets observance on the Monday nearest December 30.',
      descriptionSource: 'Chan Robles Virtual Law Library — Executive Order No. 292',
      descriptionUrl: H_CHANROBLES_EO292,
      trivia:
        'Sa edad na 35, hinarap ni Rizal ang platoon ng Espanya at itinago ang huling tulang Mi último adiós sa maliit na kalan de alak na ibinigay sa kapatid—naging “kontrabando” ang tulang galing sa kusina. Sa Luneta (dating Bagumbayan) patuloy ang mga seremonya; tinutulungan ng NHCP na manatiling malakas ang kuwento kaysa ingay ng trapiko.',
      triviaSource: 'National Historical Commission of the Philippines',
      triviaUrl: H_NHCP,
      whyCelebrated:
        'Ang Disyembre 30 ay alaala ng martiryo at mga sulat ni José Rizal na nagpaalab ng reporma at pagkabansa—may bandila, korona sa Luneta, at aralin sa paaralan bilang tradisyong sibiko at moral.',
    },
    {
      month: 11,
      date: 31,
      name: "New Year's Eve",
      firstDeclaredDate: 'July 25, 2007',
      approvedBy: 'Congress of the Philippines',
      law: 'Republic Act No. 9492 — includes “Last Day of the Year” (December 31) among nationwide special holidays in the amended Administrative Code table',
      lawUrl: H_LAWPHIL_RA9492,
      description:
        'R.A. No. 9492 amends Sec. 26, Chapter 7, Book I of E.O. No. 292 to include December 31 as a nationwide special holiday (Last Day of the Year).',
      descriptionSource: 'LawPhil — Republic Act No. 9492 (full text)',
      descriptionUrl: H_LAWPHIL_RA9492,
      trivia:
        'Sagutan ang “bingo” ng pamahiin: tumalon sa hatinggabi, magsuot ng tuldok-tuldok, magkalat ng barya sa mesa, at maghanay ng labindalawang bilog na prutas—ang Disyembre 31 ay nagiging munting dambana ng swerte bago ang media noche. Nakalista sa R.A. No. 9492 bilang “Last Day of the Year”; ipinaliliwanag pa rin ng DOLE kung ano ang ibig sabihin nito sa payslip.',
      triviaSource: 'LawPhil — Republic Act No. 9492 (full text)',
      triviaUrl: H_LAWPHIL_RA9492,
      whyCelebrated:
        'Tulay ng Disyembre 31 sa pagitan ng mga taon: nagtitipon ang pamilya sa media noche, pasasalamat, at mga ritwal para sa kasaganaan—mas kaugalian kaysa batas ang nagpapakahulugan sa araw bago ang Bagong Taon.',
    },
  ];

  var monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  var dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  /** Minute tick while Events panel is open — sync past-dated user events to Done. */
  var eventsPanelTimerId = null;
  var teamPanelTimerId = null;
  /** Poll GET tasks/api while Tasks panel is open so assignees see creator edits (e.g. Allow file) without refresh. */
  var tasksPanelTimerId = null;
  /** Fallback poll for other browsers/devices (same-time sync uses BroadcastChannel + post-save notify) */
  var eventsApiBackgroundPollId = null;
  var profileNotifPollId = null;
  var eventsBroadcastChannel = null;

  function stopEventsApiBackgroundPoll() {
    if (eventsApiBackgroundPollId != null) {
      window.clearInterval(eventsApiBackgroundPollId);
      eventsApiBackgroundPollId = null;
    }
  }

  function initEventsCrossTabSync() {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        eventsBroadcastChannel = new BroadcastChannel('rpbdd_events_v1');
        eventsBroadcastChannel.onmessage = function (ev) {
          if (ev && ev.data && ev.data.type === 'invalidate') {
            scheduleDebouncedSharedModulesSync();
          }
        };
      } else {
        window.addEventListener('storage', function (ev) {
          if (ev.key === 'rpbdd_events_ping') {
            scheduleDebouncedSharedModulesSync();
          }
        });
      }
    } catch (err) {
      eventsBroadcastChannel = null;
    }
  }

  /** Other tabs/windows refresh immediately (BroadcastChannel or storage); other PCs use 1s poll. */
  function broadcastEventsChanged() {
    try {
      if (eventsBroadcastChannel) {
        eventsBroadcastChannel.postMessage({ type: 'invalidate' });
      } else {
        localStorage.setItem('rpbdd_events_ping', String(Date.now()));
      }
    } catch (err) {
      /* ignore */
    }
  }

  var state = {
    currentUser: null,
    currentDate: new Date(),
    activeNav: 'dashboard',
    sidebarCollapsed: false,
    events: [],
    deletedEvents: [],
    teams: [],
    /** Device-only recycled teams when teamsApi is not used */
    deletedTeams: [],
    /** Device-only recycled members when membersApi is not used */
    deletedMembers: [],
    teamMembers: [],
    /** Member login/logout rows from users-logs API (`rpbdd_monitoring_system.users_logs`) */
    userLogs: [],
    /** Logs table: false → date as MM-DD-YY; true → "Month D, YYYY" (toggle via Date header/cell) */
    logsDateLong: false,
    eventsView: 'upcoming',
    tasksView: 'new',
    reportsView: 'category',
    /** Events module list filter: prefix match on first word of title (empty → no filter) */
    eventsSearch: '',
    /** Team Management > Logs filter (Full Name, Team, Role, Date) */
    teamLogsSearch: '',
    /** Team Management > Active Users filter (no date — name, email, team, role, etc.) */
    teamActiveSearch: '',
    /** Total Teams toolbar filter */
    teamTeamsSearch: '',
    /** Total Members toolbar filter */
    teamMembersSearch: '',
    teamView: 'members',
    currentPage: 1,
    recordsPerPage: 5,
    expandedEventGroupKey: null,
    /** Events module deep-link target from sidebar ("Events this Month"). */
    pendingEventsExpandGroupKey: null,
    /** Local-only edit: snapshot group key (title+location) so Save replaces all matching rows. */
    editingEventGroupKey: null,
    /** Team Management — Total Teams card view; string id of expanded team or null */
    expandedTeamId: null,
    /** Total Members / Active Users card view; string id of expanded member or null */
    expandedMemberId: null,
    /** Teams Recycle Bin modal — expanded card key (recycle row id string or "L0" local) */
    expandedTeamRecycleId: null,
    /** Members Recycle Bin modal — expanded card key */
    expandedMemberRecycleId: null,
    /** Events Recycle Bin modal — expanded card key (api row "A{id}" or local row "L{index}") */
    expandedEventRecycleId: null,
    /** Set when Add Team modal is used for edit (string id) */
    editingTeamId: null,
    /** Raw API team object while Section Chief Account modal is in use */
    accountLeaderTeam: null,
    /** Raw API member object while Member Account modal is in use */
    accountMemberMember: null,
    /** Set when Add Member modal is used for edit (string id) */
    editingMemberId: null,
    editingEvent: null,
    eventDates: [''],
    editEventDates: [''],
    notifications: [],
    expandedNotificationId: null,
    notifPending: 0,
    birthdayCelebrants: [],
    editingBirthdayId: null,
    expandedBirthdayId: null,
    birthdayPositions: [],
    birthdaySections: [],
    birthdayModalView: 'upcoming',
    /** First day of month — Birthday Celebrants modal list (same UX as Events module month bar). */
    birthdayModalPanelDate: (function () {
      var n = new Date();
      return new Date(n.getFullYear(), n.getMonth(), 1);
    })(),
    /** Notifications modal: Unread vs Read list (dashboard widget stays unread-only). */
    notificationsModalView: 'unread',
    /** { sourceId, serverNumericId, movedAt, snapshot }[] — Read tab only, device-local. */
    profileNotifRecycle: [],
    /** Server row ids purged from the notifications recycle bin (permanent hide). */
    profileNotifPurgedServerIds: [],
    reportModalEmail: '',
    /** Reports folder modal — category key for re-rendering event cards. */
    reportFolderModalCatName: '',
    /** Reports folder modal — expanded event card key "up:title" / "dn:title" or null. */
    reportFolderEventExpandedKey: null,
    /** Reports folder modal section view: up | dn */
    reportFolderModalView: 'up',
    /** Expanded card index key in modal-notifications-read-recycle (string). */
    expandedProfileNotifReadRecycleKey: null,
    /** YYYY-MM-DD in visible month, or null → show next 4 upcoming globally */
    sidebarSelectedYmd: null,
    /** First day of month — Events module list + holidays for this month */
    eventsPanelDate: (function () {
      var n = new Date();
      return new Date(n.getFullYear(), n.getMonth(), 1);
    })(),
    /** Events list pagination (cards per page = EVENTS_CARDS_PER_PAGE) */
    eventsPanelPage: 1,
    /** Recycle Bin modal — same page size as Events list */
    recycleEventsPage: 1,
    recycleBinRenderedParts: null,
    recycleBinHintPrefix: '',
    recycleBinHandlersBase: '',
    /** Admin-assigned checklist lists (GET tasks/api). */
    taskLists: [],
    /** Tasks module expanded card list id */
    expandedTaskListId: null,
    /** Tasks list pagination (max TASKS_CARDS_PER_PAGE per section) */
    tasksPageNew: 1,
    tasksPageSent: 1,
    tasksPagePending: 1,
    tasksPageReview: 1,
    tasksPageDone: 1,
  };

  var MAX_MONTH_WIDGET = 3;
  /** Upcoming/Done Events list: max distinct title-groups (cards) per page, including PH holidays. */
  var EVENTS_CARDS_PER_PAGE = 5;
  var TASKS_CARDS_PER_PAGE = 5;
  /** Base URL for Events JSON API (no trailing slash); from #rpbdd-app-config */
  var eventsApiBase = '';
  /** Base URL for Teams JSON API (total_teams); from #rpbdd-app-config */
  var teamsApiBase = '';
  /** Base URL for Members JSON API (total_members); from #rpbdd-app-config */
  var membersApiBase = '';
  var birthdaysApiBase = '';
  /** GET profile-notifications/api — member profile alerts for admin / team_leader */
  var profileNotificationsApiBase = '';
  /** Base URL for users_logs JSON API; from #rpbdd-app-config */
  var userLogsApiBase = '';
  /** GET/POST tasks/api — admin-assigned checklists */
  var tasksApiBase = '';
  /** GET auth/api/my-admin — admin account profile */
  var adminAccountApiBase = '';
  /** POST endpoint for Team Management PDF download; from #rpbdd-app-config */
  var teamExportPdfUrl = '';
  /** POST endpoint for Team Management print (same HTML as PDF); from #rpbdd-app-config */
  var teamExportPrintUrl = '';
  /** GET auth/logout — idle / end-of-day auto sign-out; from #rpbdd-app-config */
  var logoutUrlBase = '';
  /** POST auth/api/logout-beacon — best-effort logging for close/unload/logout. */
  var logoutBeaconUrlBase = '';
  /** No UI activity for this long → redirect to logout (ms); default 10 hours. */
  var sessionIdleMs = 10 * 60 * 60 * 1000;

  function readAppConfig() {
    var el = document.getElementById('rpbdd-app-config');
    if (!el) return;
    try {
      var c = JSON.parse(el.textContent || '{}');
      if (c.eventsApi) eventsApiBase = String(c.eventsApi).replace(/\/+$/, '');
      if (c.teamsApi) teamsApiBase = String(c.teamsApi).replace(/\/+$/, '');
      if (c.membersApi) membersApiBase = String(c.membersApi).replace(/\/+$/, '');
      if (c.birthdaysApi) birthdaysApiBase = String(c.birthdaysApi).replace(/\/+$/, '');
      if (c.profileNotificationsApi) {
        profileNotificationsApiBase = String(c.profileNotificationsApi).replace(/\/+$/, '');
      }
      if (c.userLogsApi) userLogsApiBase = String(c.userLogsApi).replace(/\/+$/, '');
      if (c.tasksApi) tasksApiBase = String(c.tasksApi).replace(/\/+$/, '');
      if (c.adminAccountApi) adminAccountApiBase = String(c.adminAccountApi).replace(/\/+$/, '');
      teamExportPdfUrl = c.teamExportPdf ? String(c.teamExportPdf).replace(/\/+$/, '') : '';
      teamExportPrintUrl = c.teamExportPrint ? String(c.teamExportPrint).replace(/\/+$/, '') : '';
      if (!teamExportPrintUrl && teamExportPdfUrl) {
        teamExportPrintUrl = teamExportPdfUrl.replace(/\/pdf\/?$/i, '/print');
      }
      logoutUrlBase = c.logoutUrl ? String(c.logoutUrl).replace(/\/+$/, '') : '';
      logoutBeaconUrlBase = c.logoutBeaconUrl ? String(c.logoutBeaconUrl).replace(/\/+$/, '') : '';
      if (typeof c.sessionIdleMs === 'number' && c.sessionIdleMs > 0) {
        sessionIdleMs = c.sessionIdleMs;
      }
    } catch (err) {
      eventsApiBase = '';
      teamsApiBase = '';
      membersApiBase = '';
      birthdaysApiBase = '';
      profileNotificationsApiBase = '';
      userLogsApiBase = '';
      tasksApiBase = '';
      adminAccountApiBase = '';
      teamExportPdfUrl = '';
      teamExportPrintUrl = '';
      logoutUrlBase = '';
      logoutBeaconUrlBase = '';
      sessionIdleMs = 10 * 60 * 60 * 1000;
    }
  }

  function normalizeDashboardTheme(raw) {
    var s = String(raw || '')
      .trim()
      .toLowerCase();
    if (s === 'dark') return 'night';
    if (s === 'night') return 'night';
    return 'light';
  }

  function beginSharedThemeWriteGuard(expectedRaw) {
    var expected = normalizeDashboardTheme(expectedRaw);
    sharedThemeWriteGuard = { expected: expected, startedAt: Date.now() };
    if (sharedThemeWriteGuardTimer) window.clearTimeout(sharedThemeWriteGuardTimer);
    sharedThemeWriteGuardTimer = window.setTimeout(function () {
      sharedThemeWriteGuardTimer = null;
      sharedThemeWriteGuard = null;
    }, SHARED_THEME_WRITE_GUARD_MS);
  }

  function noteSharedThemeConfirmedByServer(rawTheme) {
    if (!sharedThemeWriteGuard) return;
    if (normalizeDashboardTheme(rawTheme) === sharedThemeWriteGuard.expected) {
      if (sharedThemeWriteGuardTimer) window.clearTimeout(sharedThemeWriteGuardTimer);
      sharedThemeWriteGuardTimer = null;
      sharedThemeWriteGuard = null;
    }
  }

  function shouldIgnoreStaleSharedThemePull(rawTheme) {
    if (!sharedThemeWriteGuard) return false;
    var t = normalizeDashboardTheme(rawTheme);
    if (Date.now() - sharedThemeWriteGuard.startedAt >= SHARED_THEME_WRITE_GUARD_MS) return false;
    return t !== sharedThemeWriteGuard.expected;
  }

  function syncThemePickerUi() {
    var btn = document.getElementById('rpbdd-theme-toggle');
    var t = normalizeDashboardTheme(document.documentElement.getAttribute('data-rpbdd-theme'));
    if (!btn) return;
    btn.textContent = t === 'night' ? 'Night sky' : 'Light';
    btn.setAttribute(
      'aria-label',
      t === 'night' ? 'Theme: Night sky. Click to switch to Light.' : 'Theme: Light. Click to switch to Night sky.',
    );
    btn.title = t === 'night' ? 'Switch to Light theme' : 'Switch to Night sky theme';
    btn.setAttribute('aria-pressed', t === 'night' ? 'true' : 'false');
  }

  function normalizeDashboardDensity(raw) {
    var s = String(raw || '')
      .trim()
      .toLowerCase();
    if (s === 'comfortable') return 'comfortable';
    return 'compact';
  }

  function applyTheme(mode, opts) {
    opts = opts || {};
    var next = normalizeDashboardTheme(mode);
    document.documentElement.setAttribute('data-rpbdd-theme', next);
    try {
      localStorage.setItem(LS_THEME, next);
    } catch (e) {
      /* ignore */
    }
    syncThemePickerUi();
    if (opts.persistShared && getEventsApiBase()) {
      beginSharedThemeWriteGuard(next);
      persistSharedDashboardThemeToApi(next);
    }
  }

  function persistSharedDashboardThemeToApi(theme) {
    var base = getEventsApiBase();
    if (!base) return Promise.resolve(false);
    var next = normalizeDashboardTheme(theme);
    return fetch(base + '/shared-settings', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        if (!parsed.okHttp || !j || !j.ok) {
          if (!window.__rpbddSharedThemeWarned && j && j.error === 'shared_settings_table_missing') {
            window.__rpbddSharedThemeWarned = true;
            rpbddAlertMessage(
              'Shared theme is not set up on the server yet. Run supabase/apply_dashboard_shared_settings.sql in the Supabase SQL Editor so all users get the same Light / Night sky mode.',
            );
          }
          return false;
        }
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function persistSharedSidebarCollapsedToApi(collapsed) {
    var base = getEventsApiBase();
    if (!base) return Promise.resolve(false);
    return fetch(base + '/shared-settings', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ sidebar_collapsed: !!collapsed }),
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        return !!(parsed.okHttp && j && j.ok);
      })
      .catch(function () {
        return false;
      });
  }

  function applyDensityMode(mode, opts) {
    opts = opts || {};
    var next = normalizeDashboardDensity(mode);
    document.documentElement.setAttribute('data-rpbdd-density', next);
    try {
      localStorage.setItem(LS_DENSITY, next);
    } catch (e) {
      /* ignore */
    }
    if (opts.persistShared && getEventsApiBase()) {
      fetch(getEventsApiBase() + '/shared-settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ density: next }),
      }).catch(function () {});
    }
  }

  function refreshSharedDashboardSettingsFromApi() {
    var base = getEventsApiBase();
    if (!base) return Promise.resolve();
    return fetch(base + '/shared-settings', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        if (!parsed.okHttp || !j || !j.ok) return;
        var t = normalizeDashboardTheme(j.theme);
        var cur = normalizeDashboardTheme(document.documentElement.getAttribute('data-rpbdd-theme'));
        noteSharedThemeConfirmedByServer(j.theme);
        if (!shouldIgnoreStaleSharedThemePull(j.theme) && t !== cur) applyTheme(t);
        if (typeof j.sidebar_collapsed === 'boolean') {
          state.sidebarCollapsed = !!j.sidebar_collapsed;
          applySidebarCollapsedFromState();
        }
        if (j.density != null) applyDensityMode(j.density);
      })
      .catch(function () {});
  }

  function applyDensityCompact() {
    var d = 'compact';
    try {
      d = normalizeDashboardDensity(localStorage.getItem(LS_DENSITY) || 'compact');
    } catch (e) {
      d = 'compact';
    }
    applyDensityMode(d);
  }

  /** Asia/Manila calendar date YYYY-MM-DD (matches PHP session_login_ymd). */
  function manilaCalendarYmd() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch (e) {
      return '';
    }
  }

  var logoutBeaconSent = false;
  function sendLogoutBeacon(reason) {
    if (logoutBeaconSent || !logoutBeaconUrlBase) return;
    var role = currentUserRole();
    if (role !== 'admin' && role !== 'team_leader' && role !== 'member' && role !== 'user') return;
    logoutBeaconSent = true;
    var body = JSON.stringify({
      reason: String(reason || 'unknown'),
      at: new Date().toISOString(),
    });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(logoutBeaconUrlBase, blob);
        return;
      }
    } catch (e) {}
    try {
      fetch(logoutBeaconUrlBase, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body,
        keepalive: true,
      });
    } catch (e) {}
  }

  /**
   * 10h idle (no clicks/keys/scroll/mouse) or calendar day change vs session login day → GET auth/logout.
   * Member/Section Chief/Admin: users_logs Logout = exact Manila time on logout (or 23:59:59 on day rollover).
   */
  function initSessionAutoLogout() {
    if (!logoutUrlBase || !document.getElementById('rpbdd-sidebar')) return;
    var role = currentUserRole();
    if (role !== 'admin' && role !== 'team_leader' && role !== 'member' && role !== 'user') {
      return;
    }

    var loginYmd = '';
    if (state.currentUser && state.currentUser.sessionLoginYmd) {
      loginYmd = String(state.currentUser.sessionLoginYmd).trim();
    }

    var lastActivity = Date.now();
    function bumpActivity() {
      lastActivity = Date.now();
    }

    ['click', 'keydown', 'scroll', 'touchstart', 'mousedown', 'wheel'].forEach(function (ev) {
      document.addEventListener(ev, bumpActivity, { passive: true });
    });
    var lastMouseThrottle = 0;
    document.addEventListener(
      'mousemove',
      function () {
        var t = Date.now();
        if (t - lastMouseThrottle > 2000) {
          lastMouseThrottle = t;
          bumpActivity();
        }
      },
      { passive: true },
    );

    window.setInterval(function () {
      if (!logoutUrlBase) return;
      var today = manilaCalendarYmd();
      if (loginYmd && today && today !== loginYmd) {
        sendLogoutBeacon('dayend');
        window.location.href = logoutUrlBase + '?dayend=1';
        return;
      }
      if (Date.now() - lastActivity >= sessionIdleMs) {
        sendLogoutBeacon('idle_timeout');
        window.location.href = logoutUrlBase + '?idle=1';
      }
    }, 30000);

    // NOTE:
    // Do not send logout beacon on refresh/navigation events (beforeunload/pagehide),
    // because browsers fire those on reload too and can accidentally end the session.
    // Stale-session server cleanup (10h) handles hard-close/power-loss fallback.
  }

  function getEventsApiBase() {
    return eventsApiBase || '';
  }

  function getTeamsApiBase() {
    return teamsApiBase || '';
  }

  function getMembersApiBase() {
    return membersApiBase || '';
  }

  function getBirthdaysApiBase() {
    return birthdaysApiBase || '/supabase-birthdays-api';
  }

  function getProfileNotificationsApiBase() {
    return profileNotificationsApiBase || '';
  }

  function getUserLogsApiBase() {
    return userLogsApiBase || '';
  }

  function getTasksApiBase() {
    return tasksApiBase || '';
  }

  function getAdminAccountApiBase() {
    return adminAccountApiBase || '';
  }

  function persistCurrentUserToLocalStorage() {
    try {
      if (!state.currentUser) return;
      var o = {
        email: String(state.currentUser.email || '').trim(),
        name: String(state.currentUser.name || '').trim(),
        role: String(state.currentUser.role || '').trim(),
        team: String(state.currentUser.team || state.currentUser.sectionTeam || '').trim(),
      };
      if (state.currentUser.photo != null && String(state.currentUser.photo).trim() !== '') {
        o.photo = String(state.currentUser.photo).trim();
      }
      localStorage.setItem('rpbdd_current_user', JSON.stringify(o));
    } catch (e) {
      /* ignore */
    }
  }

  function displayNameFromEmail(email) {
    var em = String(email || '').trim();
    if (!em) return '';
    var at = em.indexOf('@');
    return at > 0 ? em.slice(0, at) : em;
  }

  function normalizeProfilePhotoSrc(photo) {
    if (photo == null || String(photo).trim() === '') return '';
    var s = String(photo).trim();
    var maybeBase64NoPrefix = /^[A-Za-z0-9+/=\r\n]+$/.test(s) && s.length > 80;
    if (maybeBase64NoPrefix) {
      s = 'data:image/jpeg;base64,' + s.replace(/\s+/g, '');
    }
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(s)) {
      s = s.replace(/\s+/g, '');
    }
    return s;
  }

  function applyAdminAccountToSidebar(admin) {
    if (!admin) return;
    if (!state.currentUser) state.currentUser = {};
    if (admin.email != null && String(admin.email).trim() !== '') {
      state.currentUser.email = String(admin.email).trim().toLowerCase();
    }
    var dn = '';
    if (admin.fullName != null && String(admin.fullName).trim() !== '') {
      dn = String(admin.fullName).trim();
    }
    if (!dn) dn = displayNameFromEmail(admin.email);
    if (dn) state.currentUser.name = dn;
    if (admin.photo != null && String(admin.photo).trim() !== '') {
      state.currentUser.photo = normalizeProfilePhotoSrc(admin.photo);
    }
    var sn = document.getElementById('rpbdd-sidebar-name');
    if (sn) sn.textContent = state.currentUser.name || 'User';
    var se = document.getElementById('rpbdd-sidebar-email');
    if (se) se.textContent = state.currentUser.email || '';
    var av = document.getElementById('rpbdd-avatar-img');
    var initialsEl = document.getElementById('rpbdd-user-initials');
    if (state.currentUser.photo && av) {
      var ph = String(state.currentUser.photo);
      if (ph && !/^data:/i.test(ph)) {
        ph += (ph.indexOf('?') >= 0 ? '&' : '?') + 'v=' + String(Date.now());
      }
      av.src = ph;
      av.style.display = 'block';
      if (initialsEl) initialsEl.style.display = 'none';
    } else {
      if (av) {
        av.removeAttribute('src');
        av.style.display = 'none';
      }
      if (initialsEl && state.currentUser.name) {
        initialsEl.textContent = state.currentUser.name
          .split(' ')
          .map(function (n) {
            return n[0];
          })
          .join('')
          .toUpperCase()
          .slice(0, 2);
        initialsEl.style.display = '';
      }
    }
    persistCurrentUserToLocalStorage();
  }

  function refreshAdminSidebarFromSupabase() {
    if (currentUserRole() !== 'admin') return;
    var base = getAdminAccountApiBase();
    if (!base) return;
    var currentEmail =
      state.currentUser && state.currentUser.email != null ? String(state.currentUser.email).trim() : '';
    if (!currentEmail) return;
    var url = base + '?email=' + encodeURIComponent(currentEmail);
    fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { res: res, j: j };
        });
      })
      .then(function (o) {
        if (!o.res.ok || !o.j || !o.j.ok || !o.j.admin) return;
        applyAdminAccountToSidebar(o.j.admin);
      })
      .catch(function () {
        /* ignore */
      });
  }

  function getTeamExportPdfUrl() {
    return teamExportPdfUrl || '';
  }

  function getTeamExportPrintUrl() {
    return teamExportPrintUrl || '';
  }

  function refreshUserLogsFromApi() {
    var base = getUserLogsApiBase();
    if (!base) {
      state.userLogs = [];
      var el0 = document.getElementById('rpbdd-stat-logs');
      if (el0) el0.textContent = '0';
      return Promise.resolve(false);
    }
    return fetch(base, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('users-logs http ' + r.status);
        return r.json();
      })
      .then(function (j) {
        state.userLogs = Array.isArray(j.logs) ? j.logs : [];
        var el = document.getElementById('rpbdd-stat-logs');
        if (el) el.textContent = String(state.userLogs.length);
        return true;
      })
      .catch(function () {
        state.userLogs = [];
        var el2 = document.getElementById('rpbdd-stat-logs');
        if (el2) el2.textContent = '0';
        return false;
      });
  }

  function formatUserLogCell(v) {
    if (v == null || v === '') return '—';
    return String(v);
  }

  /** Strip time / ISO noise / stray dots; return YYYY-MM-DD or '' */
  function sanitizeLogDateRaw(v) {
    if (v == null) return '';
    var s = String(v).trim();
    if (!s || s.indexOf('0000-00-00') === 0) return '';
    s = s.replace(/\u2026/g, '').replace(/\.+$/g, '').trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return m[1] + '-' + m[2] + '-' + m[3];
  }

  /** @returns {{y:number,mo:number,d:number}|null} */
  function parseYmdPartsFromRaw(raw) {
    var clean = sanitizeLogDateRaw(raw);
    if (!clean) return null;
    var m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return { y: parseInt(m[1], 10), mo: parseInt(m[2], 10), d: parseInt(m[3], 10) };
  }

  function getLogRowDateRaw(r) {
    if (!r) return '';
    var d = sanitizeLogDateRaw(r.date);
    if (d) return d;
    return sanitizeLogDateRaw(r.login);
  }

  function formatLogDateShortFromRaw(raw) {
    var p = parseYmdPartsFromRaw(raw);
    if (!p) return '—';
    var mm = p.mo < 10 ? '0' + p.mo : String(p.mo);
    var dd = p.d < 10 ? '0' + p.d : String(p.d);
    var yy = p.y % 100;
    var ys = yy < 10 ? '0' + yy : String(yy);
    return mm + '-' + dd + '-' + ys;
  }

  var LOG_MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  function formatLogDateLongFromRaw(raw) {
    var p = parseYmdPartsFromRaw(raw);
    if (!p || p.mo < 1 || p.mo > 12) return '—';
    return LOG_MONTH_NAMES[p.mo - 1] + ' ' + p.d + ', ' + p.y;
  }

  function parseLogDateTime(v) {
    if (v == null || v === '') return null;
    var str = String(v).trim();
    var m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      var y = parseInt(m[1], 10);
      var mo = parseInt(m[2], 10) - 1;
      var d = parseInt(m[3], 10);
      var hh = m[4] != null ? parseInt(m[4], 10) : 0;
      var mm = m[5] != null ? parseInt(m[5], 10) : 0;
      var ss = m[6] != null ? parseInt(m[6], 10) : 0;
      return new Date(y, mo, d, hh, mm, ss);
    }
    var d2 = new Date(str);
    return isNaN(d2.getTime()) ? null : d2;
  }

  var LOG_PH_TZ = 'Asia/Manila';

  /**
   * DB stores Login/Logout as Philippine wall time (naive YYYY-MM-DD HH:mm:ss).
   * Parse as PHT so display matches real PH time regardless of browser timezone.
   */
  function parseLogDateTimePhilippines(v) {
    if (v == null || v === '') return null;
    var str = String(v).trim();
    var m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) {
      return parseLogDateTime(v);
    }
    var hh = m[4] != null ? parseInt(m[4], 10) : 0;
    var min = m[5] != null ? parseInt(m[5], 10) : 0;
    var ss = m[6] != null ? parseInt(m[6], 10) : 0;
    var pad = function (n) {
      return n < 10 ? '0' + n : String(n);
    };
    var iso = m[1] + '-' + m[2] + '-' + m[3] + 'T' + pad(hh) + ':' + pad(min) + ':' + pad(ss) + '+08:00';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  /** 12-hour clock in Philippine time (matches stored Login/Logout). */
  function formatUserLogTime12h(v) {
    if (v == null || v === '') return '—';
    var d = parseLogDateTimePhilippines(v);
    if (!d || isNaN(d.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: LOG_PH_TZ,
      }).format(d);
    } catch (e) {
      if (!d || isNaN(d.getTime())) return '—';
      try {
        return d.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: LOG_PH_TZ,
        });
      } catch (e2) {
        return '—';
      }
    }
  }

  function formatUserLogLogoutCell(v) {
    if (v == null || v === '') return '—';
    var s = String(v).trim();
    if (s === '' || s.indexOf('0000-00-00') === 0) return '—';
    return formatUserLogTime12h(s);
  }

  function formatUserLogRoleDisplay(r) {
    var x = r && r.role != null ? String(r.role).trim() : '';
    if (x === '') return 'Member';
    var xl = x.toLowerCase();
    if (xl === 'member') return 'Member';
    if (xl === 'section chief' || xl === 'team leader' || xl === 'team_leader') return 'Section Chief';
    if (xl.indexOf('section') !== -1 && xl.indexOf('chief') !== -1) return 'Section Chief';
    if (xl.indexOf('team') !== -1 && xl.indexOf('leader') !== -1) return 'Section Chief';
    return x;
  }

  function bindLogsTableFormatClicks() {
    var wrap = document.getElementById('rpbdd-team-table-wrap');
    if (!wrap || wrap.dataset.rpbddLogsDateBind === '1') return;
    wrap.dataset.rpbddLogsDateBind = '1';
    wrap.addEventListener('click', function (e) {
      if (state.teamView !== 'logs') return;
      if (!e.target.closest('.rpbdd-log-date-head') && !e.target.closest('td.rpbdd-log-date-cell')) return;
      state.logsDateLong = !state.logsDateLong;
      renderTeamPanel();
    });
    wrap.addEventListener('keydown', function (e) {
      if (state.teamView !== 'logs') return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var cell = e.target.closest('td.rpbdd-log-date-cell');
      if (!cell) return;
      e.preventDefault();
      state.logsDateLong = !state.logsDateLong;
      renderTeamPanel();
    });
  }

  function currentUserRole() {
    return String((state.currentUser && state.currentUser.role) || '').toLowerCase();
  }

  /** Events Recycle Bin: restore / permanent delete — admin only (team leaders & members can view). */
  function roleCanManageEventsRecycle() {
    return currentUserRole() === 'admin';
  }

  function syncEventsRecycleBinChrome() {
    var admin = roleCanManageEventsRecycle();
    var ra = document.getElementById('rpbdd-recycle-restore-all');
    var da = document.getElementById('rpbdd-recycle-delete-all');
    var foot = document.querySelector('#modal-recycle .rpbdd-modal-foot--recycle');
    if (ra) {
      ra.hidden = !admin;
      ra.style.display = admin ? '' : 'none';
    }
    if (da) {
      da.hidden = !admin;
      da.style.display = admin ? '' : 'none';
    }
    if (foot) {
      foot.hidden = !admin;
      foot.style.display = admin ? '' : 'none';
    }
  }

  /**
   * Add Event modal — "Input By" line saved as Input_By (role-specific label).
   * Admin: literal "Admin". Section Chief: name + section. Member: name + team.
   */
  function formatEventInputByDisplay() {
    var role = currentUserRole();
    var u = state.currentUser || {};
    var name = String(u.name || '').trim();
    if (role === 'admin') return 'Admin';
    if (role === 'team_leader') {
      var sec = String(u.sectionTeam || '').trim();
      var parts = ['Section Chief'];
      if (name) parts.push(name);
      if (sec) parts.push(sec);
      return parts.join(' - ');
    }
    if (role === 'member' || role === 'user') {
      var team = String(u.team || '').trim();
      if (name && team) return name + ' - ' + team;
      if (name) return name;
      if (team) return team;
      return 'Member';
    }
    return name || 'User';
  }

  function syncAddEventInputByField() {
    var el = document.getElementById('add-input-by');
    if (!el) return;
    el.value = formatEventInputByDisplay();
  }

  /** First defined team id from API row (camelCase or legacy DB-style keys). */
  function pickTeamRowId(row) {
    if (row.id != null && row.id !== '') return row.id;
    if (row.Team_ID != null && row.Team_ID !== '') return row.Team_ID;
    if (row.team_id != null && row.team_id !== '') return row.team_id;
    return null;
  }

  function firstNonEmptyString() {
    for (var i = 0; i < arguments.length; i++) {
      var x = arguments[i];
      if (x == null) continue;
      var s = String(x).trim();
      if (s !== '') return s;
    }
    return '';
  }

  function mapApiTeamToState(row) {
    if (!row) return null;
    var rid = pickTeamRowId(row);
    if (rid == null || rid === '') return null;
    var names = [];
    if (Array.isArray(row.memberNames)) {
      names = row.memberNames.map(function (n) {
        return String(n);
      });
    } else if (Array.isArray(row.member_names)) {
      names = row.member_names.map(function (n) {
        return String(n);
      });
    }
    var pwPlain = firstNonEmptyString(row.passwordPlain, row.password);
    if (pwPlain === '••••••••') pwPlain = '';
    var hasPw = !!row.hasPassword || pwPlain !== '';
    var leadIdVal = firstNonEmptyString(row.leadId, row.lead_id, row.Lead_ID);
    return {
      id: rid,
      leadId: leadIdVal,
      idNumber: leadIdVal,
      email: firstNonEmptyString(row.email, row.Email),
      password: hasPw ? '••••••••' : '',
      passwordPlain: pwPlain,
      hasPassword: hasPw,
      teamLeader: firstNonEmptyString(
        row.teamLeader,
        row.team_leader,
        row.Team_Leader,
        row.full_name,
        row.name,
        row.Name,
      ),
      sectionTeam: firstNonEmptyString(
        row.sectionTeam,
        row.section_team,
        row.Section_Team,
        row.section,
        row.department,
      ),
      position: firstNonEmptyString(row.position, row.Position, row.job_title, row.role),
      photo: row.photo != null && String(row.photo).trim() !== '' ? String(row.photo) : null,
      memberNames: names,
      memberCount:
        row.memberCount != null && row.memberCount !== '' && !isNaN(Number(row.memberCount))
          ? Number(row.memberCount)
          : row.Members != null && row.Members !== '' && !isNaN(Number(row.Members))
            ? Number(row.Members)
            : null,
      online: !!row.online || row.online === 1 || row.online === '1' || row.online === 'true',
      createdAt: row.createdAt != null && String(row.createdAt).trim() !== '' ? String(row.createdAt) : null,
      updatedAt: row.updatedAt != null && String(row.updatedAt).trim() !== '' ? String(row.updatedAt) : null,
    };
  }

  function refreshTeamsFromApi() {
    var base = getTeamsApiBase();
    if (!base) {
      return Promise.resolve(false);
    }
    var role = currentUserRole();
    var url = base;
    if (role === 'member') {
      url += (base.indexOf('?') >= 0 ? '&' : '?') + 'mode=options';
    }
    return fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { res: res, j: j };
        });
      })
      .then(function (o) {
        if (!o.res.ok || !o.j || !o.j.ok || !Array.isArray(o.j.teams)) {
          return false;
        }
        state.teams = o.j.teams
          .map(mapApiTeamToState)
          .filter(function (t) {
            return t != null;
          });
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  /** First defined member id from API row (camelCase or legacy DB-style keys). */
  function pickMemberRowId(row) {
    if (row.id != null && row.id !== '') return row.id;
    if (row.Member_ID != null && row.Member_ID !== '') return row.Member_ID;
    if (row.member_id != null && row.member_id !== '') return row.member_id;
    return null;
  }

  function mapApiMemberToState(row) {
    if (!row) return null;
    var rid = pickMemberRowId(row);
    if (rid == null || rid === '') return null;
    var pwPlain = firstNonEmptyString(row.passwordPlain, row.password, row.Password);
    if (pwPlain === '••••••••') pwPlain = '';
    var hasPw = !!row.hasPassword || pwPlain !== '';
    var email = firstNonEmptyString(row.email, row.Email);
    return {
      id: rid,
      employeeId: '',
      name: firstNonEmptyString(
        row.fullName,
        row.Full_Name,
        row.full_name,
        row.name,
        row.Name,
        displayNameFromEmail(email),
      ),
      email: email,
      password: hasPw ? '••••••••' : '',
      passwordPlain: pwPlain,
      hasPassword: hasPw,
      team: firstNonEmptyString(row.team, row.Team),
      role: '',
      photo: row.photo != null && String(row.photo).trim() !== '' ? String(row.photo) : null,
      online: !!row.online || row.online === 1 || row.online === '1' || row.online === 'true',
      createdAt: row.createdAt != null && String(row.createdAt).trim() !== '' ? String(row.createdAt) : null,
      updatedAt: row.updatedAt != null && String(row.updatedAt).trim() !== '' ? String(row.updatedAt) : null,
    };
  }

  function memberDisplayLabel(m) {
    if (!m) return '';
    return firstNonEmptyString(m.name, m.fullName, displayNameFromEmail(m.email));
  }

  function refreshMembersFromApi() {
    var base = getMembersApiBase();
    if (!base) return Promise.resolve(false);
    return fetch(base, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { res: res, j: j };
        });
      })
      .then(function (o) {
        if (!o.res.ok || !o.j || !o.j.ok || !Array.isArray(o.j.members)) return false;
        state.teamMembers = o.j.members
          .map(mapApiMemberToState)
          .filter(function (m) {
            return m != null;
          });
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  /** Build user-visible message from Events API JSON (includes MySQL hint in details.db when present). */
  function formatRpbddApiError(j, fallback) {
    var msg = fallback || 'Request failed';
    if (j && typeof j === 'object' && j.error) msg = String(j.error);
    if (!j || typeof j !== 'object' || !j.details) return msg;
    var d = j.details;
    if (typeof d === 'string' && d.trim()) return msg + '\n' + d.trim();
    if (d.db && String(d.db).trim()) return msg + '\n' + String(d.db).trim();
    if (d.validation && typeof d.validation === 'object') {
      var parts = [];
      for (var k in d.validation) {
        if (d.validation[k]) parts.push(String(d.validation[k]));
      }
      if (parts.length) return msg + '\n' + parts.join(' ');
    }
    return msg;
  }

  /** Stable DB row id for add_new_event (UUID string). Never use parseInt on UUIDs. */
  function canonicalEventDbId(v) {
    if (v == null || v === '') return '';
    return String(v);
  }

  function eventRowPrimaryKey(row) {
    if (!row) return '';
    var raw = row.event_id != null && row.event_id !== '' ? row.event_id : row.id;
    return raw != null && raw !== '' ? String(raw) : '';
  }

  function expandDbRow(row) {
    var dbId = eventRowPrimaryKey(row);
    if (!dbId) return [];
    var dates = row.dates;
    if (!dates && row.dates_json) {
      try {
        dates = JSON.parse(row.dates_json);
      } catch (e) {
        dates = [];
      }
    }
    if ((!dates || dates.length === 0) && row.Dates) {
      try {
        var rawD = row.Dates;
        dates = typeof rawD === 'string' ? JSON.parse(rawD) : rawD;
      } catch (e) {
        dates = [];
      }
    }
    if (!Array.isArray(dates)) dates = [];
    return dates.map(function (date) {
      return {
        id: 'db-' + dbId + '-' + date,
        dbId: dbId,
        title: row.title,
        date: date,
        time: row.time_display || '',
        rawTime: row.time_raw || '',
        category: row.category || '',
        status: row.status || 'upcoming',
        description: row.description || '',
        location: row.location || '',
        createdBy: row.input_by || '',
        fromDb: true,
      };
    });
  }

  function parseEventsApiResponse(res) {
    return res.text().then(function (text) {
      var data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = null;
      }
      return { okHttp: res.ok, status: res.status, data: data, raw: text };
    });
  }

  function formatEventsApiError(parsed) {
    var j = parsed.data;
    if (j && j.error) return String(j.error);
    if (j && j.message) return String(j.message);
    if (parsed.raw && parsed.raw.length < 400) return parsed.raw.trim().slice(0, 400);
    if (parsed.status === 401) return 'Session expired — please sign in again.';
    if (parsed.status === 404) {
      return 'Events API not found. If you use XAMPP without mod_rewrite, the app URL must include index.php (already set in config).';
    }
    return 'Server error (HTTP ' + parsed.status + ')';
  }

  /** Read date values from the Add Event modal (avoids stale state if change event did not fire). */
  function collectAddEventDatesFromDom() {
    var wrap = document.getElementById('rpbdd-date-rows');
    if (!wrap) return [];
    return Array.prototype.slice
      .call(wrap.querySelectorAll('input[type="date"]'))
      .map(function (inp) {
        return inp.value || '';
      })
      .filter(Boolean);
  }

  function collectEditEventDatesFromDom() {
    var wrap = document.getElementById('rpbdd-edit-date-rows');
    if (!wrap) return [];
    return Array.prototype.slice
      .call(wrap.querySelectorAll('input[type="date"]'))
      .map(function (inp) {
        return inp.value || '';
      })
      .filter(Boolean);
  }

  /** Sorted unique YYYY-MM-DD for API / local save from raw date strings. */
  function normalizeDedupeSortDatesArray(raw) {
    var seen = {};
    (raw || []).forEach(function (x) {
      var d = normalizeEventDateYmd(x);
      if (d) seen[d] = true;
    });
    return Object.keys(seen).sort();
  }

  /** Initial rows when opening Edit Event: all dates on the same DB row; locally, all dates with same title+location. */
  function collectInitialEditEventDates(userEv) {
    var out = [];
    var seen = {};
    if (userEv && userEv.dbId) {
      var targetDb = canonicalEventDbId(userEv.dbId);
      state.events.forEach(function (x) {
        if (canonicalEventDbId(x.dbId) !== targetDb || x.isHoliday) return;
        var d = normalizeEventDateYmd(x.date);
        if (d && !seen[d]) {
          seen[d] = true;
          out.push(d);
        }
      });
      out.sort();
    } else if (userEv && !userEv.isHoliday) {
      var gk = eventGroupKey(userEv);
      state.events.forEach(function (x) {
        if (x.isHoliday || eventGroupKey(x) !== gk) return;
        var d = normalizeEventDateYmd(x.date);
        if (d && !seen[d]) {
          seen[d] = true;
          out.push(d);
        }
      });
      out.sort();
    }
    if (out.length === 0 && userEv) {
      var one = normalizeEventDateYmd(userEv.date);
      out = one ? [one] : [''];
    }
    if (out.length === 0) out = [''];
    return out;
  }

  function refreshEventsFromApi() {
    var base = getEventsApiBase();
    if (!base) {
      return Promise.resolve();
    }
    return fetch(base, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        if (parsed.status === 401) {
          stopEventsApiBackgroundPoll();
          return;
        }
        var j = parsed.data;
        if (!j || !j.ok || !Array.isArray(j.data)) return;
        var expanded = [];
        j.data.forEach(function (row) {
          expanded = expanded.concat(expandDbRow(row));
        });
        var legacy = getEventsApiBase()
          ? []
          : state.events.filter(function (e) {
          return !e.fromDb && !e.isHoliday;
        });
        state.events = expanded.concat(legacy);
        syncPastUserEventsToDone();
        render();
      })
      .catch(function () {});
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function holidayRefLink(url, label) {
    if (!url || typeof url !== 'string') return '';
    var u = url.trim();
    if (u.indexOf('http://') !== 0 && u.indexOf('https://') !== 0) return '';
    return (
      '<a href="' +
      escapeHtml(u) +
      '" class="rpbdd-holiday-ref" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(label || 'Source') +
      '</a>'
    );
  }

  function daysInMonth(d) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }

  function firstDayOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function ymd(year, month, day) {
    return year + '-' + pad2(month + 1) + '-' + pad2(day);
  }

  /** R.A. No. 9492-style “Monday nearest” anchor date (same calendar year). */
  function mondayNearestAnchorParts(year, anchorMonth0, anchorDay) {
    var refMid = new Date(year, anchorMonth0, anchorDay);
    var best = null;
    var bestDiff = Infinity;
    var scan = new Date(year, anchorMonth0, anchorDay - 14);
    var end = new Date(year, anchorMonth0, anchorDay + 14);
    while (scan <= end) {
      if (scan.getDay() === 1) {
        var diff = Math.abs((scan.getTime() - refMid.getTime()) / 86400000);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = new Date(scan);
        }
      }
      scan.setDate(scan.getDate() + 1);
    }
    if (!best) return { month: anchorMonth0, date: anchorDay };
    return { month: best.getMonth(), date: best.getDate() };
  }

  function bonifacioHolidayRecord(year) {
    var parts = mondayNearestAnchorParts(year, 10, 30);
    return Object.assign({}, HOLIDAY_BONIFACIO_META, {
      month: parts.month,
      date: parts.date,
    });
  }

  function getPhilippineHolidayRecord(year, month0, day) {
    var sh = allPhilippineHolidays.find(function (h) {
      return h.month === month0 && h.date === day;
    });
    if (sh) return sh;
    var bon = bonifacioHolidayRecord(year);
    if (bon.month === month0 && bon.date === day) return bon;
    return null;
  }

  /** Static rows in `allPhilippineHolidays` plus Bonifacio (R.A. 9492 Monday-nearest rule) when it falls in this month/year. */
  function philippineObservedHolidaysInMonth(year, month0) {
    var list = allPhilippineHolidays.filter(function (h) {
      return h.month === month0;
    });
    var bon = bonifacioHolidayRecord(year);
    if (bon.month === month0) {
      list = list.concat([bon]);
    }
    return list;
  }

  function getFixedPhilippineHoliday(day) {
    var y = state.currentDate.getFullYear();
    var m = state.currentDate.getMonth();
    return getPhilippineHolidayRecord(y, m, day);
  }

  function getMuslimPhilippineHoliday(day) {
    var y = state.currentDate.getFullYear();
    var m = state.currentDate.getMonth();
    var rows = PH_MUSLIM_HOLIDAYS_BY_YEAR[y];
    if (!rows || !rows.length) return null;
    return rows.find(function (h) {
      return h.month === m && h.date === day;
    }) || null;
  }

  function getChineseNewYearRowForYmd(y, month0, dayNum) {
    var row = PH_CHINESE_NEW_YEAR_BY_YEAR[y];
    if (!row || row.month !== month0 || row.date !== dayNum) return null;
    return row;
  }

  function getChineseNewYearPhilippineHoliday(day) {
    var y = state.currentDate.getFullYear();
    var m = state.currentDate.getMonth();
    return getChineseNewYearRowForYmd(y, m, day);
  }

  /** Calendar / sidebar: fixed PH holidays, Muslim dates, Chinese New Year (proclaimed civil date). */
  function getHoliday(day) {
    return (
      getFixedPhilippineHoliday(day) ||
      getMuslimPhilippineHoliday(day) ||
      getChineseNewYearPhilippineHoliday(day)
    );
  }

  function isToday(day) {
    var t = new Date();
    return (
      day === t.getDate() &&
      state.currentDate.getMonth() === t.getMonth() &&
      state.currentDate.getFullYear() === t.getFullYear()
    );
  }

  /** Legacy bug: parseInt(uuid) produced small integers — not a stable row id. */
  function isWeakCalendarRowId(s) {
    var t = String(s || '').trim();
    if (!t) return true;
    if (/^\d{1,15}$/.test(t)) return true;
    return false;
  }

  /** Row id embedded in expandDbRow client id: "db-{rowId}-{YYYY-MM-DD}". */
  function rowIdFromExpandDbSyntheticId(ev) {
    var sid = String((ev && ev.id) || '');
    var dateY = normalizeEventDateYmd(ev.date);
    if (sid.indexOf('db-') !== 0 || !dateY) return '';
    var suf = '-' + dateY;
    if (sid.length <= 3 + suf.length) return '';
    if (sid.slice(-suf.length) !== suf) return '';
    return sid.slice(3, sid.length - suf.length);
  }

  function strictCalendarRowId(ev) {
    var fromSyn = rowIdFromExpandDbSyntheticId(ev);
    if (fromSyn && !isWeakCalendarRowId(fromSyn)) return fromSyn;
    var dk = canonicalEventDbId(ev.dbId);
    if (dk && !isWeakCalendarRowId(dk)) return dk;
    return '';
  }

  /** Collapse stale duplicate rows (weak id) vs canonical row for same fromDb event. */
  function calendarLooseMergeKeyForDbEvent(ev) {
    if (!ev || !ev.fromDb) return '';
    var desc = String(ev.description || '').trim().slice(0, 80);
    return (
      normalizeEventDateYmd(ev.date) +
      '\x1e' +
      String(ev.title || '').trim().toLowerCase() +
      '\x1e' +
      String(ev.rawTime || '') +
      '\x1e' +
      canonicalCategoryKey(ev.category || '') +
      '\x1e' +
      desc
    );
  }

  function calendarEventIdentityScore(ev) {
    var s = 0;
    var rid = strictCalendarRowId(ev);
    if (rid) {
      s += 400;
      if (rid.indexOf('-') !== -1 && rid.length >= 30) s += 200;
    }
    if (ev && ev.fromDb) s += 50;
    s += Math.min(120, String((ev && ev.id) || '').length);
    return s;
  }

  /** One chip per logical event per day (UUID row id); fixes mixed weak/strong dbId duplicates. */
  function dedupeCalendarDayEventChips(evs) {
    var list = (evs || []).filter(function (e) {
      return e && !e.isHoliday;
    });
    var byRow = {};
    var weakByLoose = {};
    list.forEach(function (ev) {
      var rid = strictCalendarRowId(ev);
      if (rid) {
        if (!byRow[rid] || calendarEventIdentityScore(ev) > calendarEventIdentityScore(byRow[rid])) {
          byRow[rid] = ev;
        }
        return;
      }
      var lk = ev.fromDb ? calendarLooseMergeKeyForDbEvent(ev) : '';
      if (lk) {
        if (!weakByLoose[lk] || calendarEventIdentityScore(ev) > calendarEventIdentityScore(weakByLoose[lk])) {
          weakByLoose[lk] = ev;
        }
        return;
      }
      var fallback = 'id:' + String(ev.id != null ? ev.id : '') + ':' + String(ev.title || '');
      if (!byRow[fallback] || calendarEventIdentityScore(ev) > calendarEventIdentityScore(byRow[fallback])) {
        byRow[fallback] = ev;
      }
    });
    var looseCovered = {};
    Object.keys(byRow).forEach(function (k) {
      var cov = calendarLooseMergeKeyForDbEvent(byRow[k]);
      if (cov) looseCovered[cov] = true;
    });
    var out = [];
    Object.keys(byRow).forEach(function (k) {
      out.push(byRow[k]);
    });
    Object.keys(weakByLoose).forEach(function (lk) {
      if (!lk || looseCovered[lk]) return;
      out.push(weakByLoose[lk]);
    });
    return out;
  }

  /** One calendar chip per day per title (case-insensitive); hides duplicate rows with the same title. */
  function dedupeCalendarDayEventsByTitle(evs) {
    var list = (evs || []).filter(function (e) {
      return e && !e.isHoliday;
    });
    var byTitle = {};
    list.forEach(function (ev) {
      var tk = String(ev.title || '').trim().toLowerCase();
      if (!tk) tk = '__empty_title__';
      if (!byTitle[tk] || calendarEventIdentityScore(ev) > calendarEventIdentityScore(byTitle[tk])) {
        byTitle[tk] = ev;
      }
    });
    var out = [];
    Object.keys(byTitle).forEach(function (k) {
      out.push(byTitle[k]);
    });
    return out;
  }

  function rawUserEventsMatchingCalendarDay(day) {
    var ds = ymd(state.currentDate.getFullYear(), state.currentDate.getMonth(), day);
    return state.events.filter(function (e) {
      if (e.isHoliday) return false;
      return normalizeEventDateYmd(e.date) === ds;
    });
  }

  function birthdayEntriesMatchingCalendarDay(day) {
    var month = state.currentDate.getMonth() + 1;
    var yVis = state.currentDate.getFullYear();
    var t = todayYmd();
    var out = [];
    (state.birthdayCelebrants || []).forEach(function (b) {
      var dob = normalizeBirthdayYmd(b && b.dob);
      if (!dob) return;
      var p = dob.split('-');
      if (p.length !== 3) return;
      var bm = parseInt(p[1], 10);
      var bd = parseInt(p[2], 10);
      if (bm !== month || bd !== day) return;
      var occ = new Date(yVis, bm - 1, bd);
      if (occ.getMonth() !== month - 1) return;
      var ds = ymd(occ.getFullYear(), occ.getMonth(), occ.getDate());
      out.push({
        id: 'bcal-' + String((b && b.id) || ''),
        title: String((b && b.name) || 'Birthday Celebrant'),
        category: 'Birthday',
        status: ds < t ? 'done' : 'upcoming',
        isBirthday: true,
        birthdayId: String((b && b.id) || ''),
      });
    });
    return out;
  }

  function getEventsForDate(day) {
    var base = dedupeCalendarDayEventsByTitle(
      dedupeCalendarDayEventChips(rawUserEventsMatchingCalendarDay(day))
    );
    return base.concat(birthdayEntriesMatchingCalendarDay(day));
  }

  /** Normalize legacy DB/UI label so colors match calendar legends. */
  function canonicalCategoryKey(name) {
    var s = String(name || '').trim();
    if (s === 'PBD') return 'RPBDD';
    return s;
  }

  function categoryExists(name) {
    var key = canonicalCategoryKey(name);
    if (!key) return false;
    return eventCategories.some(function (x) {
      return x && x.name === key;
    });
  }

  function mirrorEventCategoriesToLocalStorage() {
    try {
      localStorage.setItem(LS_EVENT_CATEGORIES, JSON.stringify(eventCategories || []));
    } catch (e) {
      /* ignore */
    }
  }

  /** Shared Supabase `event_categories` is empty — clear UI + this browser’s caches; do not re-upload old localStorage. */
  function applySharedServerEmptyCategories() {
    applyEventCategoriesPayload([]);
    try {
      localStorage.removeItem(LS_REPORT_CATEGORY_DISPLAY);
    } catch (e) {
      /* ignore */
    }
  }

  function hydrateEventCategoriesFromLocalStorageArray(rawCats) {
    if (!Array.isArray(rawCats)) return [];
    return rawCats
      .map(function (c, idx) {
        var name = canonicalCategoryKey(c && c.name);
        if (!name) return null;
        return {
          name: name,
          color: c && c.color ? String(c.color) : EVENT_CATEGORY_PALETTE[idx % EVENT_CATEGORY_PALETTE.length],
          display_name: c && c.display_name != null ? String(c.display_name) : '',
          position: c && c.position != null ? String(c.position) : '',
          photo: c && c.photo != null ? String(c.photo) : '',
        };
      })
      .filter(function (c, idx, arr) {
        if (!c) return false;
        return (
          arr.findIndex(function (x) {
            return x && x.name === c.name;
          }) === idx
        );
      });
  }

  function loadEventCategoriesFromDisk() {
    try {
      var rawCats = JSON.parse(localStorage.getItem(LS_EVENT_CATEGORIES) || '[]');
      return hydrateEventCategoriesFromLocalStorageArray(rawCats);
    } catch (e) {
      return [];
    }
  }

  function saveEventCategories() {
    mirrorEventCategoriesToLocalStorage();
    if (getEventsApiBase()) {
      persistEventCategoriesToApi();
    }
  }

  function persistEventCategoriesToApi() {
    var base = getEventsApiBase();
    if (!base) return Promise.resolve(false);
    return fetch(base + '/categories', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: (eventCategories || [])
          .map(function (c) {
            var name = canonicalCategoryKey(c && c.name);
            if (!name) return null;
            var ph = c && c.photo != null ? String(c.photo).trim() : '';
            return {
              name: name,
              color: String((c && c.color) || '#3B82F6'),
              display_name: String((c && c.display_name) != null ? c.display_name : '').trim(),
              position: String((c && c.position) != null ? c.position : '').trim(),
              photo: ph !== '' ? ph : null,
            };
          })
          .filter(Boolean),
      }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { httpOk: r.ok, j: j };
        });
      })
      .then(function (o) {
        var j = o.j;
        if (!o.httpOk || !j || !j.ok) {
          rpbddAlertMessage(
            formatRpbddApiError(
              j,
              'Could not save categories to the server — other browsers will not see them. Ensure the Supabase table public.event_categories exists (run supabase-schema.sql or migrations) and try again.',
            ),
          );
          return false;
        }
        broadcastEventsChanged();
        refreshEventCategoriesFromApi().catch(function () {});
        return true;
      })
      .catch(function () {
        rpbddAlertMessage(
          'Network error while saving categories. They remain on this browser only until the server accepts the save.',
        );
        return false;
      });
  }

  function applyEventCategoriesPayload(rows) {
    eventCategories = (rows || [])
      .map(function (r) {
        var name = canonicalCategoryKey(r && r.name);
        if (!name) return null;
        var color = String((r && r.color) || '#3B82F6').trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = '#3B82F6';
        var ph = r && r.photo != null ? String(r.photo).trim() : '';
        return {
          name: name,
          color: color,
          display_name: String((r && r.display_name) != null ? r.display_name : '').trim(),
          position: String((r && r.position) != null ? r.position : '').trim(),
          photo: ph,
        };
      })
      .filter(Boolean);
    mirrorEventCategoriesToLocalStorage();
  }

  function folderDisplayNonEmptyFromCategory(c) {
    if (!c) return false;
    if (String(c.display_name || '').trim()) return true;
    if (String(c.position || '').trim()) return true;
    if (String(c.photo || '').trim()) return true;
    return false;
  }

  /** One-time push: this browser had folder photos only in localStorage; server rows have empty display. */
  function maybeMergeLocalFolderDisplayIntoCategoriesThenPersist() {
    if (!getEventsApiBase()) return Promise.resolve(false);
    var map = loadReportCategoryDisplayMap();
    var changed = false;
    for (var i = 0; i < eventCategories.length; i++) {
      var c = eventCategories[i];
      if (!c || !c.name) continue;
      if (folderDisplayNonEmptyFromCategory(c)) continue;
      var ck = canonicalCategoryKey(c.name);
      var rec = map[ck];
      if (!rec || typeof rec !== 'object') continue;
      var dn = String(rec.name != null ? rec.name : '').trim();
      var pos = String(rec.position != null ? rec.position : '').trim();
      var ph = String(rec.photo != null ? rec.photo : '').trim();
      if (!dn && !pos && !ph) continue;
      eventCategories[i] = {
        name: c.name,
        color: c.color,
        display_name: dn,
        position: pos,
        photo: ph,
      };
      changed = true;
    }
    if (!changed) return Promise.resolve(false);
    mirrorEventCategoriesToLocalStorage();
    return persistEventCategoriesToApi().then(function () {
      return true;
    });
  }

  function syncCategoryUiAfterRemoteLoad() {
    var addSel = document.getElementById('add-category');
    var editSel = document.getElementById('edit-category');
    var prevAdd = addSel ? canonicalCategoryKey(addSel.value) : '';
    var prevEdit = editSel ? canonicalCategoryKey(editSel.value) : '';
    renderCategoryDropdowns(
      categoryExists(prevAdd) ? prevAdd : '',
      categoryExists(prevEdit) ? prevEdit : ''
    );
    renderCategoryLegend();
    render();
    if (state.activeNav === 'reports') renderReportsPanel();
  }

  function refreshEventCategoriesFromApi() {
    var base = getEventsApiBase();
    if (!base) return Promise.resolve();
    return fetch(base + '/categories', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        if (!j || !j.ok || !Array.isArray(j.data)) {
          if (!window.__rpbddCategoriesFetchWarned) {
            window.__rpbddCategoriesFetchWarned = true;
            try {
              console.warn(
                '[RPBDD] Categories GET failed; using this browser’s saved legend if any.',
                formatEventsApiError(parsed),
              );
            } catch (eLog) {
              /* ignore */
            }
          }
          syncCategoryUiAfterRemoteLoad();
          return;
        }
        if (j.data.length === 0) {
          applySharedServerEmptyCategories();
          syncCategoryUiAfterRemoteLoad();
          return;
        }
        applyEventCategoriesPayload(j.data);
        return maybeMergeLocalFolderDisplayIntoCategoriesThenPersist().then(function () {
          syncCategoryUiAfterRemoteLoad();
        });
      })
      .catch(function () {
        if (!window.__rpbddCategoriesFetchWarned) {
          window.__rpbddCategoriesFetchWarned = true;
          try {
            console.warn(
              '[RPBDD] Categories API unreachable; showing categories from this browser only until the connection works.',
            );
          } catch (eLog) {
            /* ignore */
          }
        }
        syncCategoryUiAfterRemoteLoad();
      });
  }

  function nextCategoryColor() {
    return suggestAvailableCategoryColor();
  }

  function addCategory(name, color) {
    var key = canonicalCategoryKey(name);
    if (!key || categoryExists(key)) return false;
    eventCategories.push({
      name: key,
      color: color || nextCategoryColor(),
      display_name: '',
      position: '',
      photo: '',
    });
    saveEventCategories();
    return true;
  }

  function isCategoryColorUsed(color) {
    var target = String(color || '').trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(target)) return false;
    return eventCategories.some(function (c) {
      return String((c && c.color) || '').trim().toLowerCase() === target;
    });
  }

  function categoryNameByColor(color, excludeName) {
    var target = String(color || '').trim().toLowerCase();
    var excluded = canonicalCategoryKey(excludeName);
    if (!/^#[0-9a-f]{6}$/.test(target)) return '';
    var row = eventCategories.find(function (c) {
      if (!c || !c.name) return false;
      if (excluded && c.name === excluded) return false;
      return String((c.color || '')).trim().toLowerCase() === target;
    });
    return row ? row.name : '';
  }

  function colorDisplayLabel(color) {
    var hex = String(color || '').trim().toUpperCase();
    return COLOR_NAME_BY_HEX[hex] || 'Custom Color';
  }

  function suggestAvailableCategoryColor() {
    for (var i = 0; i < EVENT_CATEGORY_PALETTE.length; i++) {
      if (!isCategoryColorUsed(EVENT_CATEGORY_PALETTE[i])) return EVENT_CATEGORY_PALETTE[i];
    }
    for (var t = 0; t < 24; t++) {
      var rand = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase();
      if (!isCategoryColorUsed(rand)) return rand;
    }
    return '#3B82F6';
  }

  function removeCategory(name) {
    var key = canonicalCategoryKey(name);
    if (!key) return;
    eventCategories = eventCategories.filter(function (c) {
      return c && c.name !== key;
    });
    saveEventCategories();
  }

  function confirmRemoveCategory(categoryName) {
    var key = canonicalCategoryKey(categoryName);
    if (!key) return;
    openRpbddConfirm({
      variant: 'remove',
      title: 'Remove category?',
      message: '“' + key + '” will be removed from dropdown and legends.',
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      danger: true,
    }).then(function (ok) {
      if (!ok) return;
      removeCategory(key);
      renderCategoryDropdowns('', '');
      renderCategoryLegend();
      if (state.activeNav === 'reports') renderReportsPanel();
    });
  }

  function updateCategoryColor(name, color) {
    var key = canonicalCategoryKey(name);
    if (!key) return false;
    var col = String(color || '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(col)) return false;
    var hit = false;
    eventCategories = eventCategories.map(function (c) {
      if (!c || c.name !== key) return c;
      hit = true;
      return {
        name: c.name,
        color: col,
        display_name: c.display_name != null ? String(c.display_name) : '',
        position: c.position != null ? String(c.position) : '',
        photo: c.photo != null ? String(c.photo) : '',
      };
    });
    if (hit) saveEventCategories();
    return hit;
  }

  /** Legend, dropdowns, manager: CRFPSP → EDES → M&E → SIB first (any case), then A–Z. */
  var LEGEND_CATEGORY_PRIORITY = ['CRFPSP', 'EDES', 'M&E', 'SIB'];

  function legendPriorityRank(categoryName) {
    var target = String(canonicalCategoryKey(categoryName) || '')
      .trim()
      .toLowerCase();
    for (var i = 0; i < LEGEND_CATEGORY_PRIORITY.length; i++) {
      var p = String(canonicalCategoryKey(LEGEND_CATEGORY_PRIORITY[i]) || '')
        .trim()
        .toLowerCase();
      if (p === target) return i;
    }
    return -1;
  }

  function sortEventCategoriesDisplayOrder(list) {
    var filtered = (list || []).filter(function (cat) {
      return cat && cat.name;
    });
    var priority = [];
    var rest = [];
    filtered.forEach(function (cat) {
      var r = legendPriorityRank(cat.name);
      if (r >= 0) priority.push({ cat: cat, r: r });
      else rest.push(cat);
    });
    priority.sort(function (a, b) {
      return a.r - b.r;
    });
    rest.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
    });
    return priority.map(function (x) {
      return x.cat;
    }).concat(rest);
  }

  function renderCategoryLegend() {
    var wrap = document.getElementById('rpbdd-category-legend');
    if (!wrap) return;
    wrap.innerHTML = '';
    var sorted = sortEventCategoriesDisplayOrder(eventCategories);
    sorted.forEach(function (cat) {
      var item = document.createElement('div');
      item.className = 'rpbdd-legend-item';
      var dot = document.createElement('span');
      dot.className = 'rpbdd-legend-dot';
      dot.style.background = cat.color || '#9CA3AF';
      var text = document.createTextNode(' ' + cat.name);
      item.appendChild(dot);
      item.appendChild(text);
      wrap.appendChild(item);
    });
  }

  function renderCategoryDropdowns(selectedAdd, selectedEdit) {
    var addSelect = document.getElementById('add-category');
    var editSelect = document.getElementById('edit-category');
    if (!addSelect || !editSelect) return;
    var addSelected = canonicalCategoryKey(selectedAdd || addSelect.value);
    var editSelected = canonicalCategoryKey(selectedEdit || editSelect.value);
    addSelect.innerHTML = '<option value="">Select category</option>';
    editSelect.innerHTML = '<option value="">Select category</option>';
    sortEventCategoriesDisplayOrder(eventCategories).forEach(function (cat) {
      if (!cat || !cat.name) return;
      var addOpt = document.createElement('option');
      addOpt.value = cat.name;
      addOpt.textContent = cat.name;
      if (cat.name === addSelected) addOpt.selected = true;
      addSelect.appendChild(addOpt);
      var editOpt = document.createElement('option');
      editOpt.value = cat.name;
      editOpt.textContent = cat.name;
      if (cat.name === editSelected) editOpt.selected = true;
      editSelect.appendChild(editOpt);
    });
    if (editSelected && !categoryExists(editSelected)) {
      var fallback = document.createElement('option');
      fallback.value = editSelected;
      fallback.textContent = editSelected;
      fallback.selected = true;
      editSelect.appendChild(fallback);
    }
    addSelect.dataset.lastCategory = addSelected || '';
    setAddCategoryValue(addSelected || '');
    editSelect.dataset.lastCategory = editSelected || '';
    setEditCategoryValue(editSelected || '');
    renderCategoryManagerList();
    renderEditCategoryManagerList();
  }

  function updateAddCategoryTriggerLabel() {
    var addSelect = document.getElementById('add-category');
    var labelEl = document.getElementById('rpbdd-category-dropdown-label');
    if (!addSelect || !labelEl) return;
    var key = canonicalCategoryKey(addSelect.value);
    labelEl.textContent = key || 'Select category';
  }

  function setAddCategoryValue(value) {
    var addSelect = document.getElementById('add-category');
    if (!addSelect) return;
    addSelect.value = canonicalCategoryKey(value) || '';
    addSelect.dataset.lastCategory = addSelect.value || '';
    updateAddCategoryTriggerLabel();
  }

  function updateEditCategoryTriggerLabel() {
    var editSelect = document.getElementById('edit-category');
    var labelEl = document.getElementById('rpbdd-edit-category-dropdown-label');
    if (!editSelect || !labelEl) return;
    var key = canonicalCategoryKey(editSelect.value);
    labelEl.textContent = key || 'Select category';
  }

  function setEditCategoryValue(value) {
    var editSelect = document.getElementById('edit-category');
    if (!editSelect) return;
    editSelect.value = canonicalCategoryKey(value) || '';
    editSelect.dataset.lastCategory = editSelect.value || '';
    updateEditCategoryTriggerLabel();
  }

  function toggleAddCategoryDropdown(forceOpen) {
    var menu = document.getElementById('rpbdd-category-dropdown-menu');
    if (!menu) return;
    var open = typeof forceOpen === 'boolean' ? forceOpen : menu.style.display === 'none';
    menu.style.display = open ? 'block' : 'none';
  }

  function toggleEditCategoryDropdown(forceOpen) {
    var menu = document.getElementById('rpbdd-edit-category-dropdown-menu');
    if (!menu) return;
    var open = typeof forceOpen === 'boolean' ? forceOpen : menu.style.display === 'none';
    menu.style.display = open ? 'block' : 'none';
  }

  function renderCategoryManagerList() {
    var wrap = document.getElementById('rpbdd-category-manage-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    sortEventCategoriesDisplayOrder(eventCategories).forEach(function (cat) {
      if (!cat || !cat.name) return;
      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '0.45rem';
      row.style.padding = '0.2rem 0.38rem';
      row.style.border = '1px solid var(--rp-border)';
      row.style.borderRadius = '0.45rem';
      row.style.minHeight = '1.8rem';
      var left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '0.4rem';
      left.style.minWidth = '0';
      var dot = document.createElement('span');
      dot.style.width = '0.75rem';
      dot.style.height = '0.75rem';
      dot.style.borderRadius = '999px';
      dot.style.background = cat.color || '#9CA3AF';
      var text = document.createElement('span');
      text.textContent = cat.name + ' (' + colorDisplayLabel(cat.color) + ')';
      text.style.fontSize = '0.7rem';
      text.style.color = 'var(--rp-text)';
      left.style.cursor = 'pointer';
      left.addEventListener('click', function () {
        setAddCategoryValue(cat.name);
        toggleAddCategoryDropdown(false);
      });
      left.appendChild(dot);
      left.appendChild(text);
      var right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '0.35rem';
      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'rpbdd-btn-sm rpbdd-btn-action--edit rpbdd-btn-sm--dense';
      editBtn.innerHTML = '✎ Edit';
      editBtn.style.fontSize = '0.64rem';
      editBtn.style.padding = '0.1rem 0.35rem';
      editBtn.title = 'Edit ' + cat.name;
      editBtn.addEventListener('click', function () {
        var addSelect = document.getElementById('add-category');
        openCategoryEditor('edit', addSelect || null, cat.name);
      });
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'rpbdd-btn-sm rpbdd-btn-action--delete rpbdd-btn-sm--dense';
      removeBtn.style.fontSize = '0.64rem';
      removeBtn.style.padding = '0.1rem 0.35rem';
      removeBtn.innerHTML = '🗑 Remove';
      removeBtn.title = 'Remove ' + cat.name;
      removeBtn.addEventListener('click', function () {
        confirmRemoveCategory(cat.name);
      });
      right.appendChild(editBtn);
      right.appendChild(removeBtn);
      row.appendChild(left);
      row.appendChild(right);
      wrap.appendChild(row);
    });
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'rpbdd-btn-sm rpbdd-btn-sm--green rpbdd-btn-sm--dense';
    addBtn.textContent = '+ Add category';
    addBtn.addEventListener('click', function () {
      var addSelect = document.getElementById('add-category');
      openCategoryEditor('add', addSelect || null, '');
    });
    wrap.appendChild(addBtn);
  }

  function renderEditCategoryManagerList() {
    var wrap = document.getElementById('rpbdd-edit-category-manage-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    sortEventCategoriesDisplayOrder(eventCategories).forEach(function (cat) {
      if (!cat || !cat.name) return;
      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '0.45rem';
      row.style.padding = '0.2rem 0.38rem';
      row.style.border = '1px solid var(--rp-border)';
      row.style.borderRadius = '0.45rem';
      row.style.minHeight = '1.8rem';
      var left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '0.4rem';
      left.style.minWidth = '0';
      var dot = document.createElement('span');
      dot.style.width = '0.75rem';
      dot.style.height = '0.75rem';
      dot.style.borderRadius = '999px';
      dot.style.background = cat.color || '#9CA3AF';
      var text = document.createElement('span');
      text.textContent = cat.name + ' (' + colorDisplayLabel(cat.color) + ')';
      text.style.fontSize = '0.7rem';
      text.style.color = 'var(--rp-text)';
      left.style.cursor = 'pointer';
      left.addEventListener('click', function () {
        setEditCategoryValue(cat.name);
        toggleEditCategoryDropdown(false);
      });
      left.appendChild(dot);
      left.appendChild(text);
      var right = document.createElement('div');
      right.style.display = 'flex';
      right.style.gap = '0.35rem';
      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'rpbdd-btn-sm rpbdd-btn-action--edit rpbdd-btn-sm--dense';
      editBtn.innerHTML = '✎ Edit';
      editBtn.style.fontSize = '0.64rem';
      editBtn.style.padding = '0.1rem 0.35rem';
      editBtn.title = 'Edit ' + cat.name;
      editBtn.addEventListener('click', function () {
        var editSelect = document.getElementById('edit-category');
        openCategoryEditor('edit', editSelect || null, cat.name);
      });
      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'rpbdd-btn-sm rpbdd-btn-action--delete rpbdd-btn-sm--dense';
      removeBtn.style.fontSize = '0.64rem';
      removeBtn.style.padding = '0.1rem 0.35rem';
      removeBtn.innerHTML = '🗑 Remove';
      removeBtn.title = 'Remove ' + cat.name;
      removeBtn.addEventListener('click', function () {
        confirmRemoveCategory(cat.name);
      });
      right.appendChild(editBtn);
      right.appendChild(removeBtn);
      row.appendChild(left);
      row.appendChild(right);
      wrap.appendChild(row);
    });
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'rpbdd-btn-sm rpbdd-btn-sm--green rpbdd-btn-sm--dense';
    addBtn.textContent = '+ Add category';
    addBtn.addEventListener('click', function () {
      var editSelect = document.getElementById('edit-category');
      openCategoryEditor('add', editSelect || null, '');
    });
    wrap.appendChild(addBtn);
  }

  function renderCategoryEditOptions(selectedName) {
    var sel = document.getElementById('rpbdd-category-edit-select');
    var colorEl = document.getElementById('rpbdd-category-edit-color');
    if (!sel || !colorEl) return;
    var selected = canonicalCategoryKey(selectedName || sel.value);
    sel.innerHTML = '';
    sortEventCategoriesDisplayOrder(eventCategories).forEach(function (cat) {
      if (!cat || !cat.name) return;
      var opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      if (cat.name === selected) opt.selected = true;
      sel.appendChild(opt);
    });
    var active = canonicalCategoryKey(sel.value);
    var row = eventCategories.find(function (c) {
      return c && c.name === active;
    });
    if (row && row.color) colorEl.value = row.color;
  }

  function updateCategoryEditorPreview() {
    var inputEl = document.getElementById('rpbdd-category-editor-input');
    var colorEl = document.getElementById('rpbdd-category-editor-color');
    var dotEl = document.getElementById('rpbdd-category-preview-dot');
    var labelEl = document.getElementById('rpbdd-category-preview-label');
    var badgeEl = document.getElementById('rpbdd-category-preview-badge');
    if (!dotEl || !labelEl || !badgeEl) return;
    var name = canonicalCategoryKey(inputEl && inputEl.value) || 'Category';
    var color = String((colorEl && colorEl.value) || '#3B82F6').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = '#3B82F6';
    dotEl.style.background = color;
    labelEl.textContent = name;
    badgeEl.style.borderColor = color;
    badgeEl.style.color = color;
    badgeEl.style.background = 'color-mix(in srgb, ' + color + ' 14%, transparent)';
  }

  function updateCategoryEditPreview() {
    var saveBtn = document.getElementById('rpbdd-category-editor-save');
    if (!saveBtn || saveBtn.dataset.mode !== 'edit') return;
    var sel = document.getElementById('rpbdd-category-edit-select');
    var colorEl = document.getElementById('rpbdd-category-edit-color');
    var dotEl = document.getElementById('rpbdd-category-preview-dot');
    var labelEl = document.getElementById('rpbdd-category-preview-label');
    var badgeEl = document.getElementById('rpbdd-category-preview-badge');
    if (!sel || !colorEl || !dotEl || !labelEl || !badgeEl) return;
    var name = canonicalCategoryKey(sel.value) || 'Category';
    var color = String((colorEl && colorEl.value) || '#3B82F6').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = '#3B82F6';
    dotEl.style.background = color;
    labelEl.textContent = name;
    badgeEl.style.borderColor = color;
    badgeEl.style.color = color;
    badgeEl.style.background = 'color-mix(in srgb, ' + color + ' 14%, transparent)';
  }

  function renderCategoryColorSwatches() {
    var wrap = document.getElementById('rpbdd-category-color-swatches');
    var colorEl = document.getElementById('rpbdd-category-editor-color');
    if (!wrap || !colorEl) return;
    wrap.innerHTML = '';
    var merged = EVENT_CATEGORY_PALETTE.slice();
    eventCategories.forEach(function (c) {
      var col = String((c && c.color) || '').trim();
      if (/^#[0-9a-fA-F]{6}$/.test(col) && merged.indexOf(col) < 0) merged.push(col);
    });

    var groups = [
      { name: 'Core', colors: ['#FACC15', '#22C55E', '#3B82F6', '#EF4444', '#F97316', '#8B5CF6', '#F8BBD0', '#8D6E63'] },
      { name: 'Warm', colors: ['#EAB308', '#F59E0B', '#FDBA74', '#FB7185', '#FCA5A5'] },
      { name: 'Cool', colors: ['#06B6D4', '#14B8A6', '#0EA5E9', '#38BDF8', '#6366F1'] },
      { name: 'Nature', colors: ['#10B981', '#4ADE80', '#84CC16', '#A3E635'] },
      { name: 'Pastel', colors: ['#F8BBD0', '#FDBA74', '#A78BFA', '#FCA5A5', '#94A3B8'] },
      { name: 'Neutral', colors: ['#8D6E63', '#334155', '#94A3B8'] },
    ];
    var groupedSet = {};
    groups.forEach(function (g) {
      g.colors.forEach(function (c) {
        groupedSet[String(c).toUpperCase()] = true;
      });
    });
    var customColors = merged.filter(function (c) {
      return !groupedSet[String(c).toUpperCase()];
    });
    if (customColors.length) groups.push({ name: 'Custom', colors: customColors });

    function appendColorButton(color, container) {
      var used = isCategoryColorUsed(color);
      var owner = categoryNameByColor(color, '');
      var label = colorDisplayLabel(color);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', (used ? label + ' already used by ' + owner : 'Use ' + label) + ' (' + color + ')');
      btn.title = used ? label + ' (' + color + ') used by ' + owner : label + ' (' + color + ')';
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '0.32rem';
      btn.style.minHeight = '1.55rem';
      btn.style.padding = '0.14rem 0.45rem';
      btn.style.borderRadius = '999px';
      btn.style.border = '1px solid color-mix(in srgb, var(--rp-border) 80%, transparent)';
      btn.style.background = 'color-mix(in srgb, ' + color + ' 16%, transparent)';
      btn.style.cursor = used ? 'not-allowed' : 'pointer';
      btn.style.fontSize = '0.68rem';
      btn.style.fontWeight = '600';
      btn.style.color = 'var(--rp-text)';
      if (used) {
        btn.style.opacity = '0.4';
        btn.disabled = true;
      }
      var dot = document.createElement('span');
      dot.style.width = '0.72rem';
      dot.style.height = '0.72rem';
      dot.style.borderRadius = '999px';
      dot.style.background = color;
      dot.style.flexShrink = '0';
      var txt = document.createElement('span');
      txt.textContent = label;
      btn.appendChild(dot);
      btn.appendChild(txt);
      btn.addEventListener('click', function () {
        colorEl.value = color;
        updateCategoryEditorPreview();
      });
      container.appendChild(btn);
    }

    groups.forEach(function (group) {
      var palette = (group.colors || []).filter(function (c, idx, arr) {
        return merged.indexOf(c) >= 0 && arr.indexOf(c) === idx;
      });
      if (!palette.length) return;
      var title = document.createElement('div');
      title.textContent = group.name;
      title.style.width = '100%';
      title.style.fontSize = '0.68rem';
      title.style.fontWeight = '700';
      title.style.color = 'var(--rp-secondary)';
      title.style.marginTop = '0.35rem';
      wrap.appendChild(title);
      var row = document.createElement('div');
      row.style.display = 'flex';
      row.style.flexWrap = 'wrap';
      row.style.gap = '0.35rem';
      row.style.width = '100%';
      palette.forEach(function (color) {
        appendColorButton(color, row);
      });
      wrap.appendChild(row);
    });
  }

  function openCategoryEditor(mode, addSelect, selectedName) {
    var titleEl = document.getElementById('rpbdd-category-editor-title');
    var hintEl = document.getElementById('rpbdd-category-editor-hint');
    var addWrap = document.getElementById('rpbdd-category-editor-add-wrap');
    var editWrap = document.getElementById('rpbdd-category-editor-edit-wrap');
    var inputEl = document.getElementById('rpbdd-category-editor-input');
    var colorEl = document.getElementById('rpbdd-category-editor-color');
    var saveBtn = document.getElementById('rpbdd-category-editor-save');
    if (!titleEl || !hintEl || !addWrap || !editWrap || !saveBtn) return;
    var m = mode === 'edit' ? 'edit' : 'add';
    saveBtn.dataset.mode = m;
    saveBtn.dataset.returnCategory = addSelect && addSelect.dataset ? addSelect.dataset.lastCategory || '' : '';
    if (m === 'add') {
      titleEl.textContent = 'Add Category';
      hintEl.textContent = 'Create a new category for event dropdown and legends.';
      addWrap.hidden = false;
      editWrap.hidden = true;
      if (inputEl) {
        inputEl.value = '';
        if (colorEl) colorEl.value = nextCategoryColor();
        renderCategoryColorSwatches();
        updateCategoryEditorPreview();
        setTimeout(function () {
          try {
            inputEl.focus();
          } catch (e) {
            /* ignore */
          }
        }, 0);
      }
    } else {
      titleEl.textContent = 'Edit Category Color';
      hintEl.textContent = 'Choose a category and assign a new unique color.';
      addWrap.hidden = true;
      editWrap.hidden = false;
      renderCategoryEditOptions(selectedName || (addSelect && addSelect.dataset ? addSelect.dataset.lastCategory : ''));
      updateCategoryEditPreview();
    }
    saveBtn.textContent = 'Save';
    saveBtn.setAttribute('aria-label', m === 'edit' ? 'Save color' : 'Save category');
    saveBtn.classList.remove('rpbdd-btn-sm--danger');
    saveBtn.classList.add('rpbdd-btn-sm--green');
    openModal('modal-category-editor');
  }

  function saveCategoryEditorAction() {
    var saveBtn = document.getElementById('rpbdd-category-editor-save');
    if (!saveBtn) return;
    var mode = saveBtn.dataset.mode || 'add';
    var returnCategory = saveBtn.dataset.returnCategory || '';
    if (mode === 'edit') {
      var editSel = document.getElementById('rpbdd-category-edit-select');
      var editColorEl = document.getElementById('rpbdd-category-edit-color');
      var editName = canonicalCategoryKey(editSel && editSel.value);
      var editColor = String((editColorEl && editColorEl.value) || '').trim();
      if (!editName) {
        rpbddAlertMessage('Select a category to edit');
        return;
      }
      if (!/^#[0-9a-fA-F]{6}$/.test(editColor)) {
        rpbddAlertMessage('Please choose a valid color');
        return;
      }
      var editOwner = categoryNameByColor(editColor, editName);
      if (editOwner) {
        rpbddAlertMessage('That color is already used by "' + editOwner + '". Pick a different one.');
        return;
      }
      if (!updateCategoryColor(editName, editColor)) {
        rpbddAlertMessage('Could not update category color');
        return;
      }
      renderCategoryDropdowns(editName, document.getElementById('edit-category')?.value || '');
      renderCategoryLegend();
      if (state.activeNav === 'reports') renderReportsPanel();
      closeModal('modal-category-editor');
      return;
    }
    var inputEl = document.getElementById('rpbdd-category-editor-input');
    var colorEl = document.getElementById('rpbdd-category-editor-color');
    var raw = canonicalCategoryKey(inputEl && inputEl.value);
    var pickedColor = String((colorEl && colorEl.value) || '').trim();
    if (!raw) {
      rpbddAlertMessage('Please enter a category name');
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(pickedColor)) {
      rpbddAlertMessage('Please choose a valid color');
      return;
    }
    var addOwner = categoryNameByColor(pickedColor, '');
    if (addOwner) {
      rpbddAlertMessage('That color is already used by "' + addOwner + '". Pick a different one.');
      return;
    }
    if (!addCategory(raw, pickedColor)) {
      rpbddAlertMessage('Category already exists');
      return;
    }
    renderCategoryDropdowns(raw);
    renderCategoryLegend();
    if (state.activeNav === 'reports') renderReportsPanel();
    closeModal('modal-category-editor');
    saveBtn.dataset.returnCategory = returnCategory;
  }

  function handleAddCategorySelectChange() {
    updateAddCategoryTriggerLabel();
  }

  function handleEditCategorySelectChange() {
    updateEditCategoryTriggerLabel();
  }

  function categoryColor(name) {
    var key = canonicalCategoryKey(name);
    var c = eventCategories.find(function (x) {
      return x.name === key;
    });
    return c ? c.color : '#9CA3AF';
  }

  function categoryLabelForDisplay(name) {
    var k = canonicalCategoryKey(name);
    return k || '—';
  }

  /** Sidebar / Events this Month: legend colors for events; maroon for PH holidays */
  var HOLIDAY_SIDEBAR_COLOR = '#8b0000';
  /** Philippine national Muslim holidays (Eid'l Fitr / Eid'l Adha) — mint / light green accent */
  var MUSLIM_HOLIDAY_SIDEBAR_COLOR = '#6ee7b7';

  function sidebarItemAccent(item) {
    if (item.isMuslimHoliday) return MUSLIM_HOLIDAY_SIDEBAR_COLOR;
    if (item.isHoliday) return HOLIDAY_SIDEBAR_COLOR;
    return categoryColor(item.category);
  }

  function formatTimeTo12Hour(time) {
    if (!time) return '';
    var p = time.split(':');
    var hour = parseInt(p[0], 10);
    var minutes = p[1] || '00';
    var ampm = hour >= 12 ? 'PM' : 'AM';
    var h = hour % 12 || 12;
    return h + ':' + minutes + ' ' + ampm;
  }

  /**
   * `recycled_at` is stored as Philippines civil clock (Asia/Manila, no timezone in the column).
   * Display: long month date with trailing period + 12-hour time, e.g. "April 13, 2026. 3:45 PM".
   */
  function formatPhilippineRemovedDisplay(mysqlLike) {
    var raw = String(mysqlLike || '').trim();
    if (!raw) return '';
    var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return raw;
    var sec = m[6] != null && m[6] !== '' ? m[6] : '00';
    var iso = m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + sec + '+08:00';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return raw;
    var datePart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
    var timePart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return datePart + '. ' + timePart;
  }

  function profileNotifRecipientsForActorRole(actorRole) {
    if (actorRole === 'member') return ['admin', 'team_leader'];
    if (actorRole === 'team_leader') return ['admin'];
    return [];
  }

  function roleCanSeeProfileNotif(n, role) {
    if (!n || !Array.isArray(n.recipients)) return false;
    if (n.recipients.indexOf(role) >= 0) return true;
    if ((role === 'user' || role === 'member') && n.recipients.indexOf('member') >= 0) return true;
    return false;
  }

  function formatNotificationDateTime(isoLike) {
    var raw = String(isoLike || '').trim();
    if (!raw) return '';
    var d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    var datePart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
    var timePart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return datePart + '. ' + timePart;
  }

  function notificationAccentForRole(actorRole) {
    var r = String(actorRole || '')
      .trim()
      .toLowerCase();
    if (r === 'user') r = 'member';
    if (r === 'admin') return '#8b5cf6';
    if (r === 'team_leader') return '#3b82f6';
    if (r === 'member') return '#10b981';
    return '#64748b';
  }

  function persistProfileNotifications() {
    try {
      var localOnly = (state.notifications || []).filter(function (n) {
        return !n || n.source !== 'server';
      });
      localStorage.setItem(LS_PROFILE_NOTIFS, JSON.stringify(localOnly));
    } catch (e) {
      /* ignore */
    }
  }

  /** Persist celebrants to localStorage whenever they change (cache + offline resilience; API remains authoritative when fetch succeeds). */
  function saveBirthdayCelebrants() {
    if (birthdaysApiBase) return;
    try {
      localStorage.setItem(LS_BIRTHDAY_CELEBRANTS, JSON.stringify(state.birthdayCelebrants || []));
    } catch (e) {
      /* ignore */
    }
  }

  function refreshBirthdaysFromApi() {
    var base = getBirthdaysApiBase();
    if (!base) return Promise.resolve();
    return fetch(base, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        if (!j || !j.ok || !Array.isArray(j.data)) return;
        state.birthdayCelebrants = j.data.map(function (x) {
          return {
            id: String(x.id || ''),
            name: String(x.name || ''),
            position: String(x.position || ''),
            section: String(x.section || ''),
            dob: normalizeBirthdayYmd(x.dob),
            photo: String(x.photo || ''),
            createdAt: x.created_at || x.createdAt || null,
          };
        });
        saveBirthdayCelebrants();
        if (document.getElementById('rpbdd-notifications-list')) renderNotificationsModal();
        render();
      })
      .catch(function () {});
  }

  /** While Birthday Celebrants is open, keep the modal month bar aligned with the main calendar month. */
  function syncBirthdayModalMonthToCalendarIfOpen() {
    var ov = document.getElementById('modal-notifications');
    if (!ov || !ov.classList.contains('is-open')) return;
    var d = state.currentDate;
    state.birthdayModalPanelDate = new Date(d.getFullYear(), d.getMonth(), 1);
    renderNotificationsModal();
  }

  function saveBirthdayDropdowns() {
    try {
      localStorage.setItem(LS_BIRTHDAY_POSITIONS, JSON.stringify(state.birthdayPositions || []));
      localStorage.setItem(LS_BIRTHDAY_SECTIONS, JSON.stringify(state.birthdaySections || []));
    } catch (e) {
      /* ignore */
    }
  }

  function normalizeBirthdayYmd(value) {
    if (value == null || value === '') return '';
    var s = String(value).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return '';
    return m[1] + '-' + m[2] + '-' + m[3];
  }

  /** Gregorian date of Chinese New Year (first day of lunar year) for calendar year Y; 1900–2099. Source: romanization.com / Aslaksen. */
  var CNY_GREGORIAN_ISO_CSV =
    '1900-01-31,1901-02-19,1902-02-08,1903-01-29,1904-02-16,1905-02-04,1906-01-25,1907-02-13,1908-02-02,1909-01-22,1910-02-10,1911-01-30,1912-02-18,1913-02-06,1914-01-26,1915-02-14,1916-02-03,1917-01-23,1918-02-11,1919-02-01,1920-02-20,1921-02-08,1922-01-28,1923-02-16,1924-02-05,1925-01-24,1926-02-13,1927-02-02,1928-01-23,1929-02-10,1930-01-30,1931-02-17,1932-02-06,1933-01-26,1934-02-14,1935-02-04,1936-01-24,1937-02-11,1938-01-31,1939-02-19,1940-02-08,1941-01-27,1942-02-15,1943-02-05,1944-01-25,1945-02-13,1946-02-02,1947-01-22,1948-02-10,1949-01-29,1950-02-17,1951-02-06,1952-01-27,1953-02-14,1954-02-03,1955-01-24,1956-02-12,1957-01-31,1958-02-18,1959-02-08,1960-01-28,1961-02-15,1962-02-05,1963-01-25,1964-02-13,1965-02-02,1966-01-21,1967-02-09,1968-01-30,1969-02-17,1970-02-06,1971-01-27,1972-02-15,1973-02-03,1974-01-23,1975-02-11,1976-01-31,1977-02-18,1978-02-07,1979-01-28,1980-02-16,1981-02-05,1982-01-25,1983-02-13,1984-02-02,1985-02-20,1986-02-09,1987-01-29,1988-02-17,1989-02-06,1990-01-27,1991-02-15,1992-02-04,1993-01-23,1994-02-10,1995-01-31,1996-02-19,1997-02-07,1998-01-28,1999-02-16,2000-02-05,2001-01-24,2002-02-12,2003-02-01,2004-01-22,2005-02-09,2006-01-29,2007-02-18,2008-02-07,2009-01-26,2010-02-14,2011-02-03,2012-01-23,2013-02-10,2014-01-31,2015-02-19,2016-02-08,2017-01-28,2018-02-16,2019-02-05,2020-01-25,2021-02-12,2022-02-01,2023-01-22,2024-02-10,2025-01-29,2026-02-17,2027-02-06,2028-01-26,2029-02-13,2030-02-03,2031-01-23,2032-02-11,2033-01-31,2034-02-19,2035-02-08,2036-01-28,2037-02-15,2038-02-04,2039-01-24,2040-02-12,2041-02-01,2042-01-22,2043-02-10,2044-01-30,2045-02-17,2046-02-06,2047-01-26,2048-02-14,2049-02-02,2050-01-23,2051-02-11,2052-02-01,2053-02-19,2054-02-08,2055-01-28,2056-02-15,2057-02-04,2058-01-24,2059-02-12,2060-02-02,2061-01-21,2062-02-09,2063-01-29,2064-02-17,2065-02-05,2066-01-26,2067-02-14,2068-02-03,2069-01-23,2070-02-11,2071-01-31,2072-02-19,2073-02-07,2074-01-27,2075-02-15,2076-02-05,2077-01-24,2078-02-12,2079-02-02,2080-01-22,2081-02-09,2082-01-29,2083-02-17,2084-02-06,2085-01-26,2086-02-14,2087-02-03,2088-01-24,2089-02-10,2090-01-30,2091-02-18,2092-02-07,2093-01-27,2094-02-15,2095-02-05,2096-01-25,2097-02-12,2098-02-01,2099-01-21';
  var _cnyIsoListCache = null;
  function chineseNewYearIsoForGregorianYear(y) {
    if (_cnyIsoListCache === null) {
      _cnyIsoListCache = CNY_GREGORIAN_ISO_CSV.split(',');
    }
    var i = y - 1900;
    if (i < 0 || i >= _cnyIsoListCache.length) return '';
    return _cnyIsoListCache[i] || '';
  }

  var CHINESE_ZODIAC_ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];

  /** Tropical zodiac from calendar month/day (Gregorian). */
  function westernZodiacSignFromMmDd(mm, dd) {
    if (!mm || !dd) return '';
    var md = mm * 100 + dd;
    if (md >= 1222 || md <= 119) return 'Capricorn';
    if (md >= 120 && md <= 218) return 'Aquarius';
    if (md >= 219 && md <= 320) return 'Pisces';
    if (md >= 321 && md <= 419) return 'Aries';
    if (md >= 420 && md <= 520) return 'Taurus';
    if (md >= 521 && md <= 620) return 'Gemini';
    if (md >= 621 && md <= 722) return 'Cancer';
    if (md >= 723 && md <= 822) return 'Leo';
    if (md >= 823 && md <= 922) return 'Virgo';
    if (md >= 923 && md <= 1022) return 'Libra';
    if (md >= 1023 && md <= 1121) return 'Scorpio';
    if (md >= 1122 && md <= 1221) return 'Sagittarius';
    return '';
  }

  /** Age in full years as of today’s local date (same calendar basis as the rest of the app). */
  function ageCompletedYearsFromDobYmd(dobYmd) {
    var dob = normalizeBirthdayYmd(dobYmd);
    if (!dob) return null;
    var p = dob.split('-');
    var y = parseInt(p[0], 10);
    var m = parseInt(p[1], 10) - 1;
    var d = parseInt(p[2], 10);
    var birthMid = new Date(y, m, d);
    var now = new Date();
    var todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (birthMid > todayMid) return 0;
    var years = todayMid.getFullYear() - birthMid.getFullYear();
    var mo = todayMid.getMonth() - birthMid.getMonth();
    if (mo < 0 || (mo === 0 && todayMid.getDate() < birthMid.getDate())) years--;
    return Math.max(0, years);
  }

  /** Chinese zodiac animal for birth date: lunar year begins at Chinese New Year (table 1900–2099). */
  function chineseZodiacAnimalFromDobYmd(dobYmd) {
    var dob = normalizeBirthdayYmd(dobYmd);
    if (!dob) return '';
    var p = dob.split('-');
    var y = parseInt(p[0], 10);
    var cny = chineseNewYearIsoForGregorianYear(y);
    if (!cny) return '';
    var lunarStartY = dob < cny ? y - 1 : y;
    if (lunarStartY < 1900 || lunarStartY > 2099) return '';
    var idx = ((lunarStartY - 1924) % 12 + 12) % 12;
    return CHINESE_ZODIAC_ANIMALS[idx] || '';
  }

  function birthdayAstroSummaryLines(dobYmd) {
    var dob = normalizeBirthdayYmd(dobYmd);
    if (!dob) return { age: '', ageOnBirthday: '', western: '', chinese: '' };
    var p = dob.split('-');
    var mm = parseInt(p[1], 10);
    var dd = parseInt(p[2], 10);
    var ageN = ageCompletedYearsFromDobYmd(dob);
    var ageCelebr = ageOnNextBirthdayCelebrationYears(dob);
    return {
      age: ageN != null ? String(ageN) : '',
      ageOnBirthday: ageCelebr != null ? String(ageCelebr) : '',
      western: westernZodiacSignFromMmDd(mm, dd),
      chinese: chineseZodiacAnimalFromDobYmd(dob),
    };
  }

  function formatBirthdayLong(ymdDob) {
    var dob = normalizeBirthdayYmd(ymdDob);
    if (!dob) return '—';
    var p = dob.split('-');
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function birthdayNextOccurrenceDate(dobYmd) {
    var dob = normalizeBirthdayYmd(dobYmd);
    if (!dob) return null;
    var p = dob.split('-');
    var mm = parseInt(p[1], 10);
    var dd = parseInt(p[2], 10);
    var now = new Date();
    var todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var target = new Date(now.getFullYear(), mm - 1, dd);
    if (target < todayMid) {
      target = new Date(now.getFullYear() + 1, mm - 1, dd);
    }
    return target;
  }

  function daysUntilBirthday(dobYmd) {
    var target = birthdayNextOccurrenceDate(dobYmd);
    if (!target) return 999999;
    var now = new Date();
    var todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - todayMid.getTime()) / 86400000);
  }

  /** Completed years on a given local calendar day (for “age on birthday” vs today). */
  function ageCompletedYearsOnLocalDate(dobYmd, refDate) {
    var dob = normalizeBirthdayYmd(dobYmd);
    if (!dob || !refDate) return null;
    var p = dob.split('-');
    var by = parseInt(p[0], 10);
    var bm = parseInt(p[1], 10) - 1;
    var bd = parseInt(p[2], 10);
    var birthMid = new Date(by, bm, bd);
    var refMid = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    if (refMid < birthMid) return null;
    var years = refMid.getFullYear() - birthMid.getFullYear();
    var mo = refMid.getMonth() - birthMid.getMonth();
    if (mo < 0 || (mo === 0 && refMid.getDate() < birthMid.getDate())) years--;
    return Math.max(0, years);
  }

  function ageOnNextBirthdayCelebrationYears(dobYmd) {
    var occ = birthdayNextOccurrenceDate(dobYmd);
    if (!occ) return null;
    return ageCompletedYearsOnLocalDate(dobYmd, occ);
  }

  /** Next celebration as YYYY-MM-DD (Gregorian). */
  function nextBirthdayOccurrenceYmd(dobYmd) {
    var occ = birthdayNextOccurrenceDate(dobYmd);
    if (!occ) return '';
    return ymd(occ.getFullYear(), occ.getMonth(), occ.getDate());
  }

  /** Next celebration falls in the month currently shown on the calendar (not next/previous month). */
  function birthdayUpcomingInViewedMonth(entry) {
    var occ = birthdayNextOccurrenceDate(entry && entry.dob);
    if (!occ) return false;
    var cd = state.currentDate;
    return occ.getFullYear() === cd.getFullYear() && occ.getMonth() === cd.getMonth();
  }

  /**
   * YYYY-MM-DD of this birthday in the given panel month, or '' if DOB month does not match panel month.
   * panelFirstOfMonth: first day of the month being viewed (e.g. Events / Birthday modal month bar).
   */
  function birthdayOccurrenceYmdInPanelMonth(dobYmd, panelFirstOfMonth) {
    var dob = normalizeBirthdayYmd(dobYmd);
    if (!dob || !panelFirstOfMonth) return '';
    var p = dob.split('-');
    var mm = parseInt(p[1], 10);
    var dd = parseInt(p[2], 10);
    if (!mm || mm < 1 || mm > 12 || !dd || dd < 1 || dd > 31) return '';
    var pm = panelFirstOfMonth.getMonth();
    if (mm - 1 !== pm) return '';
    var Y = panelFirstOfMonth.getFullYear();
    var occ = new Date(Y, mm - 1, dd);
    if (occ.getMonth() !== pm) return '';
    return ymd(occ.getFullYear(), occ.getMonth(), occ.getDate());
  }

  function birthdayThisYearDeltaDays(dobYmd) {
    var dob = normalizeBirthdayYmd(dobYmd);
    if (!dob) return 999999;
    var p = dob.split('-');
    var mm = parseInt(p[1], 10);
    var dd = parseInt(p[2], 10);
    var now = new Date();
    var todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var thisYear = new Date(now.getFullYear(), mm - 1, dd);
    return Math.round((thisYear.getTime() - todayMid.getTime()) / 86400000);
  }

  function birthdayItemStatus(entry) {
    return birthdayThisYearDeltaDays(entry && entry.dob) < 0 ? 'done' : 'upcoming';
  }

  function birthdayBadgeText(days) {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return 'In ' + days + ' days';
  }

  function birthdayAccentColorForTheme() {
    var theme = String((document.documentElement && document.documentElement.getAttribute('data-rpbdd-theme')) || 'light')
      .trim()
      .toLowerCase();
    return theme === 'night' ? '#7f1d1d' : '#dc2626';
  }

  function birthdayCardAccentForTheme() {
    var theme = String((document.documentElement && document.documentElement.getAttribute('data-rpbdd-theme')) || 'light')
      .trim()
      .toLowerCase();
    return theme === 'night' ? '#b4536a' : '#f87171';
  }

  /** When text was stored or returned already HTML-escaped, one decode before escapeHtml avoids showing literal &amp; in the UI. */
  function unescapeHtmlEntitiesOnce(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function birthdayHighlightText(text, query) {
    var raw = String(text == null ? '' : text);
    var q = String(query || '').trim();
    if (!q) return escapeHtml(raw);
    var lowRaw = raw.toLowerCase();
    var lowQ = q.toLowerCase();
    var out = '';
    var idx = 0;
    while (idx < raw.length) {
      var at = lowRaw.indexOf(lowQ, idx);
      if (at === -1) {
        out += escapeHtml(raw.slice(idx));
        break;
      }
      if (at > idx) out += escapeHtml(raw.slice(idx, at));
      out += '<mark class="rpbdd-bday-hit">' + escapeHtml(raw.slice(at, at + q.length)) + '</mark>';
      idx = at + q.length;
    }
    return out;
  }

  function birthdayCardHtml(entry, query) {
    var days = daysUntilBirthday(entry.dob);
    var q = String(query || '').trim();
    var expanded = String(state.expandedBirthdayId || '') === String((entry && entry.id) || '');
    var accent = birthdayCardAccentForTheme();
    var nm = birthdayHighlightText(unescapeHtmlEntitiesOnce(entry.name || 'Unnamed') || 'Unnamed', q);
    var posRaw = unescapeHtmlEntitiesOnce(entry.position);
    var secRaw = unescapeHtmlEntitiesOnce(entry.section);
    var pos = birthdayHighlightText(posRaw !== '' ? posRaw : '—', q);
    var sec = birthdayHighlightText(secRaw !== '' ? secRaw : '—', q);
    var nextYmd = nextBirthdayOccurrenceYmd(entry.dob);
    var dateLine = nextYmd ? formatLongDateYmd(nextYmd) : '—';
    var aSum = birthdayAstroSummaryLines(entry.dob);
    var photoBlock =
      entry.photo
        ? '<img src="' + escapeHtml(entry.photo) + '" alt="' + escapeHtml(entry.name || 'Photo') + '" class="rpbdd-bday-avatar">'
        : '<div class="rpbdd-bday-avatar rpbdd-bday-avatar--fallback">' + escapeHtml((entry.name || '?').slice(0, 1).toUpperCase()) + '</div>';
    return (
      '<div class="rpbdd-event-card rpbdd-bday-card" style="--rpbdd-ev-accent:' +
      accent +
      ';border-left:3px solid ' +
      accent +
      ';">' +
      '<div class="rpbdd-event-card-head" data-expand-bday-id="' +
      escapeHtml(entry.id || '') +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.6rem;width:100%;">' +
      '<div style="min-width:0;">' +
      '<div class="rpbdd-month-event-title" style="font-size:0.98rem">' + nm + '</div>' +
      '<div class="rpbdd-month-event-meta">' +
      escapeHtml(dateLine) +
      '</div>' +
      '</div>' +
      '<span class="rpbdd-profile-notif-kind" style="--rpbdd-notif-kind-color:' + accent + ';">' + escapeHtml(birthdayBadgeText(days)) + '</span>' +
      '</div></div>' +
      (expanded
        ? '<div class="rpbdd-event-card-body">' +
          '<div style="display:flex;gap:0.55rem;align-items:flex-start;margin-bottom:0.45rem">' +
          photoBlock +
          '<div style="min-width:0;flex:1">' +
          '<div class="rpbdd-month-event-meta"><strong>Date:</strong><br>' +
          escapeHtml(formatBirthdayLong(entry.dob)) +
          '</div>' +
          '<div class="rpbdd-month-event-meta rpbdd-bday-astro-detail" style="margin-top:0.35rem">' +
          '<strong>Age:</strong><br>' +
          'Current (as of today): ' +
          escapeHtml(aSum.age || '—') +
          '<br>' +
          'On next birthday (' +
          escapeHtml(dateLine) +
          '): ' +
          escapeHtml(aSum.ageOnBirthday || '—') +
          '</div>' +
          '<div class="rpbdd-month-event-meta rpbdd-bday-astro-detail" style="margin-top:0.35rem">' +
          '<strong>Zodiac Sign:</strong><br>' +
          escapeHtml(aSum.western || '—') +
          '</div>' +
          '<div class="rpbdd-month-event-meta rpbdd-bday-astro-detail" style="margin-top:0.35rem">' +
          '<strong>Chinese Zodiac:</strong><br>' +
          'Year of the ' +
          escapeHtml(aSum.chinese || '—') +
          '</div>' +
          '<div class="rpbdd-month-event-meta" style="margin-top:0.35rem">' +
          '<strong>Position:</strong><br>' +
          pos +
          '</div>' +
          '<div class="rpbdd-month-event-meta" style="margin-top:0.35rem">' +
          '<strong>Section:</strong><br>' +
          sec +
          '</div>' +
          '</div></div>' +
          '</div>'
        : '') +
      (expanded
        ? '<div class="rpbdd-profile-notif-card-foot" style="padding:0.45rem 0.75rem 0.7rem;">'
        : '<div class="rpbdd-profile-notif-card-foot" style="display:none;">') +
      '<span class="rpbdd-profile-notif-card-foot-actions">' +
      '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--edit rpbdd-btn-sm--dense" data-bday-edit="' + escapeHtml(entry.id || '') + '">✎ Edit</button>' +
      '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete rpbdd-btn-sm--dense" data-bday-delete="' + escapeHtml(entry.id || '') + '">🗑 Delete</button>' +
      '</span>' +
      '</div></div>'
    );
  }

  function categoryDisplayPositionsForBirthday() {
    var map = loadReportCategoryDisplayMap();
    var seen = {};
    var out = [];
    Object.keys(map || {}).forEach(function (k) {
      var row = map[k];
      var p = row && row.position != null ? String(row.position).trim() : '';
      if (!p) return;
      var low = p.toLowerCase();
      if (seen[low]) return;
      seen[low] = true;
      out.push(p);
    });
    return out.sort(function (a, b) {
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    });
  }

  function normalizeBirthdayPositionsFromStorage(savedList) {
    var base = categoryDisplayPositionsForBirthday();
    var seen = {};
    var out = [];
    base.forEach(function (p) {
      var low = String(p).toLowerCase();
      if (seen[low]) return;
      seen[low] = true;
      out.push(String(p));
    });
    var legacyDefaults = { 'section chief': 1, 'team leader': 1, member: 1 };
    (savedList || []).forEach(function (p) {
      var v = String(p || '').trim();
      if (!v) return;
      var low = v.toLowerCase();
      if (seen[low]) return;
      if (legacyDefaults[low]) return;
      seen[low] = true;
      out.push(v);
    });
    return out.sort(function (a, b) {
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    });
  }

  function dedupeSortBirthdayOptions(arr) {
    var seen = {};
    var out = [];
    (arr || []).forEach(function (x) {
      var v = String(x || '').trim();
      if (!v) return;
      var low = v.toLowerCase();
      if (seen[low]) return;
      seen[low] = true;
      out.push(v);
    });
    return out.sort(function (a, b) {
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    });
  }

  function refreshBirthdayOptionsFromApi() {
    var base = getBirthdaysApiBase();
    if (!base) return Promise.resolve(false);
    return fetch(base + '/options', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        if (!j || !j.ok) return false;
        var pos = Array.isArray(j.positions) ? j.positions : [];
        var sec = Array.isArray(j.sections) ? j.sections : [];
        state.birthdayPositions = dedupeSortBirthdayOptions(pos);
        state.birthdaySections = dedupeSortBirthdayOptions(sec);
        saveBirthdayDropdowns();
        renderBirthdaySelectOptions();
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function openBirthdayOptionModal(kind, mode, oldValue) {
    var k = String(kind || '').toLowerCase() === 'section' ? 'section' : 'position';
    var m = String(mode || 'add').toLowerCase() === 'edit' ? 'edit' : 'add';
    var oldVal = String(oldValue || '').trim();
    var kindEl = document.getElementById('rpbdd-birthday-option-kind');
    var titleEl = document.getElementById('rpbdd-birthday-option-title');
    var valEl = document.getElementById('rpbdd-birthday-option-value');
    var saveBtn = document.getElementById('rpbdd-save-birthday-option');
    if (kindEl) kindEl.value = k;
    if (titleEl) {
      if (m === 'edit') titleEl.textContent = k === 'section' ? 'Edit Section' : 'Edit Position';
      else titleEl.textContent = k === 'section' ? 'Add Section' : 'Add Position';
    }
    if (valEl) valEl.value = m === 'edit' ? oldVal : '';
    if (saveBtn) {
      saveBtn.dataset.mode = m;
      saveBtn.dataset.oldValue = m === 'edit' ? oldVal : '';
      saveBtn.textContent = m === 'edit' ? 'Save Changes' : 'Save';
    }
    closeBirthdayDropdownMenus();
    openModal('modal-add-birthday-option');
    if (valEl) {
      setTimeout(function () {
        try {
          valEl.focus();
        } catch (e) {}
      }, 0);
    }
  }

  function defaultBirthdaySectionsFromLegend() {
    var allowed = {};
    DEFAULT_BIRTHDAY_SECTIONS.forEach(function (s) {
      allowed[String(s).toUpperCase()] = true;
    });
    var found = [];
    var seen = {};
    (eventCategories || []).forEach(function (cat) {
      var n = String((cat && cat.name) || '').trim();
      if (!n) return;
      var up = n.toUpperCase();
      if (!allowed[up] || seen[up]) return;
      seen[up] = true;
      found.push(up);
    });
    if (!found.length) return DEFAULT_BIRTHDAY_SECTIONS.slice();
    return found;
  }

  function setBirthdayDropdownValue(kind, value) {
    var sel = document.getElementById(kind === 'position' ? 'birthday-position' : 'birthday-section');
    var label = document.getElementById(kind === 'position' ? 'birthday-position-label' : 'birthday-section-label');
    var v = String(value || '').trim();
    if (sel) sel.value = v;
    if (label) label.textContent = v || (kind === 'position' ? 'Select position' : 'Select section');
  }

  function closeBirthdayDropdownMenus() {
    var pm = document.getElementById('birthday-position-menu');
    var sm = document.getElementById('birthday-section-menu');
    if (pm) pm.style.display = 'none';
    if (sm) sm.style.display = 'none';
  }

  function toggleBirthdayDropdownMenu(kind, forceOpen) {
    var menu = document.getElementById(kind === 'position' ? 'birthday-position-menu' : 'birthday-section-menu');
    if (!menu) return;
    var open = typeof forceOpen === 'boolean' ? forceOpen : menu.style.display !== 'block';
    closeBirthdayDropdownMenus();
    menu.style.display = open ? 'block' : 'none';
  }

  function birthdayOptionExists(kind, value, excludeValue) {
    var v = String(value || '').trim().toLowerCase();
    var ex = String(excludeValue || '').trim().toLowerCase();
    if (!v) return false;
    var arr = kind === 'section' ? state.birthdaySections : state.birthdayPositions;
    return (arr || []).some(function (x) {
      var cur = String(x || '').trim().toLowerCase();
      if (!cur) return false;
      if (ex && cur === ex) return false;
      return cur === v;
    });
  }

  function setBirthdayOptionsByKind(kind, nextValues) {
    var list = dedupeSortBirthdayOptions(nextValues || []);
    if (kind === 'section') state.birthdaySections = list;
    else state.birthdayPositions = list;
    saveBirthdayDropdowns();
    renderBirthdaySelectOptions();
  }

  function updateBirthdayOptionValue(kind, oldValue, nextValue) {
    var oldV = String(oldValue || '').trim();
    var newV = String(nextValue || '').trim();
    if (!oldV || !newV) return false;
    var arr = (kind === 'section' ? state.birthdaySections : state.birthdayPositions) || [];
    var changed = false;
    var out = arr.map(function (x) {
      var cur = String(x || '').trim();
      if (!cur) return cur;
      if (cur.toLowerCase() !== oldV.toLowerCase()) return cur;
      changed = true;
      return newV;
    });
    if (!changed) return false;
    setBirthdayOptionsByKind(kind, out);
    return true;
  }

  function removeBirthdayOptionValue(kind, value) {
    var v = String(value || '').trim();
    if (!v) return false;
    var arr = (kind === 'section' ? state.birthdaySections : state.birthdayPositions) || [];
    var out = arr.filter(function (x) {
      return String(x || '').trim().toLowerCase() !== v.toLowerCase();
    });
    if (out.length === arr.length) return false;
    setBirthdayOptionsByKind(kind, out);
    if (kind === 'section' && String((document.getElementById('birthday-section') || {}).value || '').trim().toLowerCase() === v.toLowerCase()) {
      setBirthdayDropdownValue('section', '');
    }
    if (kind === 'position' && String((document.getElementById('birthday-position') || {}).value || '').trim().toLowerCase() === v.toLowerCase()) {
      setBirthdayDropdownValue('position', '');
    }
    return true;
  }

  function renderBirthdaySelectOptions() {
    var posEl = document.getElementById('birthday-position');
    var secEl = document.getElementById('birthday-section');
    var posList = document.getElementById('birthday-position-list');
    var secList = document.getElementById('birthday-section-list');
    if (posEl) {
      var selectedPos = String(posEl.value || '').trim();
      posEl.innerHTML = '<option value="">Select position</option>';
      (state.birthdayPositions || [])
        .slice()
        .sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }); })
        .forEach(function (p) {
          var val = String(p);
          var opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          if (val === selectedPos) opt.selected = true;
          posEl.appendChild(opt);
        });
      if (posList) {
        posList.innerHTML = '';
        Array.prototype.slice.call(posEl.options).forEach(function (o) {
          if (!o.value) return;
          var row = document.createElement('div');
          row.className = 'rpbdd-bday-dd-row';
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '0.35rem';
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'rpbdd-btn-sm rpbdd-bday-dd-option' + (o.value === selectedPos ? ' is-selected' : '');
          btn.style.textAlign = 'left';
          btn.style.justifyContent = 'flex-start';
          btn.style.flex = '1 1 auto';
          btn.style.minWidth = '0';
          btn.textContent = o.textContent;
          btn.addEventListener('click', function () {
            setBirthdayDropdownValue('position', o.value);
            closeBirthdayDropdownMenus();
          });
          row.appendChild(btn);
          var editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'rpbdd-btn-sm rpbdd-btn-action--edit rpbdd-btn-sm--dense';
          editBtn.innerHTML = '✎ Edit';
          editBtn.style.fontSize = '0.64rem';
          editBtn.style.padding = '0.1rem 0.35rem';
          editBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            openBirthdayOptionModal('position', 'edit', o.value);
          });
          row.appendChild(editBtn);
          var removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'rpbdd-btn-sm rpbdd-btn-action--delete rpbdd-btn-sm--dense';
          removeBtn.style.fontSize = '0.64rem';
          removeBtn.style.padding = '0.1rem 0.35rem';
          removeBtn.innerHTML = '🗑 Remove';
          removeBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            openRpbddConfirm({
              variant: 'remove',
              title: 'Remove position option?',
              message: '“' + o.value + '” will be removed from Position choices.',
              confirmLabel: 'Remove',
              cancelLabel: 'Cancel',
              danger: true,
            }).then(function (ok) {
              if (!ok) return;
              removeBirthdayOptionValue('position', o.value);
              var base = getBirthdaysApiBase();
              if (base) {
                fetch(base + '/options/delete', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                  body: JSON.stringify({ kind: 'position', value: o.value }),
                }).catch(function () {});
              }
              renderBirthdaySelectOptions();
            });
          });
          row.appendChild(removeBtn);
          posList.appendChild(row);
        });
      }
      setBirthdayDropdownValue('position', selectedPos);
    }
    if (secEl) {
      var selectedSec = String(secEl.value || '').trim();
      secEl.innerHTML = '<option value="">Select section</option>';
      (state.birthdaySections || [])
        .slice()
        .sort(function (a, b) { return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }); })
        .forEach(function (s) {
          var val = String(s);
          var opt = document.createElement('option');
          opt.value = val;
          opt.textContent = val;
          if (val === selectedSec) opt.selected = true;
          secEl.appendChild(opt);
        });
      if (secList) {
        secList.innerHTML = '';
        Array.prototype.slice.call(secEl.options).forEach(function (o) {
          if (!o.value) return;
          var row = document.createElement('div');
          row.className = 'rpbdd-bday-dd-row';
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '0.35rem';
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'rpbdd-btn-sm rpbdd-bday-dd-option' + (o.value === selectedSec ? ' is-selected' : '');
          btn.style.textAlign = 'left';
          btn.style.justifyContent = 'flex-start';
          btn.style.flex = '1 1 auto';
          btn.style.minWidth = '0';
          btn.textContent = o.textContent;
          btn.addEventListener('click', function () {
            setBirthdayDropdownValue('section', o.value);
            closeBirthdayDropdownMenus();
          });
          row.appendChild(btn);
          var editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'rpbdd-btn-sm rpbdd-btn-action--edit rpbdd-btn-sm--dense';
          editBtn.innerHTML = '✎ Edit';
          editBtn.style.fontSize = '0.64rem';
          editBtn.style.padding = '0.1rem 0.35rem';
          editBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            openBirthdayOptionModal('section', 'edit', o.value);
          });
          row.appendChild(editBtn);
          var removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'rpbdd-btn-sm rpbdd-btn-action--delete rpbdd-btn-sm--dense';
          removeBtn.style.fontSize = '0.64rem';
          removeBtn.style.padding = '0.1rem 0.35rem';
          removeBtn.innerHTML = '🗑 Remove';
          removeBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            openRpbddConfirm({
              variant: 'remove',
              title: 'Remove section option?',
              message: '“' + o.value + '” will be removed from Section choices.',
              confirmLabel: 'Remove',
              cancelLabel: 'Cancel',
              danger: true,
            }).then(function (ok) {
              if (!ok) return;
              removeBirthdayOptionValue('section', o.value);
              var base = getBirthdaysApiBase();
              if (base) {
                fetch(base + '/options/delete', {
                  method: 'POST',
                  credentials: 'same-origin',
                  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                  body: JSON.stringify({ kind: 'section', value: o.value }),
                }).catch(function () {});
              }
              renderBirthdaySelectOptions();
            });
          });
          row.appendChild(removeBtn);
          secList.appendChild(row);
        });
      }
      setBirthdayDropdownValue('section', selectedSec);
    }
  }

  function renderBirthdayPhotoAvatar(photoSrc, nameText) {
    var prev = document.getElementById('birthday-photo-preview');
    var initials = document.getElementById('birthday-photo-initials');
    var src = String(photoSrc || '').trim();
    var nm = String(nameText || '').trim();
    var initial = nm ? nm.charAt(0).toUpperCase() : 'B';
    if (prev) {
      if (src) {
        prev.src = src;
        prev.style.display = 'block';
      } else {
        prev.removeAttribute('src');
        prev.style.display = 'none';
      }
    }
    if (initials) {
      initials.textContent = initial;
      initials.hidden = !!src;
    }
  }

  function resetAddBirthdayForm() {
    var photo = document.getElementById('birthday-photo');
    var name = document.getElementById('birthday-name');
    var dob = document.getElementById('birthday-dob');
    if (photo) photo.value = '';
    if (name) name.value = '';
    if (dob) dob.value = '';
    setBirthdayDropdownValue('position', '');
    setBirthdayDropdownValue('section', '');
    renderBirthdaySelectOptions();
    renderBirthdayPhotoAvatar('', '');
    closeBirthdayDropdownMenus();
    var title = document.querySelector('#modal-add-birthday h2');
    if (title) title.textContent = 'Add Birthday Celebrant';
    var saveBtn = document.getElementById('rpbdd-save-add-birthday');
    if (saveBtn) saveBtn.textContent = 'Save';
    state.editingBirthdayId = null;
  }

  function refreshNotificationBadgeCount() {
    var all = Array.isArray(state.birthdayCelebrants) ? state.birthdayCelebrants : [];
    state.notifPending = all.filter(birthdayUpcomingInViewedMonth).length;
  }

  function createProfileUpdateNotification(actionLabel) {
    var actorRole = currentUserRole();
    if (actorRole !== 'member' && actorRole !== 'team_leader') return;
    var recipients = profileNotifRecipientsForActorRole(actorRole);
    if (!recipients.length) return;
    var u = state.currentUser || {};
    var actorName = String(u.name || u.email || (actorRole === 'member' ? 'Member' : 'Section Chief')).trim();
    var roleLabel = actorRole === 'member' ? 'Member' : 'Section Chief';
    var action = String(actionLabel || 'updated profile information').trim();
    var title = roleLabel + ' profile update';
    var details =
      actorName +
      ' (' +
      roleLabel +
      ') ' +
      action +
      '.';
    var targetMemberId = 0;
    var targetTeamId = 0;
    var targetKind = 'member';
    if (actorRole === 'member' && state.accountMemberMember) {
      var rawM = pickMemberRowId(state.accountMemberMember);
      targetMemberId =
        rawM != null && rawM !== ''
          ? parseInt(String(rawM), 10) || 0
          : parseInt(String(state.accountMemberMember.id || ''), 10) || 0;
      targetKind = 'member';
    } else if (actorRole === 'team_leader' && state.accountLeaderTeam) {
      targetTeamId = parseInt(String(state.accountLeaderTeam.id || ''), 10) || 0;
      targetKind = 'team';
    }
    var teamLabelDisp = '';
    if (actorRole === 'member' && state.accountMemberMember) {
      teamLabelDisp = firstNonEmptyString(
        state.accountMemberMember.team,
        state.accountMemberMember.Team,
        state.accountMemberMember.sectionTeam,
        state.accountMemberMember.section_team,
      ).trim();
    } else if (actorRole === 'team_leader' && state.accountLeaderTeam) {
      var trow = state.accountLeaderTeam;
      teamLabelDisp = firstNonEmptyString(
        trow.sectionTeam,
        trow.section_team,
        trow.Section_Team,
        trow.teamLeader,
        trow.Team_Leader,
      ).trim();
    }
    var id = 'pn_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    var notif = {
      id: id,
      type: 'profile_update',
      actorRole: actorRole,
      actorName: actorName,
      title: title,
      summary: action,
      details: details,
      recipients: recipients,
      createdAt: new Date().toISOString(),
      readByRoles: {},
      updatedByRole: actorRole,
      updatedByLabel: actorName,
      targetKind: targetKind,
      targetMemberId: targetMemberId,
      targetTeamId: targetTeamId,
      teamLabel: teamLabelDisp,
      serverNumericId: 0,
    };
    state.notifications = [notif].concat(state.notifications || []).slice(0, 300);
    persistProfileNotifications();
    refreshNotificationBadgeCount();
    updateFooterSummary();
  }

  function profileNotifMysqlToIso(mysqlDt) {
    var s = String(mysqlDt || '').trim();
    if (!s) return new Date().toISOString();
    if (s.indexOf('T') !== -1) return s;
    return s.replace(' ', 'T');
  }

  function mapServerProfileNotification(s) {
    var idNum = s && s.id != null ? parseInt(s.id, 10) : 0;
    var adminRead = !!(s && s.adminReadAt && String(s.adminReadAt).trim() !== '');
    var tlRead = !!(s && s.teamLeaderReadAt && String(s.teamLeaderReadAt).trim() !== '');
    var name = s && s.memberName != null ? String(s.memberName) : '';
    var act = s && s.actionLabel != null ? String(s.actionLabel) : 'updated profile information';
    var det = s && s.details != null ? String(s.details) : '';
    var kind = String((s && s.targetKind) || 'member')
      .trim()
      .toLowerCase();
    if (!kind) kind = 'member';
    var showAdm = s && s.showToAdmin != null ? parseInt(String(s.showToAdmin), 10) === 1 : true;
    var showTl = s && s.showToTeamLeader != null ? parseInt(String(s.showToTeamLeader), 10) === 1 : true;
    var showMem = s && s.showToMember != null ? parseInt(String(s.showToMember), 10) === 1 : false;
    var memberRead = !!(s && s.memberReadAt && String(s.memberReadAt).trim() !== '');
    var rec = [];
    if (kind === 'task') {
      rec = ['admin', 'team_leader', 'member'];
    } else {
      if (showAdm) rec.push('admin');
      if (showTl) rec.push('team_leader');
      if (showMem) rec.push('member');
      if (!rec.length) rec = ['admin'];
    }
    var tm =
      s && s.targetMemberId != null && String(s.targetMemberId).trim() !== ''
        ? parseInt(String(s.targetMemberId), 10)
        : s && s.memberId != null && String(s.memberId).trim() !== ''
          ? parseInt(String(s.memberId), 10)
          : 0;
    var tt =
      s && s.targetTeamId != null && String(s.targetTeamId).trim() !== '' ? parseInt(String(s.targetTeamId), 10) : 0;
    var ubRole = s && s.updatedByRole != null ? String(s.updatedByRole).trim() : '';
    var ubLabel = s && s.updatedByLabel != null ? String(s.updatedByLabel).trim() : '';
    var teamLab = s && s.teamLabel != null ? String(s.teamLabel).trim() : '';
    var badgeRole;
    var title;
    var detailsCombined;
    if (kind === 'task') {
      var tr = String(ubRole || 'member')
        .trim()
        .toLowerCase();
      if (tr === 'user') tr = 'member';
      badgeRole = tr === 'admin' || tr === 'team_leader' || tr === 'member' ? tr : 'member';
      title = act || 'Task';
      detailsCombined = det || act;
    } else if (kind === 'team') {
      badgeRole = 'team_leader';
      title = 'Team profile update';
      var subjectLineT = name + ' (Team / Section)';
      detailsCombined = subjectLineT + ' — ' + act + (det ? '. ' + det : '');
    } else {
      badgeRole = 'member';
      title = 'Member profile update';
      var subjectLineM = name + ' (Member)';
      detailsCombined = subjectLineM + ' — ' + act + (det ? '. ' + det : '');
    }
    var taskListIdRaw =
      s && s.targetTaskListId != null && String(s.targetTaskListId).trim() !== ''
        ? parseInt(String(s.targetTaskListId), 10) || 0
        : 0;
    return {
      id: 'srv_' + idNum,
      source: 'server',
      type: 'profile_update',
      actorRole: badgeRole,
      actorName: name,
      title: title,
      summary: act,
      details: detailsCombined,
      recipients: rec,
      createdAt: profileNotifMysqlToIso(s && s.createdAt),
      readByRoles: { admin: adminRead, team_leader: tlRead, member: memberRead },
      updatedByRole: ubRole,
      updatedByLabel: ubLabel,
      targetKind: kind,
      targetMemberId: kind === 'member' ? tm : 0,
      targetTeamId: kind === 'team' ? tt : 0,
      targetTaskListId: kind === 'task' && taskListIdRaw > 0 ? taskListIdRaw : 0,
      teamLabel: teamLab,
      serverNumericId: idNum,
    };
  }

  function profileNotifRecycleSourceIdSet() {
    var o = {};
    (state.profileNotifRecycle || []).forEach(function (e) {
      if (e && e.sourceId != null && String(e.sourceId).trim() !== '') {
        o[String(e.sourceId)] = true;
      }
    });
    return o;
  }

  function profileNotifPurgedServerIdSet() {
    var o = {};
    (state.profileNotifPurgedServerIds || []).forEach(function (x) {
      var n = parseInt(String(x), 10) || 0;
      if (n > 0) o[n] = true;
    });
    return o;
  }

  function isProfileNotifHiddenFromMainList(n) {
    if (!n) return false;
    var rec = profileNotifRecycleSourceIdSet();
    if (rec[String(n.id)]) return true;
    var srv = parseInt(String(n.serverNumericId || 0), 10) || 0;
    if (srv > 0 && profileNotifPurgedServerIdSet()[srv]) return true;
    return false;
  }

  function filterProfileNotifMappedServerRows(mapped) {
    var rec = profileNotifRecycleSourceIdSet();
    var purged = profileNotifPurgedServerIdSet();
    return mapped.filter(function (m) {
      var srv = parseInt(String(m.serverNumericId || 0), 10) || 0;
      if (srv > 0 && purged[srv]) return false;
      if (rec[String(m.id)]) return false;
      return true;
    });
  }

  function mergeServerProfileNotifications(serverRows) {
    if (!Array.isArray(serverRows)) serverRows = [];
    var rest = (state.notifications || []).filter(function (n) {
      return !n || n.source !== 'server';
    });
    var mapped = serverRows.map(mapServerProfileNotification);
    mapped = filterProfileNotifMappedServerRows(mapped);
    mapped.sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    state.notifications = mapped.concat(rest).slice(0, 400);
  }

  function refreshProfileNotificationsFromApi() {
    var base = getProfileNotificationsApiBase();
    var role = currentUserRole();
    if (
      !base ||
      (role !== 'admin' && role !== 'team_leader' && role !== 'member' && role !== 'user')
    ) {
      return Promise.resolve(false);
    }
    return fetch(base, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { res: r, j: j };
        });
      })
      .then(function (o) {
        if (!o.res.ok || !o.j || !o.j.ok || !Array.isArray(o.j.notifications)) return false;
        mergeServerProfileNotifications(o.j.notifications);
        refreshNotificationBadgeCount();
        renderNotificationWidgetPreview();
        if (document.getElementById('rpbdd-notifications-list')) renderNotificationsModal();
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function profileNotificationIsUnread(n, role) {
    if (!n || !role) return true;
    var rb = n.readByRoles && typeof n.readByRoles === 'object' ? n.readByRoles : {};
    if (role === 'member' || role === 'user') {
      return rb.member !== true;
    }
    return rb[role] !== true;
  }

  function profileNotificationEditorLine(n) {
    var r = String((n && n.updatedByRole) || (n && n.actorRole) || '')
      .trim()
      .toLowerCase();
    var label = String((n && n.updatedByLabel) || (n && n.actorName) || '').trim();
    if (!label && !r) return 'Updated by: —';
    var roleWord =
      r === 'admin'
        ? 'Administrator'
        : r === 'team_leader'
          ? 'Section Chief'
          : r === 'member' || r === 'user'
            ? 'Member'
            : r
              ? r.charAt(0).toUpperCase() + r.slice(1)
              : 'User';
    if (!label) return 'Updated by: ' + roleWord;
    return 'Updated by: ' + label + ' (' + roleWord + ')';
  }

  function profileNotificationHasDeepLink(n) {
    if (!n) return false;
    if (String(n.targetKind || '')
      .trim()
      .toLowerCase() === 'task') {
      return true;
    }
    var tm = parseInt(String(n.targetMemberId || 0), 10) || 0;
    var tt = parseInt(String(n.targetTeamId || 0), 10) || 0;
    return tm > 0 || tt > 0;
  }

  function markProfileNotificationReadById(notif) {
    var role = currentUserRole();
    if (!notif || !role) return Promise.resolve();
    var base = getProfileNotificationsApiBase();
    var sid = parseInt(String(notif.serverNumericId || 0), 10) || 0;
    if (
      notif.source === 'server' &&
      base &&
      sid > 0 &&
      (role === 'admin' || role === 'team_leader' || role === 'member' || role === 'user')
    ) {
      return fetch(base + '/mark-read', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [sid] }),
      })
        .catch(function () {})
        .then(function () {
          return refreshProfileNotificationsFromApi();
        });
    }
    if (!notif.readByRoles || typeof notif.readByRoles !== 'object') notif.readByRoles = {};
    if (role === 'member' || role === 'user') {
      notif.readByRoles.member = true;
    } else {
      notif.readByRoles[role] = true;
    }
    persistProfileNotifications();
    refreshNotificationBadgeCount();
    renderNotificationWidgetPreview();
    return Promise.resolve();
  }

  /** Mark unread task notifications as read when opening a task card directly. */
  function markTaskNotificationsReadByListId(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) return Promise.resolve();
    var role = currentUserRole();
    if (!role) return Promise.resolve();
    var ids = [];
    (state.notifications || []).forEach(function (n) {
      if (!n) return;
      if (String(n.targetKind || '').toLowerCase() !== 'task') return;
      var tli = parseInt(String(n.targetTaskListId || 0), 10) || 0;
      if (tli !== lid) return;
      if (!roleCanSeeProfileNotif(n, role)) return;
      if (!profileNotificationIsUnread(n, role)) return;
      var sid = parseInt(String(n.serverNumericId || 0), 10) || 0;
      if (sid > 0) ids.push(sid);
    });
    if (!ids.length) return Promise.resolve();
    var base = getProfileNotificationsApiBase();
    if (!base) return Promise.resolve();
    return fetch(base + '/mark-read', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids }),
    })
      .catch(function () {})
      .then(function () {
        return refreshProfileNotificationsFromApi();
      });
  }

  function jumpTeamPanelToMemberCard(memberId) {
    var mid = String(memberId);
    state.teamMembersSearch = '';
    state.teamView = 'members';
    state.expandedTeamId = null;
    var data = state.teamMembers.filter(function (m) {
      return matchesMembersSearch(m, '');
    });
    var idx = data.findIndex(function (m) {
      return String(m.id) === mid || String(pickMemberRowId(m)) === mid;
    });
    if (idx < 0) {
      state.expandedMemberId = null;
      state.currentPage = 1;
      setNav('team');
      return;
    }
    var found = data[idx];
    var expandId = found != null ? String(found.id) : mid;
    var per = state.recordsPerPage || 5;
    state.currentPage = Math.floor(idx / per) + 1;
    state.expandedMemberId = expandId;
    setNav('team');
  }

  function jumpTeamPanelToTeamCard(teamId) {
    var tid = String(teamId);
    state.teamTeamsSearch = '';
    state.teamView = 'teams';
    state.expandedMemberId = null;
    var data = state.teams.filter(function (t) {
      return matchesTeamsSearch(t, '');
    });
    var idx = data.findIndex(function (t) {
      return String(t.id) === tid;
    });
    if (idx < 0) {
      state.expandedTeamId = null;
      state.currentPage = 1;
      setNav('team');
      return;
    }
    var found = data[idx];
    var expandTid = found != null && found.id != null ? String(found.id) : tid;
    var per = state.recordsPerPage || 5;
    state.currentPage = Math.floor(idx / per) + 1;
    state.expandedTeamId = expandTid;
    setNav('team');
  }

  /** Task notification summary → which Tasks tab / mark-viewed behavior (matches server action_label). */
  function tasksProfileNotifActionKey(notif) {
    var sum = String((notif && notif.summary) || '').toLowerCase();
    if (sum.indexOf('submitted a task for your review') >= 0) return 'creator_review';
    if (sum.indexOf('approved your submitted task') >= 0) return 'assignee_done';
    if (sum.indexOf('sent you a new task') >= 0) return 'assignee_new';
    if (sum.indexOf('sent your task back') >= 0) return 'assignee_revision';
    return 'generic';
  }

  function tasksScrollTaskCardIntoView(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) return;
    requestAnimationFrame(function () {
      setTimeout(function () {
        var head = document.querySelector('[data-expand-task-list="' + lid + '"]');
        var card = head ? head.closest('.rpbdd-tasks-card') : null;
        var el = card || head;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 100);
    });
  }

  /**
   * After clicking View on a task notification: correct Tasks tab, expand card, assignee → mark viewed,
   * scroll card into view (admin + assignee see Mark as viewed highlight after API refresh).
   */
  function tasksNavigateFromTaskProfileNotification(notif) {
    var listId = parseInt(String((notif && notif.targetTaskListId) || 0), 10) || 0;
    var key = tasksProfileNotifActionKey(notif);
    setNav('tasks');
    if (key === 'creator_review') {
      state.tasksView = 'review';
    } else if (key === 'assignee_done') {
      state.tasksView = 'done';
    } else {
      state.tasksView = 'new';
    }
    state.expandedTaskListId = listId > 0 ? listId : null;

    var needMarkViewed = listId > 0 && (key === 'assignee_new' || key === 'assignee_revision');
    var finish = function () {
      renderTasksPanel();
      tasksScrollTaskCardIntoView(listId);
      return refreshProfileNotificationsFromApi();
    };

    if (needMarkViewed) {
      return tasksMarkListViewed(listId).then(finish);
    }
    return fetchTaskListsFromApi().then(finish);
  }

  function openProfileNotificationViewById(encodedNotifId) {
    var nid = decodeURIComponent(encodedNotifId || '');
    var notif = (state.notifications || []).find(function (x) {
      return x && String(x.id) === String(nid);
    });
    if (!notif) return;
    var kindRaw = String(notif.targetKind || '')
      .trim()
      .toLowerCase();
    if (kindRaw === 'task') {
      markProfileNotificationReadById(notif).then(function () {
        closeModal('modal-notifications');
        renderNotificationsModal();
        renderNotificationWidgetPreview();
        updateFooterSummary();
        tasksNavigateFromTaskProfileNotification(notif);
      });
      return;
    }
    var kind = kindRaw === 'team' ? 'team' : 'member';
    var mid = parseInt(String(notif.targetMemberId || 0), 10) || 0;
    var tid = parseInt(String(notif.targetTeamId || 0), 10) || 0;
    markProfileNotificationReadById(notif).then(function () {
      closeModal('modal-notifications');
      renderNotificationsModal();
      renderNotificationWidgetPreview();
      updateFooterSummary();
      var cr = currentUserRole();
      if (cr === 'member' || cr === 'user') {
        openMemberAccountModal();
        return;
      }
      if (kind === 'team' && tid > 0) {
        jumpTeamPanelToTeamCard(tid);
      } else if (mid > 0) {
        jumpTeamPanelToMemberCard(mid);
      } else {
        setNav('team');
      }
    });
  }

  /** Section / team line(s) above “Details” on expanded profile notification cards. */
  function profileNotificationTeamDetailsHtml(n) {
    if (String(n && n.targetKind || '')
      .trim()
      .toLowerCase() === 'task') {
      return '';
    }
    var targetIsTeam = String(n && n.targetKind || '').toLowerCase() === 'team';
    var tl = String((n && n.teamLabel) || '').trim();
    var leader = String((n && n.actorName) || '').trim();
    var pStyle = 'font-size:0.75rem;margin:0 0 0.45rem 0;line-height:1.4';
    if (targetIsTeam) {
      var secBlock =
        '<p style="' +
        pStyle +
        '"><strong>Section / team</strong><br>' +
        escapeHtml(tl || '—') +
        '</p>';
      if (leader && leader !== tl) {
        secBlock +=
          '<p style="' +
          pStyle +
          '"><strong>Section chief</strong><br>' +
          escapeHtml(leader) +
          '</p>';
      }
      return secBlock;
    }
    return (
      '<p style="' +
      pStyle +
      '"><strong>Member\u2019s team</strong><br>' +
      escapeHtml(tl || '—') +
      '</p>'
    );
  }

  function buildProfileNotificationCardHtml(n, role) {
    var expanded = state.expandedNotificationId === n.id;
    var tk = String(n.targetKind || '')
      .trim()
      .toLowerCase();
    var targetIsTeam = tk === 'team';
    var targetIsTask = tk === 'task';
    var accentKey = targetIsTeam ? 'team_leader' : targetIsTask ? String(n.updatedByRole || n.actorRole || 'member').toLowerCase() : 'member';
    var col = notificationAccentForRole(accentKey);
    var when = formatNotificationDateTime(n.createdAt);
    var unread = profileNotificationIsUnread(n, role);
    var kindLabel = targetIsTeam ? 'Team' : targetIsTask ? 'Task' : 'Member';
    var readTab = String(state.notificationsModalView || 'unread').toLowerCase() === 'read';
    var footHtml = '';
    if (expanded) {
      var viewBtn = '';
      if (profileNotificationHasDeepLink(n)) {
        viewBtn =
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green rpbdd-profile-notif-view-btn" data-profile-notif-view="' +
          encodeURIComponent(n.id) +
          '">View</button>';
      }
      var removeBtn = '';
      if (readTab && !unread) {
        removeBtn =
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--remove rpbdd-profile-notif-remove-btn" data-profile-notif-to-recycle="' +
          encodeURIComponent(n.id) +
          '">' +
          svgIconRemove +
          '<span>Remove</span></button>';
      }
      footHtml =
        '<div class="rpbdd-profile-notif-card-foot">' +
        '<span class="rpbdd-profile-notif-card-by">' +
        escapeHtml(profileNotificationEditorLine(n)) +
        '</span>' +
        '<span class="rpbdd-profile-notif-card-foot-actions">' +
        viewBtn +
        removeBtn +
        '</span>' +
        '</div>';
    }
    return (
      '<div class="rpbdd-event-card rpbdd-profile-notif-card" style="border-left:3px solid ' +
      col +
      '">' +
      '<div class="rpbdd-event-card-head" data-expand-profile-notif-id="' +
      encodeURIComponent(n.id) +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.4rem;flex-wrap:wrap;width:100%">' +
      '<div style="min-width:0">' +
      '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.2rem">' +
      '<span style="width:0.65rem;height:0.65rem;border-radius:50%;flex-shrink:0;background:' +
      col +
      '"></span>' +
      '<strong style="font-size:0.85rem">' +
      escapeHtml(n.title || 'Notification') +
      '</strong>' +
      (unread ? '<span class="rpbdd-pill" style="padding:0.06rem 0.35rem;font-size:0.65rem">NEW</span>' : '') +
      '</div>' +
      '<div class="rpbdd-profile-notif-when">' +
      escapeHtml(when || '—') +
      '</div>' +
      '</div>' +
      '<span class="rpbdd-profile-notif-kind" style="--rpbdd-notif-kind-color:' +
      col +
      '">' +
      escapeHtml(kindLabel) +
      '</span>' +
      '</div></div>' +
      (expanded
        ? '<div class="rpbdd-event-card-body">' +
          profileNotificationTeamDetailsHtml(n) +
          '<p style="font-size:0.75rem;margin:0 0 0.5rem 0;line-height:1.4"><strong>Details</strong><br>' +
          escapeHtml(n.details || n.summary || '') +
          '</p>' +
          footHtml +
          '</div>'
        : '') +
      '</div>'
    );
  }

  function syncNotificationsModalPills() {
    var v = String(state.notificationsModalView || 'unread').toLowerCase() === 'read' ? 'read' : 'unread';
    document.querySelectorAll('[data-notifications-view]').forEach(function (b) {
      var raw = String(b.getAttribute('data-notifications-view') || 'unread').trim().toLowerCase();
      b.classList.toggle('is-active', raw === v);
    });
  }

  function updateNotificationsReadRecycleBarVisibility() {
    var row = document.getElementById('rpbdd-notifications-read-toolbar-row');
    var onReadTab = String(state.notificationsModalView || 'unread').toLowerCase() === 'read';
    if (row) {
      row.hidden = !onReadTab;
      row.style.display = onReadTab ? 'flex' : 'none';
      row.setAttribute('aria-hidden', onReadTab ? 'false' : 'true');
    }
    var openBtn = document.getElementById('rpbdd-open-notifications-read-recycle');
    if (openBtn) openBtn.setAttribute('aria-hidden', onReadTab ? 'false' : 'true');
    var markAllModal = document.getElementById('rpbdd-mark-notifications-read-modal');
    if (markAllModal) {
      var showMarkAll = !onReadTab;
      markAllModal.hidden = !showMarkAll;
      markAllModal.style.display = showMarkAll ? '' : 'none';
      markAllModal.setAttribute('aria-hidden', showMarkAll ? 'false' : 'true');
    }
  }

  function renderNotificationsModal() {
    var el = document.getElementById('rpbdd-notifications-list');
    if (!el) return;
    var monthLabelEl = document.getElementById('rpbdd-bday-modal-month-label');
    var pd = state.birthdayModalPanelDate;
    if (monthLabelEl && pd) {
      monthLabelEl.textContent = monthNames[pd.getMonth()] + ' ' + pd.getFullYear();
    }
    var cU = document.getElementById('rpbdd-count-notif-unread');
    var cR = document.getElementById('rpbdd-count-notif-read');
    var searchEl = document.getElementById('rpbdd-bday-search');
    var q = String((searchEl && searchEl.value) || '').trim().toLowerCase();
    var panel = state.birthdayModalPanelDate;
    var inMonth = (state.birthdayCelebrants || []).filter(function (x) {
      return birthdayOccurrenceYmdInPanelMonth(x && x.dob, panel) !== '';
    });
    var filtered = inMonth.filter(function (x) {
      if (!q) return true;
      var hay =
        (String((x && x.name) || '') + ' ' + String((x && x.section) || '') + ' ' + String((x && x.position) || ''))
          .toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    var tToday = todayYmd();
    var upcomingList = filtered
      .filter(function (x) {
        var occ = birthdayOccurrenceYmdInPanelMonth(x && x.dob, panel);
        return occ && occ >= tToday;
      })
      .sort(function (a, b) {
        var oca = birthdayOccurrenceYmdInPanelMonth(a && a.dob, panel);
        var ocb = birthdayOccurrenceYmdInPanelMonth(b && b.dob, panel);
        if (oca !== ocb) return oca.localeCompare(ocb);
        return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), undefined, { sensitivity: 'base' });
      });
    var doneList = filtered
      .filter(function (x) {
        var occ = birthdayOccurrenceYmdInPanelMonth(x && x.dob, panel);
        return occ && occ < tToday;
      })
      .sort(function (a, b) {
        var oca = birthdayOccurrenceYmdInPanelMonth(a && a.dob, panel);
        var ocb = birthdayOccurrenceYmdInPanelMonth(b && b.dob, panel);
        if (oca !== ocb) return ocb.localeCompare(oca);
        return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), undefined, { sensitivity: 'base' });
      });
    if (cU) cU.textContent = String(upcomingList.length);
    if (cR) cR.textContent = String(doneList.length);
    var activeView = String(state.birthdayModalView || 'upcoming').toLowerCase() === 'done' ? 'done' : 'upcoming';
    document.querySelectorAll('[data-birthday-view]').forEach(function (btn) {
      btn.classList.toggle('is-active', String(btn.getAttribute('data-birthday-view') || '') === activeView);
    });
    var list = activeView === 'done' ? doneList : upcomingList;
    if (!list.length) {
      var pm = panel ? panel.getMonth() : 0;
      var monthTitle = panel ? monthNames[pm] + ' ' + panel.getFullYear() : '';
      if (inMonth.length === 0 && !q) {
      el.innerHTML =
          '<div class="rpbdd-placeholder"><p>No birthday celebrants in ' + escapeHtml(monthTitle) + '</p></div>';
    } else {
        el.innerHTML =
          '<div class="rpbdd-placeholder"><p>No ' +
          (activeView === 'done' ? 'done' : 'upcoming') +
          ' birthday celebrants match your filter for ' +
          escapeHtml(monthTitle) +
          '</p></div>';
      }
      return;
    }
    el.innerHTML = list
      .map(function (x) {
        return birthdayCardHtml(x, q);
        })
        .join('');
    el.querySelectorAll('[data-expand-bday-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        var id = String(node.getAttribute('data-expand-bday-id') || '');
        state.expandedBirthdayId = state.expandedBirthdayId === id ? null : id;
        renderNotificationsModal();
      });
      node.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        node.click();
      });
    });
    el.querySelectorAll('[data-bday-edit]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = String(btn.getAttribute('data-bday-edit') || '');
        var hit = (state.birthdayCelebrants || []).find(function (x) {
          return String(x.id || '') === id;
        });
        if (!hit) return;
        state.editingBirthdayId = id;
        var title = document.querySelector('#modal-add-birthday h2');
        if (title) title.textContent = 'Edit Birthday Celebrant';
        var saveBtn = document.getElementById('rpbdd-save-add-birthday');
        if (saveBtn) saveBtn.textContent = 'Update';
        var nameEl = document.getElementById('birthday-name');
        var dobEl = document.getElementById('birthday-dob');
        if (nameEl) nameEl.value = String(hit.name || '');
        if (dobEl) dobEl.value = normalizeBirthdayYmd(hit.dob);
        renderBirthdaySelectOptions();
        setBirthdayDropdownValue('position', String(hit.position || ''));
        setBirthdayDropdownValue('section', String(hit.section || ''));
        var fileEl = document.getElementById('birthday-photo');
        if (fileEl) fileEl.value = '';
        renderBirthdayPhotoAvatar(String(hit.photo || ''), String(hit.name || ''));
        openModal('modal-add-birthday');
      });
    });
    el.querySelectorAll('[data-bday-delete]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = String(btn.getAttribute('data-bday-delete') || '');
        var hit = (state.birthdayCelebrants || []).find(function (x) {
          return String(x.id || '') === id;
        });
        if (!hit) return;
        var nameLabel = String(hit.name || 'This record');
        openRpbddConfirm({
          variant: 'delete',
          confirmUiSource: 'notifications',
          title: 'Delete birthday celebrant?',
          message: '“' + nameLabel + '” will be removed. This cannot be undone.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          var base = getBirthdaysApiBase();
          if (base) {
            fetch(base + '/' + encodeURIComponent(id), {
              method: 'DELETE',
              credentials: 'same-origin',
              headers: { Accept: 'application/json' },
            })
              .then(parseEventsApiResponse)
              .then(function (parsed) {
                var j = parsed.data;
                if (!j || !j.ok) {
                  rpbddAlertMessage(formatEventsApiError(parsed));
                  return;
                }
                state.birthdayCelebrants = (state.birthdayCelebrants || []).filter(function (x) {
                  return String(x.id || '') !== id;
                });
                saveBirthdayCelebrants();
                renderNotificationsModal();
                render();
              })
              .catch(function () {
                rpbddAlertMessage('Network error — could not reach the server');
              });
            return;
          }
          state.birthdayCelebrants = (state.birthdayCelebrants || []).filter(function (x) {
            return String(x.id || '') !== id;
          });
          saveBirthdayCelebrants();
          renderNotificationsModal();
          render();
        });
      });
    });
  }

  function renderNotificationWidgetPreview() {
    var el = document.getElementById('rpbdd-notif-preview-list');
    if (!el) return;
    var all = state.birthdayCelebrants || [];
    var list = all.filter(birthdayUpcomingInViewedMonth).slice().sort(function (a, b) {
      var da = daysUntilBirthday(a && a.dob);
      var db = daysUntilBirthday(b && b.dob);
      if (da !== db) return da - db;
      return String((a && a.name) || '').localeCompare(String((b && b.name) || ''), undefined, { sensitivity: 'base' });
    });
    if (!list.length) {
      el.className = 'rpbdd-placeholder rpbdd-placeholder--dashed';
      el.innerHTML = all.length ? 'No upcoming birthdays this month' : 'No birthday celebrants yet';
      return;
    }
    var top = list.slice(0, 4);
    var html = top
      .map(function (b) {
        var days = daysUntilBirthday(b.dob);
        var when = birthdayBadgeText(days) + ' · ' + formatBirthdayLong(b.dob);
        var col = birthdayAccentColorForTheme();
        return (
          '<button type="button" class="rpbdd-month-event-item rpbdd-month-event-item--sidebar rpbdd-month-event-item--birthday" data-open-profile-notif-id="' +
          encodeURIComponent(b.id || '') +
          '" style="border-left:3px solid ' +
          col +
          ';">' +
          '<span class="rpbdd-month-event-dot" style="background:' +
          col +
          '"></span>' +
          '<div class="rpbdd-month-event-body">' +
          '<strong class="rpbdd-month-event-title">' +
          escapeHtml(b.name || 'Birthday Celebrant') +
          '</strong>' +
          '<span class="rpbdd-month-event-meta">' +
          escapeHtml((b.position || '—') + ' · ' + (b.section || '—')) +
          '</span>' +
          '<span class="rpbdd-month-event-meta">' +
          escapeHtml(when || '—') +
          '</span></div></button>'
        );
      })
      .join('');
    el.className = 'rpbdd-widget-body rpbdd-widget-body--month-events';
    el.innerHTML = html;
    el.querySelectorAll('[data-open-profile-notif-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var d = state.currentDate;
        state.birthdayModalPanelDate = new Date(d.getFullYear(), d.getMonth(), 1);
        renderNotificationsModal();
        openModal('modal-notifications');
      });
    });
  }

  function markVisibleNotificationsReadForCurrentRole() {
    var role = currentUserRole();
    if (!role) return;
    var base = getProfileNotificationsApiBase();
    if (base && (role === 'admin' || role === 'team_leader' || role === 'member' || role === 'user')) {
      fetch(base + '/mark-read', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
        .catch(function () {
          /* ignore */
        })
        .then(function () {
          return refreshProfileNotificationsFromApi();
        })
        .finally(function () {
          var changed = false;
          (state.notifications || []).forEach(function (n) {
            if (!roleCanSeeProfileNotif(n, role)) return;
            if (n.source === 'server') return;
            if (!n.readByRoles || typeof n.readByRoles !== 'object') n.readByRoles = {};
            if (role === 'member' || role === 'user') {
              if (n.readByRoles.member === true) return;
              n.readByRoles.member = true;
            } else {
              if (n.readByRoles[role] === true) return;
              n.readByRoles[role] = true;
            }
            changed = true;
          });
          if (changed) persistProfileNotifications();
          refreshNotificationBadgeCount();
          renderNotificationWidgetPreview();
          renderNotificationsModal();
        });
      return;
    }
    var changed = false;
    (state.notifications || []).forEach(function (n) {
      if (!roleCanSeeProfileNotif(n, role)) return;
      if (!n.readByRoles || typeof n.readByRoles !== 'object') n.readByRoles = {};
      if (role === 'member' || role === 'user') {
        if (n.readByRoles.member === true) return;
        n.readByRoles.member = true;
      } else {
        if (n.readByRoles[role] === true) return;
        n.readByRoles[role] = true;
      }
      changed = true;
    });
    if (changed) {
      persistProfileNotifications();
    }
    refreshNotificationBadgeCount();
  }

  function profileNotifRecycleTitleFromSnapshot(notif) {
    var t = notif && notif.title != null ? String(notif.title).trim() : '';
    return t || 'This notification';
  }

  function findProfileNotificationById(nid) {
    var id = String(nid || '');
    return (state.notifications || []).find(function (n) {
      return n && String(n.id) === id;
    });
  }

  function moveProfileReadNotificationToRecycleByEncodedId(enc) {
    var role = currentUserRole();
    var id = decodeURIComponent(enc || '');
    if (!role || !id) return;
    var n = findProfileNotificationById(id);
    if (!n || !roleCanSeeProfileNotif(n, role)) return;
    if (profileNotificationIsUnread(n, role)) return;
    var title = profileNotifRecycleTitleFromSnapshot(n);
    openRpbddConfirm({
      variant: 'remove',
      confirmUiSource: 'notifications',
      title: 'Move to Recycle Bin?',
      message:
        '“' +
        title +
        '” goes to the Read notifications Recycle Bin. Restore or delete it there anytime.',
      confirmLabel: 'Move to bin',
      cancelLabel: 'Keep',
      danger: false,
    }).then(function (ok) {
      if (!ok) return;
      var dup = (state.profileNotifRecycle || []).some(function (e) {
        return e && String(e.sourceId) === String(n.id);
      });
      if (dup) return;
      var snap;
      try {
        snap = JSON.parse(JSON.stringify(n));
      } catch (e) {
        snap = Object.assign({}, n);
      }
      state.profileNotifRecycle.push({
        sourceId: String(n.id),
        serverNumericId: parseInt(String(n.serverNumericId || 0), 10) || 0,
        movedAt: new Date().toISOString(),
        snapshot: snap,
      });
      state.notifications = (state.notifications || []).filter(function (x) {
        return !x || String(x.id) !== String(n.id);
      });
      if (String(n.source || '') !== 'server') {
        persistProfileNotifications();
      }
      saveProfileNotifRecycle();
      state.expandedNotificationId = null;
      renderNotificationsModal();
      renderNotificationWidgetPreview();
      refreshNotificationBadgeCount();
    });
  }

  function restoreProfileNotifRecycleEntryAt(idx) {
    var arr = state.profileNotifRecycle || [];
    if (idx < 0 || idx >= arr.length) return;
    var entry = arr.splice(idx, 1)[0];
    saveProfileNotifRecycle();
    if (entry && entry.snapshot && String(entry.snapshot.source || '') !== 'server') {
      (state.notifications = state.notifications || []).push(entry.snapshot);
      persistProfileNotifications();
    }
    state.expandedProfileNotifReadRecycleKey = null;
    renderProfileNotificationsReadRecycle();
    refreshProfileNotificationsFromApi().finally(function () {
      renderNotificationsModal();
      renderNotificationWidgetPreview();
      refreshNotificationBadgeCount();
    });
  }

  function purgeProfileNotifRecycleEntryAt(idx) {
    var arr = state.profileNotifRecycle || [];
    if (idx < 0 || idx >= arr.length) return;
    var entry = arr.splice(idx, 1)[0];
    saveProfileNotifRecycle();
    var srv = entry && parseInt(String(entry.serverNumericId || 0), 10) || 0;
    if (entry && entry.snapshot && String(entry.snapshot.source || '') === 'server' && srv > 0) {
      if ((state.profileNotifPurgedServerIds || []).indexOf(srv) < 0) {
        state.profileNotifPurgedServerIds.push(srv);
        saveProfileNotifPurged();
      }
    }
    state.expandedProfileNotifReadRecycleKey = null;
    renderProfileNotificationsReadRecycle();
    refreshProfileNotificationsFromApi().finally(function () {
      renderNotificationsModal();
      renderNotificationWidgetPreview();
      refreshNotificationBadgeCount();
    });
  }

  function restoreAllProfileNotifRecycle() {
    (state.profileNotifRecycle || []).forEach(function (entry) {
      if (!entry || !entry.snapshot) return;
      if (String(entry.snapshot.source || '') !== 'server') {
        (state.notifications = state.notifications || []).push(entry.snapshot);
      }
    });
    state.profileNotifRecycle = [];
    saveProfileNotifRecycle();
    persistProfileNotifications();
    state.expandedProfileNotifReadRecycleKey = null;
    renderProfileNotificationsReadRecycle();
    refreshProfileNotificationsFromApi().finally(function () {
      renderNotificationsModal();
      renderNotificationWidgetPreview();
      refreshNotificationBadgeCount();
    });
  }

  function purgeAllProfileNotifRecycle() {
    var purged = state.profileNotifPurgedServerIds || [];
    (state.profileNotifRecycle || []).forEach(function (entry) {
      if (!entry || !entry.snapshot) return;
      var srv = parseInt(String(entry.serverNumericId || entry.snapshot.serverNumericId || 0), 10) || 0;
      if (String(entry.snapshot.source || '') === 'server' && srv > 0 && purged.indexOf(srv) < 0) {
        purged.push(srv);
      }
    });
    state.profileNotifPurgedServerIds = purged;
    saveProfileNotifPurged();
    state.profileNotifRecycle = [];
    saveProfileNotifRecycle();
    state.expandedProfileNotifReadRecycleKey = null;
    renderProfileNotificationsReadRecycle();
    refreshProfileNotificationsFromApi().finally(function () {
      renderNotificationsModal();
      renderNotificationWidgetPreview();
      refreshNotificationBadgeCount();
    });
  }

  function loadStorage() {
    try {
      eventCategories = loadEventCategoriesFromDisk();
      /* Shared multi-user mode: events come only from the API (same rows for everyone). */
      if (getEventsApiBase()) {
        state.events = [];
      } else {
      var rawEv = JSON.parse(localStorage.getItem(LS_EVENTS) || '[]');
      state.events = Array.isArray(rawEv)
        ? rawEv.filter(function (e) {
            return e && !e.isHoliday && !e.fromDb;
          })
        : [];
      }
      if (getEventsApiBase()) {
        state.deletedEvents = [];
      } else {
      var rawDel = JSON.parse(localStorage.getItem(LS_DELETED) || '[]');
      state.deletedEvents = Array.isArray(rawDel)
        ? rawDel.filter(function (e) {
            return e && e.kind !== 'dbRecycle';
          })
        : [];
      }
      if (getTeamsApiBase()) {
        state.teams = [];
      } else {
        state.teams = JSON.parse(localStorage.getItem(LS_TEAMS) || '[]');
        if (!Array.isArray(state.teams)) state.teams = [];
        state.teams.forEach(function (t) {
          if (t && t.leadId == null && t.idNumber != null) t.leadId = t.idNumber;
          if (t && t.passwordPlain == null && t.password && String(t.password) !== '••••••••') {
            t.passwordPlain = String(t.password);
          }
        });
      }
      if (getTeamsApiBase()) {
        state.deletedTeams = [];
      } else {
        var rawDt = JSON.parse(localStorage.getItem(LS_DELETED_TEAMS) || '[]');
        state.deletedTeams = Array.isArray(rawDt) ? rawDt : [];
      }
      if (getMembersApiBase()) {
        state.teamMembers = [];
        state.deletedMembers = [];
      } else {
        state.teamMembers = JSON.parse(localStorage.getItem(LS_MEMBERS) || '[]');
        if (!Array.isArray(state.teamMembers)) state.teamMembers = [];
        var rawDm = JSON.parse(localStorage.getItem(LS_DELETED_MEMBERS) || '[]');
        state.deletedMembers = Array.isArray(rawDm) ? rawDm : [];
      }
      var rawNotif = JSON.parse(localStorage.getItem(LS_PROFILE_NOTIFS) || '[]');
      state.notifications = Array.isArray(rawNotif) ? rawNotif : [];
      var rawNR = JSON.parse(localStorage.getItem(LS_PROFILE_NOTIF_RECYCLE) || '[]');
      state.profileNotifRecycle = Array.isArray(rawNR)
        ? rawNR.filter(function (e) {
            return e && e.sourceId != null && e.snapshot;
          })
        : [];
      var rawNP = JSON.parse(localStorage.getItem(LS_PROFILE_NOTIF_PURGED) || '[]');
      state.profileNotifPurgedServerIds = Array.isArray(rawNP)
        ? rawNP
            .map(function (x) {
              return parseInt(String(x), 10) || 0;
            })
            .filter(function (n) {
              return n > 0;
            })
        : [];
      if (birthdaysApiBase) {
        state.birthdayCelebrants = [];
      } else {
        var rawBirthdays = JSON.parse(localStorage.getItem(LS_BIRTHDAY_CELEBRANTS) || '[]');
        state.birthdayCelebrants = Array.isArray(rawBirthdays) ? rawBirthdays : [];
      }
      var rawBirthdayPos = JSON.parse(localStorage.getItem(LS_BIRTHDAY_POSITIONS) || '[]');
      var rawBirthdaySec = JSON.parse(localStorage.getItem(LS_BIRTHDAY_SECTIONS) || '[]');
      state.birthdayPositions = normalizeBirthdayPositionsFromStorage(Array.isArray(rawBirthdayPos) ? rawBirthdayPos : []);
      state.birthdaySections = Array.isArray(rawBirthdaySec) && rawBirthdaySec.length
        ? rawBirthdaySec
        : defaultBirthdaySectionsFromLegend();
    } catch (e) {
      eventCategories = [];
      state.events = [];
      state.deletedEvents = [];
      state.teams = [];
      state.deletedTeams = [];
      state.teamMembers = [];
      state.deletedMembers = [];
      state.notifications = [];
      state.profileNotifRecycle = [];
      state.profileNotifPurgedServerIds = [];
      state.birthdayCelebrants = [];
      state.birthdayPositions = normalizeBirthdayPositionsFromStorage([]);
      state.birthdaySections = defaultBirthdaySectionsFromLegend();
    }
  }

  function saveEvents() {
    var legacy = state.events.filter(function (e) {
      return !e.isHoliday && !e.fromDb;
    });
    localStorage.setItem(LS_EVENTS, JSON.stringify(legacy));
  }

  function saveDeleted() {
    if (getEventsApiBase()) return;
    var persist = state.deletedEvents.filter(function (e) {
      return e.kind !== 'dbRecycle';
    });
    localStorage.setItem(LS_DELETED, JSON.stringify(persist));
  }

  function saveTeams() {
    if (getTeamsApiBase()) return;
    localStorage.setItem(LS_TEAMS, JSON.stringify(state.teams));
  }

  function saveDeletedTeams() {
    if (getTeamsApiBase()) return;
    localStorage.setItem(LS_DELETED_TEAMS, JSON.stringify(state.deletedTeams));
  }

  function saveMembers() {
    if (getMembersApiBase()) return;
    localStorage.setItem(LS_MEMBERS, JSON.stringify(state.teamMembers));
  }

  function saveDeletedMembers() {
    if (getMembersApiBase()) return;
    localStorage.setItem(LS_DELETED_MEMBERS, JSON.stringify(state.deletedMembers));
  }

  function saveProfileNotifRecycle() {
    try {
      localStorage.setItem(LS_PROFILE_NOTIF_RECYCLE, JSON.stringify(state.profileNotifRecycle || []));
    } catch (e) {
      /* ignore */
    }
  }

  function saveProfileNotifPurged() {
    try {
      localStorage.setItem(LS_PROFILE_NOTIF_PURGED, JSON.stringify(state.profileNotifPurgedServerIds || []));
    } catch (e) {
      /* ignore */
    }
  }

  function readDdList(key) {
    try {
      var a = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function writeDdList(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  }

  /** Merge dropdown-only options with values already used on teams (for display). */
  function getMergedSectionOptions() {
    var set = {};
    readDdList(LS_DD_SECTION).forEach(function (x) {
      if (x != null && String(x).trim() !== '') set[String(x).trim()] = true;
    });
    state.teams.forEach(function (t) {
      if (t && t.sectionTeam != null && String(t.sectionTeam).trim() !== '') {
        set[String(t.sectionTeam).trim()] = true;
      }
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }

  function getMergedPositionOptions() {
    var set = {};
    readDdList(LS_DD_POSITION).forEach(function (x) {
      if (x != null && String(x).trim() !== '') set[String(x).trim()] = true;
    });
    state.teams.forEach(function (t) {
      if (t && t.position != null && String(t.position).trim() !== '') {
        set[String(t.position).trim()] = true;
      }
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }

  /** Map a saved position string to an entry in getMergedPositionOptions() (exact or case-insensitive). */
  function resolvePositionInMergedList(prev) {
    var p = prev != null ? String(prev).trim() : '';
    if (!p) return '';
    var opts = getMergedPositionOptions();
    var i;
    for (i = 0; i < opts.length; i++) {
      if (opts[i] === p) return opts[i];
    }
    var pl = p.toLowerCase();
    for (i = 0; i < opts.length; i++) {
      if (opts[i].toLowerCase() === pl) return opts[i];
    }
    return '';
  }

  var TEAM_DD_SECTION_PLACEHOLDER = 'Select section team…';
  var TEAM_DD_POSITION_PLACEHOLDER = 'Select position…';
  var MEMBER_TEAM_DD_PLACEHOLDER = 'Select team…';
  var MEMBER_TEAM_DD_EMPTY = 'No teams in Total Teams yet';

  function clearTeamDdMenuLayout(menu) {
    if (!menu) return;
    menu.style.position = '';
    menu.style.left = '';
    menu.style.top = '';
    menu.style.width = '';
    menu.style.maxHeight = '';
    menu.style.zIndex = '';
  }

  function positionTeamDdMenu(menu, trigger) {
    if (!menu || !trigger) return;
    var r = trigger.getBoundingClientRect();
    var gap = 4;
    var maxH = window.innerHeight - r.bottom - gap - 16;
    if (maxH < 140) maxH = 140;
    if (maxH > 320) maxH = 320;
    menu.style.position = 'fixed';
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.top = Math.round(r.bottom + gap) + 'px';
    menu.style.width = Math.round(r.width) + 'px';
    menu.style.maxHeight = maxH + 'px';
    menu.style.zIndex = '10100';
  }

  function closeTeamSectionMenu() {
    var menu = document.getElementById('team-section-menu');
    var tr = document.getElementById('team-section-trigger');
    if (menu) {
      menu.hidden = true;
      clearTeamDdMenuLayout(menu);
    }
    if (tr) {
      tr.setAttribute('aria-expanded', 'false');
      tr.classList.remove('is-open');
    }
  }

  function closeTeamPositionMenu() {
    var menu = document.getElementById('team-position-menu');
    var tr = document.getElementById('team-position-trigger');
    if (menu) {
      menu.hidden = true;
      clearTeamDdMenuLayout(menu);
    }
    if (tr) {
      tr.setAttribute('aria-expanded', 'false');
      tr.classList.remove('is-open');
    }
  }

  function toggleTeamSectionMenu() {
    var menu = document.getElementById('team-section-menu');
    var tr = document.getElementById('team-section-trigger');
    if (!menu || !tr) return;
    var opening = menu.hidden;
    closeTeamPositionMenu();
    if (!opening) {
      closeTeamSectionMenu();
      return;
    }
    positionTeamDdMenu(menu, tr);
    menu.hidden = false;
    tr.setAttribute('aria-expanded', 'true');
    tr.classList.add('is-open');
  }

  function toggleTeamPositionMenu() {
    var menu = document.getElementById('team-position-menu');
    var tr = document.getElementById('team-position-trigger');
    if (!menu || !tr) return;
    var opening = menu.hidden;
    closeTeamSectionMenu();
    if (!opening) {
      closeTeamPositionMenu();
      return;
    }
    positionTeamDdMenu(menu, tr);
    menu.hidden = false;
    tr.setAttribute('aria-expanded', 'true');
    tr.classList.add('is-open');
  }

  function setTeamSectionValue(val) {
    var hid = document.getElementById('team-section');
    var txt = document.getElementById('team-section-trigger-text');
    var tr = document.getElementById('team-section-trigger');
    var v = val != null ? String(val).trim() : '';
    if (hid) hid.value = v;
    if (txt) txt.textContent = v ? v : TEAM_DD_SECTION_PLACEHOLDER;
    if (tr) tr.classList.toggle('is-placeholder', !v);
    document.querySelectorAll('#team-section-options .rpbdd-custom-dd-option').forEach(function (el) {
      el.classList.toggle('is-selected', el.dataset.value === v);
    });
  }

  function setTeamPositionValue(val) {
    var hid = document.getElementById('team-position');
    var txt = document.getElementById('team-position-trigger-text');
    var tr = document.getElementById('team-position-trigger');
    var v = val != null ? String(val).trim() : '';
    if (hid) hid.value = v;
    if (txt) txt.textContent = v ? v : TEAM_DD_POSITION_PLACEHOLDER;
    if (tr) tr.classList.toggle('is-placeholder', !v);
    document.querySelectorAll('#team-position-options .rpbdd-custom-dd-option').forEach(function (el) {
      el.classList.toggle('is-selected', el.dataset.value === v);
    });
  }

  function populateTeamSectionSelect(preserveValue) {
    var hid = document.getElementById('team-section');
    var wrap = document.getElementById('team-section-options');
    if (!hid || !wrap) return;
    var prev = preserveValue !== undefined ? preserveValue : hid.value;
    wrap.innerHTML = '';
    getMergedSectionOptions().forEach(function (text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rpbdd-custom-dd-option';
      b.setAttribute('role', 'option');
      b.dataset.value = text;
      b.textContent = text;
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        setTeamSectionValue(text);
        closeTeamSectionMenu();
      });
      wrap.appendChild(b);
    });
    if (prev && getMergedSectionOptions().indexOf(prev) !== -1) {
      setTeamSectionValue(prev);
    } else {
      setTeamSectionValue('');
    }
    var sm = document.getElementById('team-section-menu');
    var st = document.getElementById('team-section-trigger');
    if (sm && !sm.hidden && st) positionTeamDdMenu(sm, st);
  }

  function populateTeamPositionSelect(preserveValue) {
    var hid = document.getElementById('team-position');
    var wrap = document.getElementById('team-position-options');
    if (!hid || !wrap) return;
    var prev = preserveValue !== undefined ? preserveValue : hid.value;
    wrap.innerHTML = '';
    getMergedPositionOptions().forEach(function (text) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rpbdd-custom-dd-option';
      b.setAttribute('role', 'option');
      b.dataset.value = text;
      b.textContent = text;
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        setTeamPositionValue(text);
        closeTeamPositionMenu();
      });
      wrap.appendChild(b);
    });
    if (prev && getMergedPositionOptions().indexOf(prev) !== -1) {
      setTeamPositionValue(prev);
    } else {
      setTeamPositionValue('');
    }
    var pm = document.getElementById('team-position-menu');
    var pt = document.getElementById('team-position-trigger');
    if (pm && !pm.hidden && pt) positionTeamDdMenu(pm, pt);
  }

  function closeMemberTeamMenu() {
    var menu = document.getElementById('member-team-menu');
    var tr = document.getElementById('member-team-trigger');
    if (menu) {
      menu.hidden = true;
      clearTeamDdMenuLayout(menu);
    }
    if (tr) {
      tr.setAttribute('aria-expanded', 'false');
      tr.classList.remove('is-open');
    }
  }

  function closeMemberPositionMenu() {
    var menu = document.getElementById('member-position-menu');
    var tr = document.getElementById('member-position-trigger');
    if (menu) {
      menu.hidden = true;
      clearTeamDdMenuLayout(menu);
    }
    if (tr) {
      tr.setAttribute('aria-expanded', 'false');
      tr.classList.remove('is-open');
    }
  }

  function toggleMemberTeamMenu() {
    if (!state.teams || state.teams.length === 0) return;
    var menu = document.getElementById('member-team-menu');
    var tr = document.getElementById('member-team-trigger');
    if (!menu || !tr || tr.disabled) return;
    var opening = menu.hidden;
    closeMemberPositionMenu();
    if (!opening) {
      closeMemberTeamMenu();
      return;
    }
    positionTeamDdMenu(menu, tr);
    menu.hidden = false;
    tr.setAttribute('aria-expanded', 'true');
    tr.classList.add('is-open');
  }

  function toggleMemberPositionMenu() {
    var menu = document.getElementById('member-position-menu');
    var tr = document.getElementById('member-position-trigger');
    if (!menu || !tr) return;
    var opening = menu.hidden;
    closeMemberTeamMenu();
    if (!opening) {
      closeMemberPositionMenu();
      return;
    }
    positionTeamDdMenu(menu, tr);
    menu.hidden = false;
    tr.setAttribute('aria-expanded', 'true');
    tr.classList.add('is-open');
  }

  function setMemberTeamValue(teamId, displayLabel) {
    var hid = document.getElementById('member-team');
    var txt = document.getElementById('member-team-trigger-text');
    var tr = document.getElementById('member-team-trigger');
    var id = teamId != null ? String(teamId).trim() : '';
    if (hid) hid.value = id;
    var label = displayLabel != null ? String(displayLabel).trim() : '';
    if (txt) {
      if (id) txt.textContent = label || id;
      else if (!state.teams || state.teams.length === 0) txt.textContent = MEMBER_TEAM_DD_EMPTY;
      else txt.textContent = MEMBER_TEAM_DD_PLACEHOLDER;
    }
    if (tr) {
      tr.classList.toggle('is-placeholder', !id);
      tr.disabled = !state.teams || state.teams.length === 0;
    }
    document.querySelectorAll('#member-team-options .rpbdd-custom-dd-option').forEach(function (el) {
      el.classList.toggle('is-selected', el.dataset.value === id);
    });
  }

  function setMemberPositionValue(val) {
    var hid = document.getElementById('member-position');
    var txt = document.getElementById('member-position-trigger-text');
    var tr = document.getElementById('member-position-trigger');
    var v = val != null ? String(val).trim() : '';
    if (hid) hid.value = v;
    if (txt) txt.textContent = v ? v : TEAM_DD_POSITION_PLACEHOLDER;
    if (tr) tr.classList.toggle('is-placeholder', !v);
    document.querySelectorAll('#member-position-options .rpbdd-custom-dd-option').forEach(function (el) {
      el.classList.toggle('is-selected', el.dataset.value === v);
    });
  }

  function populateMemberTeamFromState(preserveTeamId) {
    var hid = document.getElementById('member-team');
    var wrap = document.getElementById('member-team-options');
    if (!hid || !wrap) return;
    var prev = preserveTeamId !== undefined ? String(preserveTeamId) : hid.value;
    wrap.innerHTML = '';
    var list = (state.teams || []).slice().sort(function (a, b) {
      var sa = String((a && a.sectionTeam) || (a && a.teamLeader) || '').toLowerCase();
      var sb = String((b && b.sectionTeam) || (b && b.teamLeader) || '').toLowerCase();
      return sa.localeCompare(sb);
    });
    if (currentUserRole() === 'team_leader') {
      var sec = String(
        (state.currentUser && (state.currentUser.sectionTeam || state.currentUser.team)) || '',
      )
        .trim()
        .toLowerCase();
      if (sec) {
        list = list.filter(function (t) {
          var ts = String((t && t.sectionTeam) || '').trim().toLowerCase();
          return ts === sec;
        });
      }
    }
    list.forEach(function (t) {
      if (!t) return;
      var tid = String(t.id);
      var label = String(
        (t.sectionTeam || '').trim() || (t.teamLeader || '').trim() || 'Team ' + tid,
      );
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rpbdd-custom-dd-option';
      b.setAttribute('role', 'option');
      b.dataset.value = tid;
      b.dataset.label = label;
      b.textContent = label;
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        setMemberTeamValue(tid, label);
        closeMemberTeamMenu();
      });
      wrap.appendChild(b);
    });
    var still =
      prev &&
      list.some(function (t) {
        return String(t.id) === String(prev);
      });
    if (still) {
      var t = state.teams.find(function (x) {
        return String(x.id) === String(prev);
      });
      setMemberTeamValue(
        prev,
        t ? String((t.sectionTeam || '').trim() || (t.teamLeader || '').trim() || prev) : '',
      );
    } else {
      setMemberTeamValue('', '');
    }
    var mm = document.getElementById('member-team-menu');
    var mt = document.getElementById('member-team-trigger');
    if (mm && !mm.hidden && mt) positionTeamDdMenu(mm, mt);
  }

  function populateMemberPositionSelect(preserveValue) {
    var hid = document.getElementById('member-position');
    var wrap = document.getElementById('member-position-options');
    if (!hid || !wrap) return;
    var prevRaw = preserveValue !== undefined ? preserveValue : hid.value;
    var prev = prevRaw != null ? String(prevRaw).trim() : '';

    function fillMemberPositionOptionButtons() {
      wrap.innerHTML = '';
      getMergedPositionOptions().forEach(function (text) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'rpbdd-custom-dd-option';
        b.setAttribute('role', 'option');
        b.dataset.value = text;
        b.textContent = text;
        b.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          setMemberPositionValue(text);
          closeMemberPositionMenu();
        });
        wrap.appendChild(b);
      });
    }

    fillMemberPositionOptionButtons();
    var valueToSet = '';
    if (prev) {
      valueToSet = resolvePositionInMergedList(prev);
      if (!valueToSet) {
        appendDdOnlyPosition(prev);
        fillMemberPositionOptionButtons();
        valueToSet = resolvePositionInMergedList(prev) || prev;
      }
    }
    setMemberPositionValue(valueToSet);
    var pm = document.getElementById('member-position-menu');
    var pt = document.getElementById('member-position-trigger');
    if (pm && !pm.hidden && pt) positionTeamDdMenu(pm, pt);
  }

  function appendDdOnlySection(name) {
    var v = String(name).trim();
    if (!v) return;
    var list = readDdList(LS_DD_SECTION);
    if (list.indexOf(v) === -1) {
      list.push(v);
      writeDdList(LS_DD_SECTION, list);
    }
  }

  function appendDdOnlyPosition(name) {
    var v = String(name).trim();
    if (!v) return;
    var list = readDdList(LS_DD_POSITION);
    if (list.indexOf(v) === -1) {
      list.push(v);
      writeDdList(LS_DD_POSITION, list);
    }
  }

  function teamLeadId(t) {
    if (!t) return '';
    if (t.leadId != null && String(t.leadId).trim() !== '') return String(t.leadId).trim();
    if (t.idNumber != null && String(t.idNumber).trim() !== '') return String(t.idNumber).trim();
    return '';
  }

  /** Members cell: comma-separated names or "None" (HTML-safe). */
  function formatTeamMembersListHtml(team) {
    if (team && Array.isArray(team.memberNames) && team.memberNames.length > 0) {
      return team.memberNames
        .map(function (n) {
          return escapeHtml(String(n));
        })
        .join(', ');
    }
    return 'None';
  }

  /** Match member row to Total Teams record (by synthetic leader-* id or member.team label). */
  function resolveTeamRecordForMember(m) {
    if (!m) return null;
    var lid = String(m.id || '');
    if (lid.indexOf('leader-') === 0) {
      var tid = lid.slice('leader-'.length);
      var byId = state.teams.find(function (x) {
        return String(x.id) === String(tid);
      });
      return byId || null;
    }
    var teamLabel = String(m.team || '').trim();
    if (!teamLabel) return null;
    var found = null;
    (state.teams || []).forEach(function (t) {
      var label = String((t.sectionTeam || '').trim() || (t.teamLeader || '').trim());
      if (label === teamLabel) found = t;
    });
    return found;
  }

  function bindTeamCustomDropdowns() {
    document.getElementById('team-section-trigger')?.addEventListener('click', function (e) {
      e.preventDefault();
      toggleTeamSectionMenu();
    });
    document.getElementById('team-position-trigger')?.addEventListener('click', function (e) {
      e.preventDefault();
      toggleTeamPositionMenu();
    });

    document.addEventListener(
      'click',
      function (e) {
        if (e.target.closest('#team-section-dd')) return;
        closeTeamSectionMenu();
      },
      true,
    );
    document.addEventListener(
      'click',
      function (e) {
        if (e.target.closest('#team-position-dd')) return;
        closeTeamPositionMenu();
      },
      true,
    );

    function onDdRepositionOrClose() {
      var sm = document.getElementById('team-section-menu');
      var pm = document.getElementById('team-position-menu');
      var st = document.getElementById('team-section-trigger');
      var pt = document.getElementById('team-position-trigger');
      if (sm && !sm.hidden && st) positionTeamDdMenu(sm, st);
      if (pm && !pm.hidden && pt) positionTeamDdMenu(pm, pt);
      var mm = document.getElementById('member-team-menu');
      var mp = document.getElementById('member-position-menu');
      var mt = document.getElementById('member-team-trigger');
      var mpt = document.getElementById('member-position-trigger');
      if (mm && !mm.hidden && mt) positionTeamDdMenu(mm, mt);
      if (mp && !mp.hidden && mpt) positionTeamDdMenu(mp, mpt);
    }

    window.addEventListener('resize', function () {
      closeTeamSectionMenu();
      closeTeamPositionMenu();
      closeMemberTeamMenu();
      closeMemberPositionMenu();
    });
    window.addEventListener('scroll', onDdRepositionOrClose, true);

    document.addEventListener(
      'keydown',
      function (e) {
        if (e.key !== 'Escape') return;
        var mm = document.getElementById('member-team-menu');
        var mp = document.getElementById('member-position-menu');
        if (mm && !mm.hidden) {
          e.stopPropagation();
          closeMemberTeamMenu();
          return;
        }
        if (mp && !mp.hidden) {
          e.stopPropagation();
          closeMemberPositionMenu();
          return;
        }
        var sm = document.getElementById('team-section-menu');
        var pm = document.getElementById('team-position-menu');
        if (sm && !sm.hidden) {
          e.stopPropagation();
          closeTeamSectionMenu();
          return;
        }
        if (pm && !pm.hidden) {
          e.stopPropagation();
          closeTeamPositionMenu();
        }
      },
      true,
    );
  }

  function bindMemberCustomDropdowns() {
    document.getElementById('member-team-trigger')?.addEventListener('click', function (e) {
      e.preventDefault();
      toggleMemberTeamMenu();
    });
    document.getElementById('member-position-trigger')?.addEventListener('click', function (e) {
      e.preventDefault();
      toggleMemberPositionMenu();
    });
    document.addEventListener(
      'click',
      function (e) {
        if (e.target.closest('#member-team-dd')) return;
        closeMemberTeamMenu();
      },
      true,
    );
    document.addEventListener(
      'click',
      function (e) {
        if (e.target.closest('#member-position-dd')) return;
        closeMemberPositionMenu();
      },
      true,
    );
  }

  function setTeamLeadIdFieldLocked(locked) {
    var lid = document.getElementById('team-lead-id');
    if (!lid) return;
    lid.readOnly = !!locked;
    lid.classList.toggle('rpbdd-input--locked', !!locked);
    if (locked) {
      lid.setAttribute('tabindex', '-1');
      lid.setAttribute('aria-readonly', 'true');
    } else {
      lid.removeAttribute('tabindex');
      lid.removeAttribute('aria-readonly');
    }
  }

  function resetAddTeamForm() {
    ['team-lead-id', 'team-email', 'team-password', 'team-leader'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var tpwReset = document.getElementById('team-password');
    if (tpwReset) tpwReset.type = 'password';
    var pwBtnReset = document.querySelector('[data-toggle-password="team-password"]');
    if (pwBtnReset) {
      var imR = pwBtnReset.querySelector('.rpbdd-toggle-pw__icon--masked');
      var ivR = pwBtnReset.querySelector('.rpbdd-toggle-pw__icon--visible');
      if (imR) imR.hidden = false;
      if (ivR) ivR.hidden = true;
      pwBtnReset.setAttribute('aria-label', 'Show password');
      pwBtnReset.setAttribute('aria-pressed', 'false');
    }
    ['team-section-new', 'team-position-new'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    closeTeamSectionMenu();
    closeTeamPositionMenu();
    populateTeamSectionSelect('');
    populateTeamPositionSelect('');
    var fi = document.getElementById('team-photo');
    if (fi) fi.value = '';
    var av = document.getElementById('team-photo-avatar');
    if (av) av.classList.remove('has-image');
    var prev = document.getElementById('team-photo-preview');
    if (prev) {
      if (prev.dataset.objectUrl) {
        URL.revokeObjectURL(prev.dataset.objectUrl);
        delete prev.dataset.objectUrl;
      }
      prev.removeAttribute('src');
    }
    state.editingTeamId = null;
    var teamModalTitle = document.getElementById('rpbdd-modal-add-team-title');
    if (teamModalTitle) teamModalTitle.textContent = 'Add New Team';
    var teamSaveBtn = document.getElementById('rpbdd-save-team');
    if (teamSaveBtn) teamSaveBtn.textContent = 'Add Team';
    setTeamLeadIdFieldLocked(false);
  }

  function resetMemberForm() {
    state.editingMemberId = null;
    var mTitle = document.getElementById('rpbdd-modal-add-member-title');
    if (mTitle) mTitle.textContent = 'Add New Member';
    var mSave = document.getElementById('rpbdd-save-member');
    if (mSave) mSave.textContent = 'Add Member';
    ['member-email', 'member-password'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var mpw = document.getElementById('member-password');
    if (mpw) mpw.type = 'password';
    var mpwBtn = document.querySelector('[data-toggle-password="member-password"]');
    if (mpwBtn) {
      var imR = mpwBtn.querySelector('.rpbdd-toggle-pw__icon--masked');
      var ivR = mpwBtn.querySelector('.rpbdd-toggle-pw__icon--visible');
      if (imR) imR.hidden = false;
      if (ivR) ivR.hidden = true;
      mpwBtn.setAttribute('aria-label', 'Show password');
      mpwBtn.setAttribute('aria-pressed', 'false');
    }
    closeMemberTeamMenu();
    closeMemberPositionMenu();
    populateMemberTeamFromState('');
    var mfi = document.getElementById('member-photo');
    if (mfi) mfi.value = '';
    var mav = document.getElementById('member-photo-avatar');
    if (mav) mav.classList.remove('has-image');
    var mprev = document.getElementById('member-photo-preview');
    if (mprev) {
      if (mprev.dataset.objectUrl) {
        URL.revokeObjectURL(mprev.dataset.objectUrl);
        delete mprev.dataset.objectUrl;
      }
      mprev.removeAttribute('src');
    }
  }

  function setAccountModalLeaderLayout() {
    var intro = document.getElementById('rpbdd-account-intro-wrap');
    var leader = document.getElementById('rpbdd-account-leader-wrap');
    var mem = document.getElementById('rpbdd-account-member-wrap');
    var adm = document.getElementById('rpbdd-account-admin-wrap');
    var fl = document.getElementById('rpbdd-account-foot-leader');
    var fm = document.getElementById('rpbdd-account-foot-member');
    if (intro) intro.hidden = true;
    if (leader) leader.hidden = false;
    if (mem) mem.hidden = true;
    if (adm) adm.hidden = true;
    if (fl) fl.hidden = false;
    if (fm) fm.hidden = true;
  }

  function setAccountModalMemberLayout() {
    var intro = document.getElementById('rpbdd-account-intro-wrap');
    var leader = document.getElementById('rpbdd-account-leader-wrap');
    var mem = document.getElementById('rpbdd-account-member-wrap');
    var adm = document.getElementById('rpbdd-account-admin-wrap');
    var fl = document.getElementById('rpbdd-account-foot-leader');
    var fm = document.getElementById('rpbdd-account-foot-member');
    if (intro) intro.hidden = true;
    if (leader) leader.hidden = true;
    if (mem) mem.hidden = false;
    if (adm) adm.hidden = true;
    if (fl) fl.hidden = true;
    if (fm) fm.hidden = false;
    var editBtn = document.getElementById('rpbdd-edit-account-member-profile');
    if (editBtn) editBtn.hidden = false;
  }

  function setAccountModalAdminLayout() {
    var intro = document.getElementById('rpbdd-account-intro-wrap');
    var leader = document.getElementById('rpbdd-account-leader-wrap');
    var mem = document.getElementById('rpbdd-account-member-wrap');
    var adm = document.getElementById('rpbdd-account-admin-wrap');
    var fl = document.getElementById('rpbdd-account-foot-leader');
    var fm = document.getElementById('rpbdd-account-foot-member');
    if (intro) intro.hidden = true;
    if (leader) leader.hidden = true;
    if (mem) mem.hidden = true;
    if (adm) adm.hidden = false;
    if (fl) fl.hidden = true;
    if (fm) fm.hidden = true;
  }

  function setAccountModalDefaultLayout() {
    var intro = document.getElementById('rpbdd-account-intro-wrap');
    var leader = document.getElementById('rpbdd-account-leader-wrap');
    var mem = document.getElementById('rpbdd-account-member-wrap');
    var adm = document.getElementById('rpbdd-account-admin-wrap');
    var fl = document.getElementById('rpbdd-account-foot-leader');
    var fm = document.getElementById('rpbdd-account-foot-member');
    if (intro) intro.hidden = false;
    if (leader) leader.hidden = true;
    if (mem) mem.hidden = true;
    if (adm) adm.hidden = true;
    if (fl) fl.hidden = true;
    if (fm) fm.hidden = true;
    state.accountLeaderTeam = null;
    state.accountMemberMember = null;
    resetAccountLeaderForm();
    resetAccountMemberForm();
    resetAccountAdminForm();
  }

  function teamLeaderInitialsFromName(name) {
    var nm = (name != null ? String(name) : '?').trim();
    var initials = nm
      .split(/\s+/)
      .filter(function (x) {
        return x.length > 0;
      })
      .map(function (n) {
        return n[0];
      })
      .join('')
      .toUpperCase()
      .slice(0, 2);
    return initials || '?';
  }

  function setAccountModalPhotoFromTeam(team) {
    var pvw = document.getElementById('account-photo-preview');
    var ava = document.getElementById('account-photo-avatar');
    var initialsEl = document.getElementById('account-photo-initials');
    /** DB truth only (same source as Admin team cards via teams/api). No session fallback — avoids mismatch. */
    var photo = '';
    if (team && team.photo != null && String(team.photo).trim() !== '') {
      photo = String(team.photo);
    }
    if (pvw && pvw.dataset.objectUrl) {
      URL.revokeObjectURL(pvw.dataset.objectUrl);
      delete pvw.dataset.objectUrl;
    }
    if (photo) {
      if (pvw) pvw.src = photo;
      if (ava) {
        ava.classList.add('has-image');
        ava.classList.remove('has-fallback');
      }
      if (initialsEl) {
        initialsEl.textContent = '';
        initialsEl.hidden = true;
        initialsEl.setAttribute('aria-hidden', 'true');
      }
    } else {
      if (pvw) pvw.removeAttribute('src');
      if (ava) {
        ava.classList.remove('has-image');
        ava.classList.add('has-fallback');
      }
      var leaderName = team
        ? firstNonEmptyString(team.teamLeader, team.team_leader, team.Team_Leader)
        : '';
      if (initialsEl) {
        initialsEl.textContent = teamLeaderInitialsFromName(leaderName);
        initialsEl.hidden = false;
        initialsEl.setAttribute('aria-hidden', 'false');
      }
    }
  }

  /** Account Management (readonly): show stored password as plain text when a value exists. */
  function applyAccountViewPasswordPlain(inputId, rawPlain) {
    var pw = document.getElementById(inputId);
    if (!pw) return;
    var plain = rawPlain != null ? String(rawPlain) : '';
    if (plain === '••••••••') plain = '';
    pw.value = plain;
    pw.type = plain ? 'text' : 'password';
    if (typeof window.rpbddSyncPasswordToggles === 'function') {
      var root = pw.closest ? pw.closest('#modal-account') : null;
      window.rpbddSyncPasswordToggles(root || document.getElementById('modal-account'));
    }
  }

  function resetAccountLeaderForm() {
    ['account-lead-id', 'account-email', 'account-password', 'account-team-leader', 'account-section-team'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    var apw = document.getElementById('account-password');
    if (apw) apw.type = 'password';
    var apwBtn = document.querySelector('[data-toggle-password="account-password"]');
    if (apwBtn) {
      var imR = apwBtn.querySelector('.rpbdd-toggle-pw__icon--masked');
      var ivR = apwBtn.querySelector('.rpbdd-toggle-pw__icon--visible');
      if (imR) imR.hidden = false;
      if (ivR) ivR.hidden = true;
      apwBtn.setAttribute('aria-label', 'Show password');
      apwBtn.setAttribute('aria-pressed', 'false');
    }
    var fi = document.getElementById('account-photo');
    if (fi) fi.value = '';
    var av = document.getElementById('account-photo-avatar');
    if (av) {
      av.classList.remove('has-image');
      av.classList.remove('has-fallback');
    }
    var ini = document.getElementById('account-photo-initials');
    if (ini) {
      ini.textContent = '';
      ini.hidden = true;
      ini.setAttribute('aria-hidden', 'true');
    }
    var prev = document.getElementById('account-photo-preview');
    if (prev) {
      if (prev.dataset.objectUrl) {
        URL.revokeObjectURL(prev.dataset.objectUrl);
        delete prev.dataset.objectUrl;
      }
      prev.removeAttribute('src');
    }
  }

  function fillAccountLeaderFormFromTeam(team) {
    if (!team) return;
    state.accountLeaderTeam = team;
    var lid = document.getElementById('account-lead-id');
    if (lid) lid.value = firstNonEmptyString(team.leadId, team.lead_id, team.Lead_ID);
    var em = document.getElementById('account-email');
    if (em) em.value = firstNonEmptyString(team.email, team.Email);
    applyAccountViewPasswordPlain(
      'account-password',
      firstNonEmptyString(team.passwordPlain, team.password_plain, team.password),
    );
    var tl = document.getElementById('account-team-leader');
    if (tl) tl.value = firstNonEmptyString(team.teamLeader, team.team_leader, team.Team_Leader);
    var st = document.getElementById('account-section-team');
    if (st) st.value = firstNonEmptyString(team.sectionTeam, team.section_team, team.Section_Team);
    var fi = document.getElementById('account-photo');
    if (fi) fi.value = '';
    setAccountModalPhotoFromTeam(team);
  }

  function applyTeamLeaderSidebarFromApiTeam(team) {
    if (!team || currentUserRole() !== 'team_leader') return;
    var mapped = mapApiTeamToState(team);
    if (!mapped) return;
    if (!state.currentUser) state.currentUser = {};
    state.currentUser.name = mapped.teamLeader || state.currentUser.name || 'Section Chief';
    state.currentUser.sectionTeam = String(mapped.sectionTeam || '').trim();
    var nextPhoto = mapped.photo != null && String(mapped.photo).trim() !== '' ? String(mapped.photo) : null;
    /** Always mirror API (total_teams); clear stale login session photo when DB has none. */
    state.currentUser.photo = nextPhoto;
    var initialsEl = document.getElementById('rpbdd-user-initials');
    var av = document.getElementById('rpbdd-avatar-img');
    if (state.currentUser.name && initialsEl) {
      initialsEl.textContent = state.currentUser.name
        .split(' ')
        .map(function (n) {
          return n[0];
        })
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (state.currentUser.photo && av) {
      av.src = state.currentUser.photo;
      av.style.display = 'block';
      if (initialsEl) initialsEl.style.display = 'none';
    } else if (av) {
      av.removeAttribute('src');
      av.style.display = 'none';
      if (initialsEl) initialsEl.style.display = '';
    }
    var sn = document.getElementById('rpbdd-sidebar-name');
    if (sn) sn.textContent = state.currentUser.name || 'Section Chief';
    syncAddEventInputByField();
  }

  function resetAccountMemberForm() {
    ['account-member-email', 'account-member-password', 'account-member-team'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var apw = document.getElementById('account-member-password');
    if (apw) apw.type = 'password';
    var apwBtn = document.querySelector('[data-toggle-password="account-member-password"]');
    if (apwBtn) {
      var imR = apwBtn.querySelector('.rpbdd-toggle-pw__icon--masked');
      var ivR = apwBtn.querySelector('.rpbdd-toggle-pw__icon--visible');
      if (imR) imR.hidden = false;
      if (ivR) ivR.hidden = true;
      apwBtn.setAttribute('aria-label', 'Show password');
      apwBtn.setAttribute('aria-pressed', 'false');
    }
    var fi = document.getElementById('account-member-photo-input');
    if (fi) fi.value = '';
    var av = document.getElementById('account-member-photo-avatar');
    if (av) {
      av.classList.remove('has-image');
      av.classList.remove('has-fallback');
    }
    var ini = document.getElementById('account-member-photo-initials');
    if (ini) {
      ini.textContent = '';
      ini.hidden = true;
      ini.setAttribute('aria-hidden', 'true');
    }
    var prev = document.getElementById('account-member-photo-preview');
    if (prev) {
      if (prev.dataset.objectUrl) {
        URL.revokeObjectURL(prev.dataset.objectUrl);
        delete prev.dataset.objectUrl;
      }
      prev.removeAttribute('src');
    }
    state.accountMemberMember = null;
  }

  function resetAccountAdminForm() {
    ['account-admin-email', 'account-admin-password', 'account-admin-role'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var apw = document.getElementById('account-admin-password');
    if (apw) apw.type = 'password';
    var apwBtn = document.querySelector('[data-toggle-password="account-admin-password"]');
    if (apwBtn) {
      var imR = apwBtn.querySelector('.rpbdd-toggle-pw__icon--masked');
      var ivR = apwBtn.querySelector('.rpbdd-toggle-pw__icon--visible');
      if (imR) imR.hidden = false;
      if (ivR) ivR.hidden = true;
      apwBtn.setAttribute('aria-label', 'Show password');
      apwBtn.setAttribute('aria-pressed', 'false');
    }
    var av = document.getElementById('account-admin-photo-avatar');
    if (av) {
      av.classList.remove('has-image');
      av.classList.remove('has-fallback');
    }
    var ini = document.getElementById('account-admin-photo-initials');
    if (ini) {
      ini.textContent = '';
      ini.hidden = true;
      ini.setAttribute('aria-hidden', 'true');
    }
    var prev = document.getElementById('account-admin-photo-preview');
    if (prev) {
      if (prev.dataset.objectUrl) {
        URL.revokeObjectURL(prev.dataset.objectUrl);
        delete prev.dataset.objectUrl;
      }
      prev.removeAttribute('src');
    }
    var fi = document.getElementById('account-admin-photo-input');
    if (fi) fi.value = '';
    var roleInput = document.getElementById('account-admin-role');
    if (roleInput) roleInput.value = 'Admin';
  }

  function setAccountModalPhotoFromAdmin(admin) {
    var pvw = document.getElementById('account-admin-photo-preview');
    var ava = document.getElementById('account-admin-photo-avatar');
    var initialsEl = document.getElementById('account-admin-photo-initials');
    var photo = '';
    if (admin && admin.photo != null && String(admin.photo).trim() !== '') {
      photo = String(admin.photo);
    }
    if (!photo && state.currentUser && state.currentUser.photo != null && String(state.currentUser.photo).trim() !== '') {
      photo = String(state.currentUser.photo);
    }
    if (!photo) {
      var sidebarImg = document.getElementById('rpbdd-avatar-img');
      if (sidebarImg) {
        var sidebarSrc = String(sidebarImg.currentSrc || sidebarImg.src || sidebarImg.getAttribute('src') || '').trim();
        if (sidebarSrc !== '') photo = sidebarSrc;
      }
    }
    if (pvw && pvw.dataset.objectUrl) {
      URL.revokeObjectURL(pvw.dataset.objectUrl);
      delete pvw.dataset.objectUrl;
    }
    if (photo) {
      var normalizedPhoto = photo;
      var maybeBase64NoPrefix = /^[A-Za-z0-9+/=\r\n]+$/.test(photo) && photo.length > 80;
      if (maybeBase64NoPrefix) {
        normalizedPhoto = 'data:image/jpeg;base64,' + photo.replace(/\s+/g, '');
      }
      if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(normalizedPhoto)) {
        normalizedPhoto = normalizedPhoto.replace(/\s+/g, '');
      }
      if (pvw) pvw.src = normalizedPhoto;
      if (ava) {
        ava.classList.add('has-image');
        ava.classList.remove('has-fallback');
      }
      if (initialsEl) {
        initialsEl.textContent = '';
        initialsEl.hidden = true;
        initialsEl.setAttribute('aria-hidden', 'true');
      }
      if (pvw) {
        pvw.onerror = function () {
          pvw.removeAttribute('src');
          if (ava) {
            ava.classList.remove('has-image');
            ava.classList.add('has-fallback');
          }
          var fallbackNameErr = admin
            ? firstNonEmptyString(admin.fullName, displayNameFromEmail(admin.email))
            : '';
          if (!fallbackNameErr && state.currentUser) fallbackNameErr = String(state.currentUser.name || '').trim();
          if (initialsEl) {
            initialsEl.textContent = teamLeaderInitialsFromName(fallbackNameErr || 'Admin');
            initialsEl.hidden = false;
            initialsEl.setAttribute('aria-hidden', 'false');
          }
        };
      }
    } else {
      if (pvw) pvw.removeAttribute('src');
      if (ava) {
        ava.classList.remove('has-image');
        ava.classList.add('has-fallback');
      }
      var displayName = admin ? firstNonEmptyString(admin.fullName, displayNameFromEmail(admin.email)) : '';
      if (!displayName && state.currentUser) {
        displayName = String(state.currentUser.name || '').trim();
      }
      if (initialsEl) {
        initialsEl.textContent = teamLeaderInitialsFromName(displayName || 'Admin');
        initialsEl.hidden = false;
        initialsEl.setAttribute('aria-hidden', 'false');
      }
    }
  }

  function fillAccountAdminForm(admin) {
    if (!admin) return;
    var em = document.getElementById('account-admin-email');
    if (em) em.value = String(admin.email || '').trim().toLowerCase();
    applyAccountViewPasswordPlain(
      'account-admin-password',
      firstNonEmptyString(admin.passwordPlain, admin.password_plain, admin.password),
    );
    var roleInput = document.getElementById('account-admin-role');
    if (roleInput) roleInput.value = 'Admin';
    setAccountModalPhotoFromAdmin(admin);
  }

  function setAccountModalPhotoFromMember(member) {
    var pvw = document.getElementById('account-member-photo-preview');
    var ava = document.getElementById('account-member-photo-avatar');
    var initialsEl = document.getElementById('account-member-photo-initials');
    var photo = '';
    if (member && member.photo != null && String(member.photo).trim() !== '') {
      photo = String(member.photo);
    }
    if (pvw && pvw.dataset.objectUrl) {
      URL.revokeObjectURL(pvw.dataset.objectUrl);
      delete pvw.dataset.objectUrl;
    }
    if (photo) {
      if (pvw) pvw.src = photo;
      if (ava) {
        ava.classList.add('has-image');
        ava.classList.remove('has-fallback');
      }
      if (initialsEl) {
        initialsEl.textContent = '';
        initialsEl.hidden = true;
        initialsEl.setAttribute('aria-hidden', 'true');
      }
    } else {
      if (pvw) pvw.removeAttribute('src');
      if (ava) {
        ava.classList.remove('has-image');
        ava.classList.add('has-fallback');
      }
      var displayName = member
        ? firstNonEmptyString(
            member.fullName,
            member.Full_Name,
            member.full_name,
            member.name,
            member.Name,
            displayNameFromEmail(member.email || member.Email),
          )
        : '';
      if (initialsEl) {
        initialsEl.textContent = teamLeaderInitialsFromName(displayName);
        initialsEl.hidden = false;
        initialsEl.setAttribute('aria-hidden', 'false');
      }
    }
  }

  function fillAccountMemberFormFromMember(member) {
    if (!member) return;
    state.accountMemberMember = member;
    var em = document.getElementById('account-member-email');
    if (em) em.value = firstNonEmptyString(member.email, member.Email);
    applyAccountViewPasswordPlain(
      'account-member-password',
      firstNonEmptyString(member.passwordPlain, member.password_plain, member.password),
    );
    var tm = document.getElementById('account-member-team');
    if (tm) tm.value = firstNonEmptyString(member.team, member.Team);
    var fi = document.getElementById('account-member-photo-input');
    if (fi) fi.value = '';
    setAccountModalPhotoFromMember(member);
  }

  function applyMemberSidebarFromApiMember(member) {
    if (!member || (currentUserRole() !== 'member' && currentUserRole() !== 'user')) return;
    var mapped = mapApiMemberToState(member);
    if (!mapped) return;
    if (!state.currentUser) state.currentUser = {};
    state.currentUser.name = mapped.name || state.currentUser.name || 'Member';
    state.currentUser.team = String(mapped.team || '').trim();
    state.currentUser.photo =
      mapped.photo != null && String(mapped.photo).trim() !== '' ? String(mapped.photo) : null;
    var initialsEl = document.getElementById('rpbdd-user-initials');
    var av = document.getElementById('rpbdd-avatar-img');
    if (state.currentUser.name && initialsEl) {
      initialsEl.textContent = state.currentUser.name
        .split(' ')
        .map(function (n) {
          return n[0];
        })
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (state.currentUser.photo && av) {
      av.src = state.currentUser.photo;
      av.style.display = 'block';
      if (initialsEl) initialsEl.style.display = 'none';
    } else if (av) {
      av.removeAttribute('src');
      av.style.display = 'none';
      if (initialsEl) initialsEl.style.display = '';
    }
    var sn = document.getElementById('rpbdd-sidebar-name');
    if (sn) sn.textContent = state.currentUser.name || 'Member';
    syncAddEventInputByField();
  }

  function openMemberAccountModal() {
    var base = getMembersApiBase();
    if (!base) {
      rpbddAlertMessage('Members API is not configured.');
      return;
    }
    resetAccountMemberForm();
    var memberEmail =
      state.currentUser && state.currentUser.email != null ? String(state.currentUser.email).trim() : '';
    var memberUrl = base + '/my-member' + (memberEmail ? '?email=' + encodeURIComponent(memberEmail) : '');
    fetch(memberUrl, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { res: res, j: j, raw: text || '' };
        });
      })
      .then(function (o) {
        if (!o.res.ok || !o.j || !o.j.ok || !o.j.member) {
          var msg = o.j && o.j.error ? o.j.error : 'Could not load your member profile.';
          rpbddAlertMessage(msg + (o.res.status ? ' (HTTP ' + o.res.status + ')' : ''));
          return;
        }
        setAccountModalMemberLayout();
        fillAccountMemberFormFromMember(o.j.member);
        openModal('modal-account');
        if (typeof window.rpbddSyncPasswordToggles === 'function') {
          window.rpbddSyncPasswordToggles(document.getElementById('modal-account'));
        }
      })
      .catch(function () {
        rpbddAlertMessage('Network error while loading account profile.');
      });
  }

  function openMemberEditModal(m) {
    if (!m) return;
    var doFill = function () {
      resetMemberForm();
      state.editingMemberId = String(m.id);
      var title = document.getElementById('rpbdd-modal-add-member-title');
      if (title) title.textContent = 'Edit Member';
      var saveBtn = document.getElementById('rpbdd-save-member');
      if (saveBtn) saveBtn.textContent = 'Save changes';
      var emEl = document.getElementById('member-email');
      if (emEl) emEl.value = firstNonEmptyString(m.email, m.Email);
      var pwEl = document.getElementById('member-password');
      if (pwEl) pwEl.value = typeof m.passwordPlain === 'string' ? m.passwordPlain : '';
      populateMemberTeamFromState('');
      var teamId = '';
      var teamLabel = firstNonEmptyString(m.team, m.Team, m.sectionTeam, m.section_team).trim();
      var teamLabelLower = teamLabel.toLowerCase();
      (state.teams || []).forEach(function (t) {
        var sectionLabel = String((t.sectionTeam || '').trim());
        var leaderLabel = String((t.teamLeader || '').trim());
        var label = sectionLabel || leaderLabel;
        if (teamId) return;
        if (label === teamLabel) {
          teamId = String(t.id);
          return;
        }
        if (
          teamLabelLower &&
          (sectionLabel.toLowerCase() === teamLabelLower || leaderLabel.toLowerCase() === teamLabelLower)
        ) {
          teamId = String(t.id);
        }
      });
      if (teamId) populateMemberTeamFromState(teamId);
      else setMemberTeamValue('', teamLabel);
      if (m.photo && String(m.photo).trim() !== '') {
        var pvw = document.getElementById('member-photo-preview');
        var ava = document.getElementById('member-photo-avatar');
        if (pvw) pvw.src = String(m.photo);
        if (ava) ava.classList.add('has-image');
      }
      openModal('modal-add-member');
      if (typeof window.rpbddSyncPasswordToggles === 'function') {
        window.rpbddSyncPasswordToggles(document.getElementById('modal-add-member'));
      }
    };
    if (getTeamsApiBase()) {
      refreshTeamsFromApi().then(function () {
        doFill();
      });
    } else {
      doFill();
    }
  }

  function openTeamLeaderAccountModal() {
    var base = getTeamsApiBase();
    if (!base) {
      rpbddAlertMessage('Teams API is not configured.');
      return;
    }
    resetAccountLeaderForm();
    var teamEmail =
      state.currentUser && state.currentUser.email != null ? String(state.currentUser.email).trim() : '';
    var teamUrl = base + '/my-team' + (teamEmail ? '?email=' + encodeURIComponent(teamEmail) : '');
    fetch(teamUrl, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { res: res, j: j, raw: text || '' };
        });
      })
      .then(function (o) {
        if (!o.res.ok || !o.j || !o.j.ok || !o.j.team) {
          var msg = o.j && o.j.error ? o.j.error : 'Could not load your team profile.';
          rpbddAlertMessage(msg + (o.res.status ? ' (HTTP ' + o.res.status + ')' : ''));
          return;
        }
        setAccountModalLeaderLayout();
        fillAccountLeaderFormFromTeam(o.j.team);
        openModal('modal-account');
        if (typeof window.rpbddSyncPasswordToggles === 'function') {
          window.rpbddSyncPasswordToggles(document.getElementById('modal-account'));
        }
      })
      .catch(function () {
        rpbddAlertMessage('Network error while loading account profile.');
      });
  }

  function openAdminAccountModal() {
    var base = getAdminAccountApiBase();
    if (!base) {
      rpbddAlertMessage('Admin account API is not configured.');
      return;
    }
    resetAccountAdminForm();
    var currentEmail =
      state.currentUser && state.currentUser.email != null ? String(state.currentUser.email).trim() : '';
    var url = base + (currentEmail ? '?email=' + encodeURIComponent(currentEmail) : '');
    fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { res: res, j: j, raw: text || '' };
        });
      })
      .then(function (o) {
        if (!o.res.ok || !o.j || !o.j.ok || !o.j.admin) {
          var msg = o.j && o.j.error ? o.j.error : 'Could not load your admin profile.';
          rpbddAlertMessage(msg + (o.res.status ? ' (HTTP ' + o.res.status + ')' : ''));
          return;
        }
        setAccountModalAdminLayout();
        fillAccountAdminForm(o.j.admin);
        openModal('modal-account');
        if (typeof window.rpbddSyncPasswordToggles === 'function') {
          window.rpbddSyncPasswordToggles(document.getElementById('modal-account'));
        }
      })
      .catch(function () {
        rpbddAlertMessage('Network error while loading account profile.');
      });
  }

  function fillEditAdminAccountModalFromView() {
    var emV = document.getElementById('account-admin-email');
    var roleV = document.getElementById('account-admin-role');
    var emE = document.getElementById('edit-admin-email');
    var roleE = document.getElementById('edit-admin-role');
    var pwE = document.getElementById('edit-admin-password');
    if (emE) emE.value = emV ? String(emV.value || '').trim().toLowerCase() : '';
    if (roleE) roleE.value = roleV ? String(roleV.value || 'Admin') : 'Admin';
    if (pwE) pwE.value = '';
    var editModal = document.getElementById('modal-edit-admin-account');
    if (editModal && emE) {
      editModal.dataset.initialAdminEmail = String(emE.value || '').trim().toLowerCase();
    }
  }

  function openTeamEditModal(t) {
    if (!t) return;
    resetAddTeamForm();
    state.editingTeamId = String(t.id);
    var teamModalTitle = document.getElementById('rpbdd-modal-add-team-title');
    if (teamModalTitle) teamModalTitle.textContent = 'Edit Team';
    var teamSaveBtn = document.getElementById('rpbdd-save-team');
    if (teamSaveBtn) teamSaveBtn.textContent = 'Save changes';
    var lid = document.getElementById('team-lead-id');
    if (lid) lid.value = teamLeadId(t) || '';
    var emEl = document.getElementById('team-email');
    if (emEl) emEl.value = (t.email || '').trim();
    var pwEl = document.getElementById('team-password');
    if (pwEl) pwEl.value = typeof t.passwordPlain === 'string' ? t.passwordPlain : '';
    var leaderEl = document.getElementById('team-leader');
    if (leaderEl) leaderEl.value = (t.teamLeader || '').trim();
    populateTeamSectionSelect((t.sectionTeam || '').trim());
    populateTeamPositionSelect((t.position || '').trim());
    if (t.photo && String(t.photo).trim() !== '') {
      var pvw = document.getElementById('team-photo-preview');
      var ava = document.getElementById('team-photo-avatar');
      if (pvw) pvw.src = String(t.photo);
      if (ava) ava.classList.add('has-image');
    }
    setTeamLeadIdFieldLocked(true);
    openModal('modal-add-team');
  }

  /** Same SVG markup as sidebar nav buttons — keep in sync with dashboard.php */
  var MODULE_HEADER_ICONS = {
    dashboard:
      '<svg class="rpbdd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    events:
      '<svg class="rpbdd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    tasks:
      '<svg class="rpbdd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    team:
      '<svg class="rpbdd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    reports:
      '<svg class="rpbdd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  };

  function setNav(id) {
    var panelExists = !!document.querySelector('.rpbdd-panel[data-panel="' + id + '"]');
    if (!panelExists) {
      id = document.querySelector('.rpbdd-panel[data-panel="dashboard"]') ? 'dashboard' : 'events';
    }
    var role = currentUserRole();
    if (role === 'member' && id === 'team') {
      id = 'dashboard';
    }
    if (eventsPanelTimerId != null) {
      clearInterval(eventsPanelTimerId);
      eventsPanelTimerId = null;
    }
    if (teamPanelTimerId != null) {
      clearInterval(teamPanelTimerId);
      teamPanelTimerId = null;
    }
    if (tasksPanelTimerId != null) {
      clearInterval(tasksPanelTimerId);
      tasksPanelTimerId = null;
    }
    state.activeNav = id;
    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-nav') === id);
    });
    document.querySelectorAll('.rpbdd-panel').forEach(function (p) {
      p.classList.toggle('is-visible', p.getAttribute('data-panel') === id);
    });
    var titles = {
      dashboard: 'Dashboard',
      events: 'Events',
      tasks: 'Tasks',
      team: 'Team Management',
      reports: 'Reports',
    };
    var h = document.getElementById('rpbdd-page-title');
    if (h) h.textContent = titles[id] || 'Dashboard';
    var iconWrap = document.getElementById('rpbdd-header-module-icon-wrap');
    if (iconWrap) {
      iconWrap.innerHTML = MODULE_HEADER_ICONS[id] || MODULE_HEADER_ICONS.dashboard;
    }
    render();
    if (id === 'team') {
      var teamLoad = [];
      if (getTeamsApiBase()) {
        teamLoad.push(refreshTeamsFromApi(), refreshMembersFromApi());
      }
      if (getUserLogsApiBase()) {
        teamLoad.push(refreshUserLogsFromApi());
      }
      if (teamLoad.length) {
        Promise.all(teamLoad).then(function () {
          renderTeamPanel();
        });
      } else {
        renderTeamPanel();
      }
      if (getTeamsApiBase() || getUserLogsApiBase()) {
        teamPanelTimerId = setInterval(function () {
          var jobs = [];
          if (getTeamsApiBase()) {
            jobs.push(refreshTeamsFromApi(), refreshMembersFromApi());
          }
          var vis = document.visibilityState !== 'hidden';
          if (getUserLogsApiBase() && vis) {
            if (state.teamView === 'logs' || currentUserRole() === 'admin') {
              jobs.push(refreshUserLogsFromApi());
            }
          }
          if (!jobs.length) {
            if (state.activeNav === 'team') renderTeamPanel();
            return;
          }
          Promise.all(jobs).then(function () {
            if (state.activeNav === 'team') renderTeamPanel();
          });
        }, 1000);
      }
    }
    if (id === 'events') {
      refreshEventsFromApi();
      eventsPanelTimerId = setInterval(function () {
        syncPastUserEventsToDone();
        renderEventsPanel();
      }, 60000);
    } else {
      var rb = document.getElementById('rpbdd-events-recycle-bar');
      if (rb) {
        rb.hidden = true;
        rb.style.display = 'none';
        rb.setAttribute('aria-hidden', 'true');
      }
    }
    if (id === 'tasks') {
      var prep = Promise.resolve();
      var tr = currentUserRole();
      if (tr === 'admin' || tr === 'team_leader' || tr === 'member' || tr === 'user') {
        if (getTeamsApiBase()) {
          prep = prep.then(function () {
            return refreshTeamsFromApi();
          });
        }
        if (getMembersApiBase()) {
          prep = prep.then(function () {
            return refreshMembersFromApi();
          });
        }
      }
      prep
        .then(function () {
          return fetchTaskListsFromApi();
        })
        .then(function () {
          renderTasksPanel();
          if (getTasksApiBase()) {
            tasksPanelTimerId = setInterval(function () {
              if (state.activeNav !== 'tasks') return;
              if (document.visibilityState === 'hidden') return;
              if (!getTasksApiBase()) return;
              var beforeSnap = tasksSnapshotTaskListsForPoll(state.taskLists);
              fetchTaskListsFromApi().then(function (ok) {
                if (!ok || state.activeNav !== 'tasks') return;
                var afterSnap = tasksSnapshotTaskListsForPoll(state.taskLists);
                if (afterSnap !== beforeSnap) {
                  renderTasksPanel();
                }
              });
            }, 8000);
          }
        });
    }
    if (id === 'reports') {
      var reportJobs = [];
      if (getTeamsApiBase()) reportJobs.push(refreshTeamsFromApi());
      if (getMembersApiBase()) reportJobs.push(refreshMembersFromApi());
      if (getTasksApiBase()) reportJobs.push(fetchTaskListsFromApi());
      if (reportJobs.length) {
        Promise.all(reportJobs).then(function () {
          if (state.activeNav === 'reports') renderReportsPanel();
        });
      } else {
        renderReportsPanel();
      }
    }
  }

  /** True if this calendar day (in visible month) should show a Done marker — past days with content, or all items are done */
  function isDayDoneForCalendar(day) {
    var y = state.currentDate.getFullYear();
    var m = state.currentDate.getMonth();
    var ds = ymd(y, m, day);
    var t = todayYmd();
    var evs = getEventsForDate(day);
    var hol = getHoliday(day);
    if (evs.length === 0 && !hol) return false;
    if (ds < t) return true;
    if (evs.length > 0) {
      return evs.every(function (e) {
        return normalizedStoredEventStatus(e.status) === 'done';
      });
    }
    return false;
  }

  function renderCalendar() {
    var el = document.getElementById('rpbdd-cal-cells');
    var titleEl = document.getElementById('rpbdd-cal-month-label');
    if (!el) return;
    var y = state.currentDate.getFullYear();
    var m = state.currentDate.getMonth();
    if (titleEl) titleEl.textContent = monthNames[m] + ' ' + y;

    var first = firstDayOfMonth(state.currentDate);
    var total = daysInMonth(state.currentDate);
    var cells = [];
    var i;
    for (i = 0; i < first; i++) cells.push({ type: 'empty' });
    for (i = 1; i <= total; i++) cells.push({ type: 'day', day: i });
    while (cells.length % 7 !== 0) cells.push({ type: 'empty' });

    var html = '';
    cells.forEach(function (cell) {
      if (cell.type === 'empty') {
        html += '<div class="rpbdd-cal-cell is-muted"></div>';
        return;
      }
      var day = cell.day;
      var holFixed = getFixedPhilippineHoliday(day);
      var holMuslim = getMuslimPhilippineHoliday(day);
      var holCny = getChineseNewYearPhilippineHoliday(day);
      var hol = holFixed || holMuslim || holCny;
      var today = isToday(day);
      var evs = getEventsForDate(day);
      var ds = ymd(state.currentDate.getFullYear(), state.currentDate.getMonth(), day);
      var cls = 'rpbdd-cal-cell';
      if (today) cls += ' is-today';
      if (holFixed || holCny) cls += ' is-holiday';
      if (holMuslim) cls += ' is-muslim-holiday';
      if (state.sidebarSelectedYmd && state.sidebarSelectedYmd === ds) cls += ' is-selected';

      html += '<div class="' + cls + '" data-day="' + day + '">';
      html += '<div class="rpbdd-cal-daynum">';
      html += '<span class="rpbdd-cal-daynum-num">' + day + '</span>';
      if ((evs.length > 0 || hol) && isDayDoneForCalendar(day)) {
        html += '<span class="rpbdd-cal-done-badge" aria-label="Done">Done</span>';
      }
      if (today) html += '<span class="rpbdd-badge-today">Today</span>';
      html += '</div>';
      if (hol) {
        html += '<div class="rpbdd-holiday-label">' + escapeHtml(hol.name) + '</div>';
      }
      evs.forEach(function (ev) {
        var col = ev.isBirthday ? birthdayAccentColorForTheme() : categoryColor(ev.category);
        var doneCls = ev.status === 'done' ? ' is-done' : '';
        if (ev.isBirthday) doneCls += ' is-birthday';
        html +=
          '<div class="rpbdd-event-chip' +
          doneCls +
          '" style="--rpbdd-ev-accent:' +
          col +
          ';border-left-color:' +
          col +
          '" title="' +
          escapeHtml(ev.title) +
          (ev.status === 'done' ? ' (Done)' : '') +
          '">' +
          '<span class="rpbdd-event-chip__dot" style="background:' +
          col +
          '"></span>' +
          '<span class="rpbdd-event-chip__text">' +
          escapeHtml(ev.title) +
          (ev.status === 'done' ? ' ✓' : '') +
          '</span></div>';
      });
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function formatLongDateYmd(ymd) {
    var p = String(ymd).split('-');
    if (p.length !== 3) return String(ymd);
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function todayYmd() {
    var t = new Date();
    return ymd(t.getFullYear(), t.getMonth(), t.getDate());
  }

  /** Normalize stored event `date` to YYYY-MM-DD so Done vs Upcoming matches calendar dates reliably. */
  function normalizeEventDateYmd(dateInput) {
    if (dateInput == null || dateInput === '') return '';
    var s = String(dateInput).trim();
    if (!s) return '';
    var pm = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (pm) {
      var y = parseInt(pm[1], 10);
      var mo = parseInt(pm[2], 10);
      var d = parseInt(pm[3], 10);
      if (y && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return y + '-' + pad2(mo) + '-' + pad2(d);
      }
    }
    var x = new Date(s.indexOf('T') >= 0 ? s : s + 'T12:00:00');
    if (isNaN(x.getTime())) return '';
    return ymd(x.getFullYear(), x.getMonth(), x.getDate());
  }

  /**
   * Events module card date line: "April 15, 2026." or "April 15 and 16, 2026." (not ISO).
   * @param {string[]} ymdInputs YYYY-MM-DD values (deduped + sorted inside)
   */
  function formatEventCardDatesLine(ymdInputs) {
    var seen = {};
    var norm = [];
    (ymdInputs || []).forEach(function (s) {
      var n = normalizeEventDateYmd(s);
      if (n && !seen[n]) {
        seen[n] = true;
        norm.push(n);
      }
    });
    norm.sort();
    if (norm.length === 0) return '';

    var parsed = norm.map(function (n) {
      var p = n.split('-');
      return {
        ymd: n,
        y: parseInt(p[0], 10),
        m: parseInt(p[1], 10),
        d: parseInt(p[2], 10),
      };
    });

    var sameYM = parsed.every(function (x) {
      return x.y === parsed[0].y && x.m === parsed[0].m;
    });

    if (sameYM) {
      var y0 = parsed[0].y;
      var m0 = parsed[0].m;
      var month = monthNames[m0 - 1];
      var days = parsed.map(function (x) {
        return x.d;
      });
      if (days.length === 1) return month + ' ' + days[0] + ', ' + y0 + '.';
      if (days.length === 2) return month + ' ' + days[0] + ' and ' + days[1] + ', ' + y0 + '.';
      var lastD = days.pop();
      return month + ' ' + days.join(', ') + ', and ' + lastD + ', ' + y0 + '.';
    }

    function chunk(x) {
      return monthNames[x.m - 1] + ' ' + x.d + ', ' + x.y;
    }
    if (parsed.length === 1) return chunk(parsed[0]) + '.';
    if (parsed.length === 2) return chunk(parsed[0]) + ' and ' + chunk(parsed[1]) + '.';
    var init = parsed
      .slice(0, -1)
      .map(chunk)
      .join(', ');
    return init + ', and ' + chunk(parsed[parsed.length - 1]) + '.';
  }

  /** Inline SVG for small action buttons (stroke = currentColor). */
  var svgIconEdit =
    '<svg class="rpbdd-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var svgIconRemove =
    '<svg class="rpbdd-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
  var svgIconRestore =
    '<svg class="rpbdd-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
  function profileNotifRecycleCardTitleFromEntry(entry) {
    return profileNotifRecycleTitleFromSnapshot(entry && entry.snapshot);
  }

  function buildProfileNotifRecycleBinCard(entry, index) {
    var snap = entry && entry.snapshot;
    if (!snap) return '';
    var key = String(index);
    var expanded = String(state.expandedProfileNotifReadRecycleKey || '') === key;
    var targetIsTeam = String(snap.targetKind || '').toLowerCase() === 'team';
    var accentKey = targetIsTeam ? 'team_leader' : 'member';
    var col = notificationAccentForRole(accentKey);
    var when = formatNotificationDateTime(snap.createdAt);
    var kindLabel = targetIsTeam ? 'Team' : 'Member';
    var title = escapeHtml(snap.title || 'Notification');
    var details = String(snap.details || snap.summary || '');
    var teamBlock = expanded ? profileNotificationTeamDetailsHtml(snap) : '';
    var byLine = profileNotificationEditorLine(snap);
    var byBlock =
      expanded && byLine
        ? '<p class="rpbdd-profile-notif-byline">' + escapeHtml(byLine) + '</p>'
        : '';
    var actions =
      '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">' +
      '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--restore" data-restore-profile-notif-read-recycle-idx="' +
      index +
      '">' +
      svgIconRestore +
      '<span>Restore</span></button>' +
      '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete" data-delete-profile-notif-read-recycle-idx="' +
      index +
      '">' +
      svgIconRemove +
      '<span>Delete</span></button>' +
      '</div>';
    return (
      '<div class="rpbdd-event-card rpbdd-event-card--recycle rpbdd-profile-notif-card">' +
      '<div class="rpbdd-event-card-head" data-expand-profile-notif-read-recycle-idx="' +
      index +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.4rem;flex-wrap:wrap;width:100%">' +
      '<div style="min-width:0">' +
      '<strong style="font-size:0.85rem">' +
      title +
      '</strong>' +
      '<div class="rpbdd-profile-notif-when">' +
      escapeHtml(when || '—') +
      '</div>' +
      '</div>' +
      '<span class="rpbdd-profile-notif-kind" style="--rpbdd-notif-kind-color:' +
      col +
      '">' +
      escapeHtml(kindLabel) +
      '</span>' +
      '</div></div>' +
      (expanded
        ? '<div class="rpbdd-event-card-body">' +
          teamBlock +
          '<p style="font-size:0.75rem;margin:0 0 0.5rem 0;line-height:1.4"><strong>Details</strong><br>' +
          escapeHtml(details) +
          '</p>' +
          byBlock +
          actions +
          '</div>'
        : '') +
      '</div>'
    );
  }

  function renderProfileNotificationsReadRecycle() {
    var el = document.getElementById('rpbdd-notifications-read-recycle-list');
    if (!el) return;
    var arr = state.profileNotifRecycle || [];
    if (arr.length === 0) {
      el.innerHTML = '<div class="rpbdd-placeholder">Recycle Bin is empty</div>';
      return;
    }
    var indices = arr.map(function (_, i) {
      return i;
    });
    indices.sort(function (ia, ib) {
      var a = arr[ia];
      var b = arr[ib];
      return new Date((b && b.movedAt) || 0).getTime() - new Date((a && a.movedAt) || 0).getTime();
    });
    var parts = indices.map(function (i) {
      return buildProfileNotifRecycleBinCard(arr[i], i);
    });
    el.innerHTML = '<div class="rpbdd-recycle-bin-list">' + parts.join('') + '</div>';
    bindProfileNotificationsReadRecycleModalList(el);
  }

  function bindProfileNotificationsReadRecycleModalList(el) {
    if (!el) return;
    el.querySelectorAll('[data-expand-profile-notif-read-recycle-idx]').forEach(function (node) {
      node.addEventListener('click', function () {
        var raw = String(node.getAttribute('data-expand-profile-notif-read-recycle-idx') || '');
        state.expandedProfileNotifReadRecycleKey = state.expandedProfileNotifReadRecycleKey === raw ? null : raw;
        renderProfileNotificationsReadRecycle();
      });
      node.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        node.click();
      });
    });
    el.querySelectorAll('[data-restore-profile-notif-read-recycle-idx]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-restore-profile-notif-read-recycle-idx'), 10);
        if (isNaN(idx)) return;
        var entry = (state.profileNotifRecycle || [])[idx];
        if (!entry) return;
        var label = profileNotifRecycleCardTitleFromEntry(entry);
        openRpbddConfirm({
          variant: 'restore',
          confirmUiSource: 'notifications-read-recycle',
          title: 'Restore this notification?',
          message: '“' + label + '” returns to your Read list.',
          confirmLabel: 'Restore',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          restoreProfileNotifRecycleEntryAt(idx);
        });
      });
    });
    el.querySelectorAll('[data-delete-profile-notif-read-recycle-idx]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-delete-profile-notif-read-recycle-idx'), 10);
        if (isNaN(idx)) return;
        var entry = (state.profileNotifRecycle || [])[idx];
        if (!entry) return;
        var label = profileNotifRecycleCardTitleFromEntry(entry);
        openRpbddConfirm({
          variant: 'delete',
          confirmUiSource: 'notifications-read-recycle',
          title: 'Delete permanently?',
          message: '“' + label + '” will be removed for good. This cannot be undone.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          purgeProfileNotifRecycleEntryAt(idx);
        });
      });
    });
  }

  /** Same paths as auth login password toggle (stroke = currentColor). */
  var svgPwToggleMasked =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  var svgPwToggleVisible =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

  function normalizedStoredEventStatus(status) {
    var u = String(status == null ? 'upcoming' : status)
      .trim()
      .toLowerCase();
    if (u === 'done' || u === 'completed' || u === 'finished' || u === 'complete') return 'done';
    return 'upcoming';
  }

  /**
   * Merge flat sidebar rows that share the same title into one card (e.g. multi-day DB events),
   * matching the Events module list.
   */
  function groupSidebarPoolItems(flatItems) {
    var buckets = {};
    flatItems.forEach(function (item) {
      var key = item.isHoliday ? 'h:' + item.title : 'u:' + item.title;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(item);
    });
    var out = [];
    Object.keys(buckets).forEach(function (key) {
      var grp = buckets[key];
      var seen = {};
      var dates = [];
      grp.forEach(function (it) {
        var n = normalizeEventDateYmd(it.date);
        if (n && !seen[n]) {
          seen[n] = true;
          dates.push(n);
        }
      });
      dates.sort();
      var first = grp[0];
      var isMuslimHoliday = grp.some(function (it) {
        return it.isMuslimHoliday;
      });
      out.push({
        title: first.title,
        isHoliday: !!first.isHoliday,
        isMuslimHoliday: isMuslimHoliday,
        category: first.category,
        time: first.time,
        status: first.status,
        date: dates[0] || first.date,
        sidebarDates: dates.length ? dates : [first.date].filter(Boolean),
      });
    });
    out.sort(function (a, b) {
      var da = a.sidebarDates[0] || '';
      var db = b.sidebarDates[0] || '';
      if (da !== db) return da.localeCompare(db);
      if (a.isHoliday && !b.isHoliday) return -1;
      if (!a.isHoliday && b.isHoliday) return 1;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });
    return out;
  }

  /** Flat rows for the visible calendar month (before grouping by title). */
  function mergeDefaultSidebarPoolFlat() {
    var y = state.currentDate.getFullYear();
    var m = state.currentDate.getMonth();
    var t = todayYmd();
    var items = [];
    philippineObservedHolidaysInMonth(y, m).forEach(function (h) {
      var ds = y + '-' + pad2(m + 1) + '-' + pad2(h.date);
      if (ds >= t) {
        items.push({
          title: h.name,
          date: ds,
          category: 'SPLIT',
          isHoliday: true,
        });
      }
    });
    var muslimY = PH_MUSLIM_HOLIDAYS_BY_YEAR[y];
    if (muslimY && muslimY.length) {
      muslimY.forEach(function (h) {
      if (h.month !== m) return;
      var ds = y + '-' + pad2(m + 1) + '-' + pad2(h.date);
      if (ds >= t) {
        items.push({
          title: h.name,
          date: ds,
          category: 'SPLIT',
          isHoliday: true,
            isMuslimHoliday: true,
        });
      }
    });
    }
    var cny = PH_CHINESE_NEW_YEAR_BY_YEAR[y];
    if (cny && cny.month === m) {
      var dsCny = y + '-' + pad2(m + 1) + '-' + pad2(cny.date);
      if (dsCny >= t) {
        items.push({
          title: cny.name,
          date: dsCny,
          category: 'SPLIT',
          isHoliday: true,
        });
      }
    }
    state.events.forEach(function (e) {
      if (normalizedStoredEventStatus(e.status) !== 'upcoming') return;
      var en = normalizeEventDateYmd(e.date);
      if (!en || en < t) return;
      var d = new Date(en + 'T12:00:00');
      if (d.getFullYear() === y && d.getMonth() === m) {
        items.push(e);
      }
    });
    return items.sort(function (a, b) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.isHoliday && !b.isHoliday) return -1;
      if (!a.isHoliday && b.isHoliday) return 1;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });
  }

  /**
   * Default sidebar pool: upcoming holidays + upcoming events in the visible month,
   * one card per title (multi-day events collapsed like the Events module).
   */
  function mergeDefaultSidebarPool() {
    return groupSidebarPoolItems(mergeDefaultSidebarPoolFlat());
  }

  function groupedSidebarItemsForSelectedDay() {
    var ds = state.sidebarSelectedYmd;
    if (!ds) return [];
    var p = ds.split('-');
    var m = parseInt(p[1], 10) - 1;
    var dayNum = parseInt(p[2], 10);
    var items = [];
    var hol = getPhilippineHolidayRecord(parseInt(p[0], 10), m, dayNum);
    if (hol) {
      items.push({
        title: hol.name,
        date: ds,
        category: 'SPLIT',
        isHoliday: true,
      });
    }
    var muslimRows = PH_MUSLIM_HOLIDAYS_BY_YEAR[parseInt(p[0], 10)];
    if (muslimRows && muslimRows.length) {
      var mh = muslimRows.find(function (h) {
        return h.month === m && h.date === dayNum;
      });
      if (mh) {
        items.push({
          title: mh.name,
          date: ds,
          category: 'SPLIT',
          isHoliday: true,
          isMuslimHoliday: true,
        });
      }
    }
    var cnySel = getChineseNewYearRowForYmd(parseInt(p[0], 10), m, dayNum);
    if (cnySel) {
      items.push({
        title: cnySel.name,
        date: ds,
        category: 'SPLIT',
        isHoliday: true,
      });
    }
    state.events.forEach(function (e) {
      if (normalizeEventDateYmd(e.date) === ds) {
        items.push(e);
      }
    });
    items.sort(function (a, b) {
      if (a.isHoliday && !b.isHoliday) return -1;
      if (!a.isHoliday && b.isHoliday) return 1;
      var sa = normalizedStoredEventStatus(a.status) === 'done' ? 1 : 0;
      var sb = normalizedStoredEventStatus(b.status) === 'done' ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });
    return groupSidebarPoolItems(items);
  }

  function buildSidebarMonthItems() {
    if (state.sidebarSelectedYmd) {
      return groupedSidebarItemsForSelectedDay().slice(0, MAX_MONTH_WIDGET);
    }
    return mergeDefaultSidebarPool().slice(0, MAX_MONTH_WIDGET);
  }

  /**
   * Badge when no day selected: upcoming (not done) user events + upcoming holidays
   * in the visible calendar month only, on/after today — excludes done/past.
   */
  function countUpcomingInVisibleMonthBadge() {
    return mergeDefaultSidebarPool().length;
  }

  function countMonthWidgetBadge() {
    if (state.sidebarSelectedYmd) {
      return groupedSidebarItemsForSelectedDay().length;
    }
    return countUpcomingInVisibleMonthBadge();
  }

  function renderSidebarUpcoming() {
    var el = document.getElementById('rpbdd-upcoming-list');
    var badge = document.getElementById('rpbdd-upcoming-count');
    var hintEl = document.getElementById('rpbdd-month-events-hint');
    if (!el) return;

    if (badge) badge.textContent = String(countMonthWidgetBadge());

    if (hintEl) {
      if (state.sidebarSelectedYmd) {
        hintEl.hidden = false;
        hintEl.textContent = formatLongDateYmd(state.sidebarSelectedYmd);
      } else {
        hintEl.hidden = true;
        hintEl.textContent = '';
      }
    }

    var items = buildSidebarMonthItems();
    if (items.length === 0) {
      var emptyMsg = state.sidebarSelectedYmd
        ? 'No events on this date'
        : 'No upcoming events or holidays';
      el.innerHTML =
        '<div class="rpbdd-placeholder rpbdd-placeholder--month-empty">' + escapeHtml(emptyMsg) + '</div>';
      return;
    }

    el.innerHTML = items
      .map(function (item) {
        var dateLine = formatEventCardDatesLine(item.sidebarDates || [item.date]);
        var meta = escapeHtml(dateLine);
        if (!item.isHoliday && item.time) meta += ' · ' + escapeHtml(item.time);
        if (!item.isHoliday && item.status === 'done') meta += ' · Done';
        var col = sidebarItemAccent(item);
        var targetView = eventsPanelItemStatus(item) === 'done' ? 'done' : 'upcoming';
        var anchorYmd =
          (item.sidebarDates && item.sidebarDates[0]) || normalizeEventDateYmd(item.date) || '';
        var panelYm =
          anchorYmd.length >= 7 && /^\d{4}-\d{2}-\d{2}$/.test(anchorYmd) ? anchorYmd.slice(0, 7) : '';
        return (
          '<button type="button" class="rpbdd-month-event-item rpbdd-month-event-item--sidebar" data-goto-events="1" data-goto-event-title="' +
          encodeURIComponent(item.title || '') +
          '" data-goto-event-group-key="' +
          encodeURIComponent(eventGroupKey(item)) +
          '" data-goto-event-view="' +
          targetView +
          '" data-goto-event-panel-ym="' +
          encodeURIComponent(panelYm) +
          '" style="--rpbdd-ev-accent:' +
          col +
          ';border-left:4px solid ' +
          col +
          ';">' +
          '<span class="rpbdd-month-event-dot" style="background:' +
          col +
          '"></span>' +
          '<div class="rpbdd-month-event-body">' +
          '<strong class="rpbdd-month-event-title">' +
          escapeHtml(item.title) +
          '</strong>' +
          '<span class="rpbdd-month-event-meta">' +
          meta +
          '</span></div></button>'
        );
      })
      .join('');
    el.querySelectorAll('[data-goto-events]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = decodeURIComponent(b.getAttribute('data-goto-event-title') || '');
        var v = String(b.getAttribute('data-goto-event-view') || 'upcoming').toLowerCase();
        var ymRaw = decodeURIComponent(String(b.getAttribute('data-goto-event-panel-ym') || ''));
        if (/^\d{4}-\d{2}$/.test(ymRaw)) {
          var yp = ymRaw.split('-');
          state.eventsPanelDate = new Date(parseInt(yp[0], 10), parseInt(yp[1], 10) - 1, 1);
        } else {
          var cd = state.currentDate;
          state.eventsPanelDate = new Date(cd.getFullYear(), cd.getMonth(), 1);
        }
        state.eventsView = v === 'done' ? 'done' : 'upcoming';
        state.eventsSearch = '';
        var gkAttr = b.getAttribute('data-goto-event-group-key');
        state.pendingEventsExpandGroupKey =
          gkAttr != null && String(gkAttr).length ? decodeURIComponent(gkAttr) : null;
        state.eventsPanelPage = 1;
        document.querySelectorAll('[data-events-view]').forEach(function (pill) {
          pill.classList.toggle('is-active', pill.getAttribute('data-events-view') === state.eventsView);
        });
        setNav('events');
      });
    });
  }

  /** User events: same title + same location = one card (multiple dates). Holidays: stable key per synthetic row. */
  function eventGroupKey(e) {
    if (!e) return '';
    if (e.isHoliday) {
      return 'h:' + String(e.id != null ? e.id : String(e.title || '') + '|' + String(e.date || ''));
    }
    var t = String(e.title || '').trim().toLowerCase();
    var loc = String(e.location || '').trim().toLowerCase();
    return 'e:' + t + '\x1e' + loc;
  }

  function groupEventsByTitle(list) {
    var g = {};
    list.forEach(function (e) {
      var k = eventGroupKey(e);
      if (!g[k]) g[k] = [];
      g[k].push(e);
    });
    return g;
  }

  /** Prefer synthetic PH holiday row when merging with user events of the same title (Done/Upcoming cards). */
  function pickHolidayOrFirst(grp) {
    for (var i = 0; i < grp.length; i++) {
      if (grp[i].isHoliday) return grp[i];
    }
    return grp[0];
  }

  function minIsoYmdInList(rows) {
    var ds = rows.map(function (x) {
      return normalizeEventDateYmd(x.date) || String(x.date || '');
    }).filter(function (s) { return s; });
    if (ds.length === 0) return '';
    var best = ds[0];
    for (var j = 1; j < ds.length; j++) {
      if (ds[j].localeCompare(best) < 0) best = ds[j];
    }
    return best;
  }

  function userEventsInEventsPanelMonth() {
    var y = state.eventsPanelDate.getFullYear();
    var m = state.eventsPanelDate.getMonth();
    return state.events.filter(function (e) {
      var dNorm = normalizeEventDateYmd(e.date);
      if (!dNorm) return false;
      var p = dNorm.split('-');
      var ey = parseInt(p[0], 10);
      var em = parseInt(p[1], 10) - 1;
      return ey === y && em === m;
    });
  }

  function syntheticHolidaysForEventsPanelMonth() {
    var y = state.eventsPanelDate.getFullYear();
    var m = state.eventsPanelDate.getMonth();
    var t = todayYmd();
    return philippineObservedHolidaysInMonth(y, m).map(function (h) {
        var ds = y + '-' + pad2(m + 1) + '-' + pad2(h.date);
        return {
          id: 'ph-holiday-' + ds,
          title: h.name,
          date: ds,
          time: '',
          rawTime: '',
          category: 'Holiday',
          status: ds >= t ? 'upcoming' : 'done',
          isHoliday: true,
          firstDeclaredDate: h.firstDeclaredDate || '',
          approvedBy: h.approvedBy || '',
          law: h.law || '',
          lawUrl: h.lawUrl || '',
          description: h.description || 'Philippine national holiday.',
          descriptionSource: h.descriptionSource || '',
          descriptionUrl: h.descriptionUrl || '',
          trivia: h.trivia || '',
          triviaSource: h.triviaSource || '',
          triviaUrl: h.triviaUrl || '',
          whyCelebrated: h.whyCelebrated || '',
          location: '',
        };
      });
  }

  /** Detail fields for Chinese New Year synthetic Events cards (lunisolar civil date proclaimed yearly). */
  function chineseNewYearHolidaySyntheticDetail() {
    return {
      firstDeclaredDate: 'Lunar calendar (Spring Festival); civil date varies each year.',
      approvedBy: 'President of the Philippines (Presidential Proclamation)',
      law: 'Additional special non-working days are proclaimed yearly (Administrative Code / R.A. No. 9492 framework); Chinese New Year is widely included when its civil date is certified.',
      lawUrl: H_LAWPHIL_RA9492,
      description:
        'Chinese New Year follows the lunisolar calendar; the Philippines typically observes it as a special non-working day on the proclaimed civil date—confirm each year with the Presidential Proclamation and DOLE advisory.',
      descriptionSource: 'Official Gazette / Department of Labor and Employment',
      descriptionUrl: H_DOLE,
      trivia:
        'Ang Bagong Taon ng Tsino ay malapit sa kultura ng iba pang komunidad sa Pilipinas—may dragon dance, tikoy, at pagtitipon ng pamilya; ang ekaktong petsa sa kalendaryong sibil ay idinedeklara taon-taon.',
      triviaSource: 'Department of Labor and Employment',
      triviaUrl: H_DOLE,
      whyCelebrated:
        'Selebrasyon ng tagsibol at pagsalubong sa bagong taon sa kalendaryong Tsino—kasiyahan, biyaya, at ugnayan ng pamilya at komunidad.',
    };
  }

  /** Detail fields for expanded Events cards — R.A. 9177 / R.A. 9849 + yearly Presidential Proclamation (Philippines). */
  function muslimHolidaySyntheticDetail(name) {
    var n = String(name || '');
    var isAdha = /Adha|ADHA/i.test(n);
    var isRamadanStart = /Ramadan Mubarak|Beginning of Ramadan/i.test(n);
    if (isRamadanStart) {
      return {
        firstDeclaredDate:
          'First of Ramadan follows the Islamic (Hijri) calendar; the civil date may shift by one day with moon sighting.',
        approvedBy: 'National Commission on Muslim Filipinos (Islamic calendar guidance)',
        law: "Republic Act Nos. 9177 and 9849 establish nationwide legal holidays for Eid'l Fitr and Eid'l Adha only. Beginning of Ramadan is shown here for cultural and scheduling awareness (not the same category as those proclaimed feast days).",
        lawUrl: H_LAWPHIL_RA9177,
        description:
          'Ramadan is the ninth Hijri month of fasting and reflection. The date listed follows commonly published Philippine/NCMF-aligned calendars—confirm with your local Islamic authority if the first fast differs by one day.',
        descriptionSource: 'National Commission on Muslim Filipinos / Hijri calendar',
        descriptionUrl: 'https://www.officialgazette.gov.ph/',
        trivia:
          'Ang Ramadan ay lumilipat sa civil calendar kada taon. Ang Eid\'l Fitr sa dulo ng Ramadan ang isa sa dalawang pambansang holiday sa batas (kasama ang Eid\'l Adha).',
        triviaSource: 'Department of Labor and Employment',
        triviaUrl: H_DOLE,
        whyCelebrated:
          'Ramadan Mubarak — pagsalubong sa buwan ng pag-aayuno, dasal, at pagbabahagi sa komunidad.',
      };
    }
    return {
      firstDeclaredDate:
        'Dates follow the Islamic (Hijri) calendar; the civil date is proclaimed yearly by the President of the Philippines.',
      approvedBy: 'President of the Philippines (upon recommendation of the National Commission on Muslim Filipinos)',
      law: isAdha
        ? "Republic Act No. 9849 — national holiday for Eid'l Adha (Feast of Sacrifice), tenth of Zhul Hijja (Islamic calendar)."
        : "Republic Act No. 9177 — national holiday for Eid'l Fitr (Feast of Ramadhan), first of Shawwal (Islamic calendar).",
      lawUrl: isAdha ? H_LAWPHIL_RA9849 : H_LAWPHIL_RA9177,
      description:
        'The nationwide observance date for this Islamic feast is fixed each year by Presidential Proclamation in line with the Philippine national calendar, using the date certified by the National Commission on Muslim Filipinos (NCMF) according to the lunar/Hijri calendar.',
      descriptionSource: 'LawPhil / Official Gazette of the Philippines',
      descriptionUrl: 'https://www.officialgazette.gov.ph/',
      trivia:
        'Islamic holidays move on the civil calendar each year. Workers’ holiday pay rules follow DOLE advisories for the proclaimed date.',
      triviaSource: 'Department of Labor and Employment',
      triviaUrl: H_DOLE,
      whyCelebrated: isAdha
        ? "Eid'l Adha joins Filipino Muslims with Muslims worldwide in commemorating sacrifice and charity during Hajj season."
        : "Eid'l Fitr marks the end of Ramadan fasting — prayer, family, and charity across Muslim Filipino communities nationwide.",
    };
  }

  function syntheticMuslimHolidaysForEventsPanelMonth() {
    var y = state.eventsPanelDate.getFullYear();
    var m = state.eventsPanelDate.getMonth();
    var t = todayYmd();
    var rows = PH_MUSLIM_HOLIDAYS_BY_YEAR[y];
    if (!rows || !rows.length) return [];
    return rows
      .filter(function (h) {
        return h.month === m;
      })
      .map(function (h) {
        var ds = y + '-' + pad2(m + 1) + '-' + pad2(h.date);
        var slug = String(h.name || 'eid')
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-|-$/g, '');
        var meta = muslimHolidaySyntheticDetail(h.name);
        var row = {
          id: 'ph-muslim-' + y + '-' + ds + '-' + slug,
          title: h.name,
          date: ds,
          time: '',
          rawTime: '',
          category: 'Holiday',
          status: ds >= t ? 'upcoming' : 'done',
          isHoliday: true,
          isMuslimHoliday: true,
          location: '',
        };
        Object.assign(row, meta);
        return row;
      });
  }

  function syntheticChineseNewYearForEventsPanelMonth() {
    var y = state.eventsPanelDate.getFullYear();
    var m = state.eventsPanelDate.getMonth();
    var t = todayYmd();
    var row = PH_CHINESE_NEW_YEAR_BY_YEAR[y];
    if (!row || row.month !== m) return [];
    var ds = y + '-' + pad2(m + 1) + '-' + pad2(row.date);
    var meta = chineseNewYearHolidaySyntheticDetail();
    var out = Object.assign(
      {
        id: 'ph-cny-' + y + '-' + ds,
        title: row.name,
        date: ds,
        time: '',
        rawTime: '',
        category: 'Holiday',
        status: ds >= t ? 'upcoming' : 'done',
        isHoliday: true,
        location: '',
      },
      meta
    );
    return [out];
  }

  function combinedEventsForEventsPanelMonth() {
    return userEventsInEventsPanelMonth()
      .concat(syntheticHolidaysForEventsPanelMonth())
      .concat(syntheticMuslimHolidaysForEventsPanelMonth())
      .concat(syntheticChineseNewYearForEventsPanelMonth());
  }

  /**
   * Tab filter: PH holidays — past calendar day → Done (today still Upcoming).
   * User events — Done only if date is before today, or today and explicitly done; future dates stay Upcoming.
   */
  function eventsPanelItemStatus(e) {
    var t = todayYmd();
    var dNorm = normalizeEventDateYmd(e.date);
    if (e.isHoliday) {
      if (!dNorm) return 'upcoming';
      return dNorm < t ? 'done' : 'upcoming';
    }
    if (!dNorm) return 'upcoming';
    if (dNorm < t) return 'done';
    if (dNorm === t && normalizedStoredEventStatus(e.status) === 'done') return 'done';
    return 'upcoming';
  }

  function eventsPanelViewKey() {
    var v = String(state.eventsView || 'upcoming').toLowerCase();
    return v === 'done' ? 'done' : 'upcoming';
  }

  /** Auto-mark user events (not PH holidays) as done when date is before today — keeps Upcoming/Done in sync with the calendar. */
  function syncPastUserEventsToDone() {
    var t = todayYmd();
    var changed = false;
    state.events.forEach(function (e) {
      if (e.isHoliday) return;
      var d = normalizeEventDateYmd(e.date);
      if (d && d < t && normalizedStoredEventStatus(e.status) !== 'done') {
        e.status = 'done';
        changed = true;
      }
    });
    if (changed) saveEvents();
  }

  function updateEventsRecycleBarVisibility(viewKey) {
    var bar = document.getElementById('rpbdd-events-recycle-bar');
    if (!bar) return;
    var show = viewKey === 'done';
    bar.hidden = !show;
    bar.style.display = show ? 'flex' : 'none';
    bar.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function countEventsPanelUpcoming() {
    return combinedEventsForEventsPanelMonth().filter(function (e) {
      return eventsPanelItemStatus(e) === 'upcoming';
    }).length;
  }

  function countEventsPanelDone() {
    return combinedEventsForEventsPanelMonth().filter(function (e) {
      return eventsPanelItemStatus(e) === 'done';
    }).length;
  }

  function firstWordOfEventTitle(title) {
    var s = String(title || '').trim();
    if (!s) return '';
    var parts = s.split(/\s+/);
    return parts[0] || '';
  }

  /** True if the event's title's first word starts with q (case-insensitive). q is non-empty lowercased. */
  function eventFirstWordStartsWith(e, q) {
    var fw = firstWordOfEventTitle(e.title).toLowerCase();
    return fw.indexOf(q) === 0;
  }

  /**
   * Same group as the Events panel card (title + location for user events), current month, tab, and search.
   */
  function eventsPanelGroupKeyForRemoval(groupKey) {
    var viewKey = eventsPanelViewKey();
    var baseFiltered = combinedEventsForEventsPanelMonth().filter(function (e) {
      return eventsPanelItemStatus(e) === viewKey;
    });
    var searchQ = String(state.eventsSearch || '').trim().toLowerCase();
    var filtered = searchQ
      ? baseFiltered.filter(function (e) {
          return eventFirstWordStartsWith(e, searchQ);
        })
      : baseFiltered;
    var groups = groupEventsByTitle(filtered);
    var g = groups[groupKey];
    return g ? g.slice() : [];
  }

  /**
   * One Events-module style card (grouped by title + location for user events). Used by Events panel and Reports folder modal.
   * @param {object} expandBind { expandAttr: string, expandVal: string } for the clickable head row.
   */
  function eventCardHtmlFromTitleGroup(grp, expanded, includeActions, expandBind) {
    expandBind = expandBind || {};
    var expandAttr = expandBind.expandAttr || 'data-expand-event';
      var first = pickHolidayOrFirst(grp);
    var displayTitle = String(first.title || '');
    var groupKey = eventGroupKey(first);
    var expandVal =
      expandBind.expandVal != null ? expandBind.expandVal : encodeURIComponent(groupKey);
    var isMuslimHolidayCard = grp.some(function (x) {
      return x.isMuslimHoliday;
    });
    var isPhHolidayCard = grp.some(function (x) {
      return x.isHoliday;
    });
    var hasUserEvent = grp.some(function (x) {
      return !x.isHoliday;
    });
    var col = isMuslimHolidayCard
      ? MUSLIM_HOLIDAY_SIDEBAR_COLOR
      : isPhHolidayCard
        ? HOLIDAY_SIDEBAR_COLOR
        : sidebarItemAccent(first);
      var dates = grp
        .map(function (x) {
          return normalizeEventDateYmd(x.date) || x.date;
        })
        .sort();
    var catLabel = isMuslimHolidayCard
      ? 'Muslim holiday'
      : isPhHolidayCard
        ? 'Holiday'
        : categoryLabelForDisplay(first.category);
    var html = '';
      html +=
        '<div class="rpbdd-event-card' +
        (isPhHolidayCard ? ' rpbdd-event-card--holiday' : '') +
      (isMuslimHolidayCard ? ' rpbdd-event-card--holiday-muslim' : '') +
        '" data-is-holiday="' +
        (isPhHolidayCard ? '1' : '0') +
      '" data-is-birthday="0" style="--rpbdd-ev-accent:' +
        col +
        ';border-left:3px solid ' +
        col +
        ';">';
    html += '<div class="rpbdd-event-card-head" ' + expandAttr + '="' + expandVal + '">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">';
      html += '<div><div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem">';
      html += '<span style="width:1rem;height:1rem;border-radius:50%;background:' + col + '"></span>';
    html += '<strong>' + escapeHtml(displayTitle) + '</strong></div>';
      var cardDateLine = formatEventCardDatesLine(dates);
      html += '<div class="rpbdd-event-card-meta">';
      if (cardDateLine) html += escapeHtml(cardDateLine);
      if (!isPhHolidayCard && first.time) {
        html += (cardDateLine ? ' · ' : '') + escapeHtml(first.time);
      }
    html += '</div>';
    html += '</div>';
      html += '<span class="rpbdd-event-card-cat">' + escapeHtml(catLabel) + '</span></div></div>';

      if (expanded) {
        html += '<div class="rpbdd-event-card-body">';
        if (isPhHolidayCard) {
          if (first.firstDeclaredDate) {
            html +=
              '<p class="rpbdd-holiday-field"><strong>First declared</strong><br>' +
              escapeHtml(first.firstDeclaredDate) +
              '</p>';
          }
          if (first.approvedBy) {
            html +=
              '<p class="rpbdd-holiday-field"><strong>Approved by</strong><br>' +
              escapeHtml(first.approvedBy) +
              '</p>';
          }
          if (first.law) {
            html += '<p class="rpbdd-holiday-field"><strong>Law / R.A. / issuance</strong><br>' + escapeHtml(first.law);
            if (first.lawUrl) {
              html +=
                '<span class="rpbdd-holiday-source-line">Full text: ' +
                holidayRefLink(first.lawUrl, 'Open source') +
                '</span>';
            }
            html += '</p>';
          }
          if (first.description) {
            html += '<p class="rpbdd-holiday-field"><strong>Description</strong><br>' + escapeHtml(first.description);
            if (first.descriptionUrl) {
              html +=
                '<span class="rpbdd-holiday-source-line">Source: ' +
                holidayRefLink(first.descriptionUrl, first.descriptionSource || 'View source') +
                '</span>';
            } else if (first.descriptionSource) {
              html +=
                '<span class="rpbdd-holiday-source-line">' + escapeHtml(first.descriptionSource) + '</span>';
            }
            html += '</p>';
          }
          if (first.whyCelebrated) {
            html +=
              '<p class="rpbdd-holiday-field"><strong>Bakit ito ipinagdiriwang</strong>' +
              '<span class="rpbdd-holiday-why-hint"> — pananampalataya, kultura, at tradisyon ng mga Pilipino</span><br>' +
              escapeHtml(first.whyCelebrated) +
              '</p>';
          }
          if (first.trivia) {
            html +=
              '<p class="rpbdd-holiday-field"><strong>Mga kawili-wiling katotohanan</strong><br>' + escapeHtml(first.trivia);
            if (first.triviaUrl) {
              html +=
                '<span class="rpbdd-holiday-source-line">Source: ' +
                holidayRefLink(first.triviaUrl, first.triviaSource || 'View source') +
                '</span>';
            } else if (first.triviaSource) {
              html +=
                '<span class="rpbdd-holiday-source-line">' + escapeHtml(first.triviaSource) + '</span>';
            }
            html += '</p>';
          }
        } else {
          if (first.description) {
            html +=
              '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Description</strong><br>' +
              escapeHtml(first.description) +
              '</p>';
          }
        }
        if (first.location && !isPhHolidayCard) {
          html +=
            '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Location</strong><br>' +
            escapeHtml(first.location) +
            '</p>';
        }
        if (!isPhHolidayCard) {
          var by = String(first.createdBy || first.inputBy || '').trim();
          if (by) {
            html +=
              '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Input By</strong><br>' + escapeHtml(by) + '</p>';
          }
        }
      if (hasUserEvent && includeActions) {
            html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">';
              html +=
                '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--edit" data-edit-group-key="' +
                encodeURIComponent(groupKey) +
                '">' +
                svgIconEdit +
                '<span>Edit</span></button>';
              html +=
                '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--remove" data-del-group-key="' +
                encodeURIComponent(groupKey) +
                '">' +
                svgIconRemove +
                '<span>Remove</span></button>';
            html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    return html;
  }

  function renderEventsPanel() {
    syncPastUserEventsToDone();
    var viewKey = eventsPanelViewKey();
    updateEventsRecycleBarVisibility(viewKey);

    var listEl = document.getElementById('rpbdd-events-list');
    var cUp = document.getElementById('rpbdd-count-upcoming');
    var cDn = document.getElementById('rpbdd-count-done');
    var monthLabel = document.getElementById('rpbdd-events-month-label');
    if (cUp) cUp.textContent = String(countEventsPanelUpcoming());
    if (cDn) cDn.textContent = String(countEventsPanelDone());
    if (monthLabel) {
      var py = state.eventsPanelDate.getFullYear();
      var pm = state.eventsPanelDate.getMonth();
      monthLabel.textContent = monthNames[pm] + ' ' + py;
    }
    if (!listEl) return;
    listEl.setAttribute('data-events-list-view', viewKey);
    var baseFiltered = combinedEventsForEventsPanelMonth().filter(function (e) {
      return eventsPanelItemStatus(e) === viewKey;
    });
    var searchQ = String(state.eventsSearch || '').trim().toLowerCase();
    var filtered = searchQ
      ? baseFiltered.filter(function (e) {
          return eventFirstWordStartsWith(e, searchQ);
        })
      : baseFiltered;
    var pagEl = document.getElementById('rpbdd-events-pagination');
    if (pagEl) {
      pagEl.hidden = true;
      pagEl.innerHTML = '';
    }

    if (baseFiltered.length === 0) {
      listEl.innerHTML =
        '<div class="rpbdd-placeholder"><p>No ' +
        escapeHtml(viewKey) +
        ' events or holidays for this month</p></div>';
      state.eventsPanelPage = 1;
      return;
    }
    if (filtered.length === 0) {
      var showQ = String(state.eventsSearch || '').trim();
      listEl.innerHTML =
        '<div class="rpbdd-placeholder"><p>No ' +
        escapeHtml(viewKey) +
        ' items match <strong>' +
        escapeHtml(showQ) +
        '</strong> as the start of the first word of the title. Clear the search to see the full list.</p></div>';
      state.eventsPanelPage = 1;
      return;
    }

    var groups = groupEventsByTitle(filtered);
    var groupKeys = Object.keys(groups).sort(function (a, b) {
      var da = minIsoYmdInList(groups[a]);
      var db = minIsoYmdInList(groups[b]);
      return da.localeCompare(db) || a.localeCompare(b);
    });

    if (state.pendingEventsExpandGroupKey) {
      var focusKey = String(state.pendingEventsExpandGroupKey);
      var focusIndex = groupKeys.indexOf(focusKey);
      if (focusIndex >= 0) {
        state.eventsPanelPage = Math.floor(focusIndex / EVENTS_CARDS_PER_PAGE) + 1;
        state.expandedEventGroupKey = focusKey;
      }
      state.pendingEventsExpandGroupKey = null;
    }

    var totalPages = Math.max(1, Math.ceil(groupKeys.length / EVENTS_CARDS_PER_PAGE));
    if (state.eventsPanelPage > totalPages) state.eventsPanelPage = totalPages;
    if (state.eventsPanelPage < 1) state.eventsPanelPage = 1;
    var pageStart = (state.eventsPanelPage - 1) * EVENTS_CARDS_PER_PAGE;
    var keysPage = groupKeys.slice(pageStart, pageStart + EVENTS_CARDS_PER_PAGE);

    if (pagEl && totalPages > 1) {
      pagEl.hidden = false;
      for (var p = 1; p <= totalPages; p++) {
        var pb = document.createElement('button');
        pb.type = 'button';
        pb.textContent = String(p);
        pb.className = 'rpbdd-pill' + (p === state.eventsPanelPage ? ' is-active' : '');
        pb.setAttribute('aria-label', 'Page ' + p + ' of ' + totalPages);
        pb.addEventListener(
          'click',
          (function (pn) {
            return function () {
              state.eventsPanelPage = pn;
              state.expandedEventGroupKey = null;
              renderEventsPanel();
            };
          })(p),
        );
        pagEl.appendChild(pb);
      }
    }

    var html = '';
    keysPage.forEach(function (gk) {
      var grp = groups[gk];
      var expanded = state.expandedEventGroupKey === gk;
      var showEventActions = roleCanManageEventsRecycle();
      html += eventCardHtmlFromTitleGroup(grp, expanded, showEventActions, {
        expandAttr: 'data-expand-event',
        expandVal: encodeURIComponent(gk),
      });
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('[data-expand-event]').forEach(function (node) {
      node.addEventListener('click', function () {
        var t = decodeURIComponent(node.getAttribute('data-expand-event') || '');
        state.expandedEventGroupKey = state.expandedEventGroupKey === t ? null : t;
        renderEventsPanel();
      });
    });
    listEl.querySelectorAll('[data-edit-group-key]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var gk = decodeURIComponent(btn.getAttribute('data-edit-group-key') || '');
        var tabKey = eventsPanelViewKey();
        var userEv = null;
        for (var ei = 0; ei < state.events.length; ei++) {
          var ev = state.events[ei];
          if (eventGroupKey(ev) === gk && !ev.isHoliday && eventsPanelItemStatus(ev) === tabKey) {
            userEv = ev;
            break;
          }
        }
        if (!userEv) {
          for (var ej = 0; ej < state.events.length; ej++) {
            if (eventGroupKey(state.events[ej]) === gk && !state.events[ej].isHoliday) {
              userEv = state.events[ej];
              break;
            }
          }
        }
        if (!userEv) return;
        state.editingEvent = userEv;
        state.editingEventGroupKey = eventGroupKey(userEv);
        document.getElementById('edit-title').value = userEv.title;
        state.editEventDates = collectInitialEditEventDates(userEv);
        renderEditEventDateRows();
        document.getElementById('edit-description').value = userEv.description || '';
        document.getElementById('edit-location').value = userEv.location || '';
        document.getElementById('edit-time').value = userEv.rawTime || '';
        renderCategoryDropdowns(document.getElementById('add-category').value, canonicalCategoryKey(userEv.category) || '');
        openModal('modal-edit-event');
      });
    });
    listEl.querySelectorAll('[data-del-group-key]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!roleCanManageEventsRecycle()) return;
        var gk = decodeURIComponent(btn.getAttribute('data-del-group-key') || '');
        var grp = eventsPanelGroupKeyForRemoval(gk);
        var toDel = grp.filter(function (x) {
          return !x.isHoliday;
        });
        if (!toDel.length) return;
        var delLabel = toDel[0] && toDel[0].title ? String(toDel[0].title) : 'This event';
        openRpbddConfirm({
          variant: 'recycle',
          title: 'Move to Recycle Bin?',
          message: '“' + delLabel + '” goes to the Recycle Bin. Restore or delete it there anytime.',
          confirmLabel: 'Move to bin',
          cancelLabel: 'Keep',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          var base = getEventsApiBase();
          var dbSeen = {};
          var dbIds = [];
          toDel.forEach(function (x) {
            var id = canonicalEventDbId(x.dbId);
            if (id && !dbSeen[id]) {
              dbSeen[id] = true;
              dbIds.push(id);
            }
          });
          function applyLocalDeviceRemoval() {
            var ids = {};
            toDel.forEach(function (x) {
              ids[x.id] = true;
            });
            state.deletedEvents = state.deletedEvents.concat(toDel);
            state.events = state.events.filter(function (x) {
              return !ids[x.id];
            });
            state.expandedEventGroupKey = null;
            saveEvents();
            saveDeleted();
            render();
            renderRecycle();
          }
          if (base && dbIds.length > 0) {
            Promise.all(
              dbIds.map(function (did) {
                return fetch(base + '/' + encodeURIComponent(did) + '/to-recycle', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: '{}',
                }).then(function (r) {
                return r.json();
                });
              }),
            )
              .then(function (results) {
                var bad = null;
                for (var ri = 0; ri < results.length; ri++) {
                  if (!results[ri] || !results[ri].ok) {
                    bad = results[ri];
                    break;
                  }
                }
                if (bad) {
                  rpbddAlertMessage(formatRpbddApiError(bad, 'Could not move to Recycle Bin'));
                  return;
                }
                var removeDbSet = {};
                dbIds.forEach(function (id) {
                  removeDbSet[id] = true;
                });
                var localOnlyIds = {};
                toDel.forEach(function (x) {
                  if (!canonicalEventDbId(x.dbId)) localOnlyIds[x.id] = true;
                });
                var removedLocal = state.events.filter(function (x) {
                  var dk = canonicalEventDbId(x.dbId);
                  if (dk && removeDbSet[dk]) return true;
                  if (localOnlyIds[x.id]) return true;
                  return false;
                });
                var removedLocalOnly = removedLocal.filter(function (x) {
                  return !canonicalEventDbId(x.dbId);
                });
                state.deletedEvents = state.deletedEvents.concat(removedLocalOnly);
                state.events = state.events.filter(function (x) {
                  var dk = canonicalEventDbId(x.dbId);
                  if (dk && removeDbSet[dk]) return false;
                  if (localOnlyIds[x.id]) return false;
                  return true;
                });
                state.expandedEventGroupKey = null;
                saveEvents();
                saveDeleted();
                render();
                renderRecycle();
                broadcastEventsChanged();
              })
              .catch(function () {
                rpbddAlertMessage('Network error');
              });
            return;
          }
          applyLocalDeviceRemoval();
        });
      });
    });
  }

  function paginate(arr, page) {
    var start = (page - 1) * state.recordsPerPage;
    return arr.slice(start, start + state.recordsPerPage);
  }

  /**
   * Team toolbar (upper right): Total Teams → Add Team + Export;
   * Total Teams / Total Members → search + Print + Export (team leader: narrower search fields); Logs → search + Print + Export; Active Users → search only (no export).
   * Print runs immediately from the current view (no modal).
   */
  function syncTeamManagementToolbar() {
    var toolbar = document.querySelector('.rpbdd-toolbar--team');
    var addTeamBtn = document.getElementById('rpbdd-open-add-team');
    var addMemberBtn = document.getElementById('rpbdd-open-add-member');
    var exportPdfBtn = document.getElementById('rpbdd-team-export-pdf');
    var printBtn = document.getElementById('rpbdd-team-print');
    var logsSearchWrap = document.getElementById('rpbdd-team-logs-search-wrap');
    var activeSearchWrap = document.getElementById('rpbdd-team-active-search-wrap');
    var teamsSearchWrap = document.getElementById('rpbdd-team-teams-search-wrap');
    var membersSearchWrap = document.getElementById('rpbdd-team-members-search-wrap');
    var role = currentUserRole();
    var showTeam = state.teamView === 'teams' && role !== 'team_leader';
    var showMember = state.teamView === 'members';
    var showLogsTools = (role === 'admin' || role === 'team_leader') && state.teamView === 'logs';
    var showActiveSearch =
      (role === 'admin' || role === 'team_leader') && state.teamView === 'active';
    var showTeamsSearch =
      (role === 'admin' || role === 'team_leader') && state.teamView === 'teams';
    var showMembersSearch =
      (role === 'admin' || role === 'team_leader') && state.teamView === 'members';
    var showTeamExport =
      (role === 'admin' || role === 'team_leader') &&
      (state.teamView === 'teams' ||
        state.teamView === 'members' ||
        state.teamView === 'logs');
    if (addTeamBtn) {
      addTeamBtn.hidden = !showTeam;
      addTeamBtn.setAttribute('aria-hidden', showTeam ? 'false' : 'true');
    }
    if (addMemberBtn) {
      addMemberBtn.hidden = !showMember;
      addMemberBtn.setAttribute('aria-hidden', showMember ? 'false' : 'true');
    }
    if (exportPdfBtn) {
      exportPdfBtn.hidden = !showTeamExport;
      exportPdfBtn.setAttribute('aria-hidden', showTeamExport ? 'false' : 'true');
    }
    if (printBtn) {
      printBtn.hidden = !showTeamExport;
      printBtn.setAttribute('aria-hidden', showTeamExport ? 'false' : 'true');
    }
    if (logsSearchWrap) {
      logsSearchWrap.hidden = !showLogsTools;
      logsSearchWrap.setAttribute('aria-hidden', showLogsTools ? 'false' : 'true');
    }
    if (activeSearchWrap) {
      activeSearchWrap.hidden = !showActiveSearch;
      activeSearchWrap.setAttribute('aria-hidden', showActiveSearch ? 'false' : 'true');
    }
    if (teamsSearchWrap) {
      teamsSearchWrap.hidden = !showTeamsSearch;
      teamsSearchWrap.setAttribute('aria-hidden', showTeamsSearch ? 'false' : 'true');
    }
    if (membersSearchWrap) {
      membersSearchWrap.hidden = !showMembersSearch;
      membersSearchWrap.setAttribute('aria-hidden', showMembersSearch ? 'false' : 'true');
    }
    if (toolbar) {
      toolbar.classList.toggle(
        'is-logs-search',
        showLogsTools ||
          showActiveSearch ||
          showTeamsSearch ||
          showMembersSearch,
      );
      toolbar.classList.toggle('is-team-tm-toolbar', showTeamsSearch || showMembersSearch);
    }
  }

  /** Rows currently listed in the Team Export modal (same order as table checkboxes). */
  var teamExportModalRows = [];
  function ymdComparableFromRaw(raw) {
    var p = parseYmdPartsFromRaw(raw);
    if (!p) return null;
    return p.y * 10000 + p.mo * 100 + p.d;
  }

  function logPassesTeamExportDateFilter(r, fromInput, toInput) {
    var fromY = fromInput && String(fromInput).trim();
    var toY = toInput && String(toInput).trim();
    if (!fromY && !toY) return true;
    var rowRaw = getLogRowDateRaw(r);
    var rn = ymdComparableFromRaw(rowRaw);
    if (rn == null) return false;
    var fn = fromY ? ymdComparableFromRaw(fromY) : null;
    var tn = toY ? ymdComparableFromRaw(toY) : null;
    if (fn != null && rn < fn) return false;
    if (tn != null && rn > tn) return false;
    return true;
  }

  function getTeamExportSourceRows() {
    var v = state.teamView;
    if (v === 'logs') {
      var q = String(state.teamLogsSearch || '').trim().toLowerCase();
      return state.userLogs.filter(function (r) {
        return matchesTeamLogsSearch(r, q);
      });
    }
    if (v === 'teams') {
      var tq = String(state.teamTeamsSearch || '').trim().toLowerCase();
      return state.teams.filter(function (t) {
        return matchesTeamsSearch(t, tq);
      });
    }
    if (v === 'members') {
      var memQ = String(state.teamMembersSearch || '').trim().toLowerCase();
      return state.teamMembers.filter(function (m) {
        return matchesMembersSearch(m, memQ);
      });
    }
    if (v === 'active') {
      var aq = String(state.teamActiveSearch || '').trim().toLowerCase();
      return buildActiveUsersData().filter(function (m) {
        return matchesActiveUsersSearch(m, aq);
      });
    }
    return [];
  }

  function applyTeamExportDateFilter(rows) {
    if (state.teamView !== 'logs') return rows;
    var fromEl = document.getElementById('rpbdd-export-date-from');
    var toEl = document.getElementById('rpbdd-export-date-to');
    var fromV = fromEl ? fromEl.value : '';
    var toV = toEl ? toEl.value : '';
    return rows.filter(function (r) {
      return logPassesTeamExportDateFilter(r, fromV, toV);
    });
  }

  function exportTableHeadersForView(view) {
    if (view === 'logs') {
      return ['', 'Full Name', 'Email', 'Team', 'Role', 'Login', 'Logout', 'Date'];
    }
    if (view === 'teams') {
      return ['', 'Lead ID', 'Email', 'Section Chief', 'Section Team', 'Position'];
    }
    if (view === 'members' || view === 'active') {
      return ['', 'Email', 'Team'];
    }
    return ['', '—'];
  }

  function exportRowCellsForView(view, row, opts) {
    opts = opts || {};
    if (view === 'logs') {
      var rawD = getLogRowDateRaw(row);
      var dateCell = opts.pdf
        ? formatExportLongDateFromIso(sanitizeLogDateRaw(rawD)) || '—'
        : sanitizeLogDateRaw(rawD) || '—';
      return [
        formatUserLogCell(row.fullName),
        formatUserLogCell(row.email),
        formatUserLogCell(row.team),
        formatUserLogRoleDisplay(row),
        formatUserLogTime12h(row.login),
        formatUserLogLogoutCell(row.logout),
        dateCell,
      ];
    }
    if (view === 'teams') {
      return [
        formatTeamCardField(teamLeadId(row)),
        formatTeamCardField(row.email),
        formatTeamCardField(row.teamLeader),
        formatTeamCardField(row.sectionTeam),
        formatTeamCardField(row.position),
      ];
    }
    if (view === 'members' || view === 'active') {
      return [
        formatTeamCardField(row.email),
        formatTeamCardField(row.team),
      ];
    }
    return [];
  }

  function updateTeamExportDateHint() {
    var hint = document.getElementById('rpbdd-export-date-hint');
    if (!hint) return;
    if (state.teamView === 'logs') {
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  function updateTeamExportSelectionCount() {
    var el = document.getElementById('rpbdd-export-selected-count');
    if (!el) return;
    var tbody = document.getElementById('rpbdd-export-table-body');
    if (!tbody) return;
    var checks = tbody.querySelectorAll('.rpbdd-export-row-check');
    var n = 0;
    for (var i = 0; i < checks.length; i++) {
      if (checks[i].checked) n++;
    }
    var total = checks.length;
    el.textContent = '(' + n + ' selected' + (total ? ' of ' + total : '') + ')';
  }

  function renderTeamExportModalTable() {
    updateTeamExportDateHint();
    var view = state.teamView;
    var source = getTeamExportSourceRows();
    var rows = applyTeamExportDateFilter(source);
    teamExportModalRows = rows;
    var headers = exportTableHeadersForView(view);
    var headRow = document.getElementById('rpbdd-export-table-head-row');
    var tbody = document.getElementById('rpbdd-export-table-body');
    if (!headRow || !tbody) return;
    headRow.innerHTML = headers
      .map(function (h, i) {
        if (i === 0) {
          return '<th class="rpbdd-export-th-check" scope="col"><span class="rpbdd-sr-only">Select</span></th>';
        }
        return '<th scope="col">' + escapeHtml(h) + '</th>';
      })
      .join('');
    if (rows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="' +
        headers.length +
        '" class="rpbdd-placeholder" style="text-align:center;padding:1.25rem">No records match the current filter.</td></tr>';
      updateTeamExportSelectionCount();
      return;
    }
    tbody.innerHTML = rows
      .map(function (row, idx) {
        var cells = exportRowCellsForView(view, row);
        var tds = cells
          .map(function (c) {
            return '<td>' + escapeHtml(String(c)) + '</td>';
          })
          .join('');
        return (
          '<tr class="rpbdd-export-tr">' +
          '<td class="rpbdd-export-td-check"><input type="checkbox" class="rpbdd-export-row-check" data-export-i="' +
          idx +
          '" checked aria-label="Select row for export"></td>' +
          tds +
          '</tr>'
        );
      })
      .join('');
    updateTeamExportSelectionCount();
  }

  function openTeamExportModal() {
    renderTeamExportModalTable();
    openModal('modal-team-export');
  }

  function formatExportLongDateFromIso(ymd) {
    if (!ymd || typeof ymd !== 'string') return '';
    var m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    var d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '.';
  }

  function computeExportTeamLabelForPrint(view, selectedIdx, modalRows) {
    modalRows = modalRows || teamExportModalRows;
    var u = state.currentUser || {};
    var role = currentUserRole();
    if (role === 'team_leader') {
      var sec = String(u.sectionTeam || u.team || '').trim();
      if (sec) return sec;
    }
    var map = {};
    for (var si = 0; si < selectedIdx.length; si++) {
      var idx = selectedIdx[si];
      var row = modalRows[idx];
      if (!row) continue;
      var t = '';
      if (view === 'logs') t = String(row.team || '').trim();
      else if (view === 'teams') t = String(row.sectionTeam || row.section_team || '').trim();
      else if (view === 'members' || view === 'active') t = String(row.team || '').trim();
      if (t) map[t] = true;
    }
    var keys = Object.keys(map).sort();
    if (keys.length === 0) return '—';
    if (keys.length === 1) return keys[0];
    return keys.join(', ');
  }

  function computeExportDateRangeLabelForPrint(view, selectedIdx, dateFromId, dateToId, modalRows) {
    modalRows = modalRows || teamExportModalRows;
    var fromV = '';
    var toV = '';
    var skipDom = dateFromId === false && dateToId === false;
    if (!skipDom) {
      var df = dateFromId || 'rpbdd-export-date-from';
      var dt = dateToId || 'rpbdd-export-date-to';
      var fromEl = document.getElementById(df);
      var toEl = document.getElementById(dt);
      fromV = fromEl ? String(fromEl.value || '').trim() : '';
      toV = toEl ? String(toEl.value || '').trim() : '';
    }
    var a = formatExportLongDateFromIso(fromV);
    var b = formatExportLongDateFromIso(toV);
    if (a && b) return a + ' to ' + b;
    if (a) return 'From ' + a;
    if (b) return 'Through ' + b;
    if (view === 'logs' && selectedIdx.length) {
      var list = [];
      for (var i = 0; i < selectedIdx.length; i++) {
        var row = modalRows[selectedIdx[i]];
        if (!row) continue;
        var clean = sanitizeLogDateRaw(getLogRowDateRaw(row));
        if (clean) list.push(clean);
      }
      list.sort();
      if (list.length) {
        var lo = formatExportLongDateFromIso(list[0]);
        var hi = formatExportLongDateFromIso(list[list.length - 1]);
        if (lo && hi) return lo === hi ? lo : lo + ' to ' + hi;
      }
    }
    if (view === 'logs') return 'All dates';
    return 'All records';
  }

  /** Build POST body for PDF export from the Export modal. */
  function buildTeamExportPayloadFromModal() {
    var tbody = document.getElementById('rpbdd-export-table-body');
    if (!tbody) return null;
    var view = state.teamView;
    var headers = exportTableHeadersForView(view).filter(function (h) {
      return h !== '';
    });
    var checks = tbody.querySelectorAll('.rpbdd-export-row-check');
    var selectedIdx = [];
    for (var i = 0; i < checks.length; i++) {
      if (checks[i].checked) {
        var ii = parseInt(checks[i].getAttribute('data-export-i'), 10);
        if (!isNaN(ii)) selectedIdx.push(ii);
      }
    }
    if (selectedIdx.length === 0) {
      openRpbddAlert({
        title: 'Export to PDF',
        message: 'Select at least one record first.',
        okLabel: 'OK',
      });
      return null;
    }
    var rows = [];
    var memberTableGroups = null;
    var useAdminMemberTeamTables =
      view === 'members' && currentUserRole() === 'admin';

    if (useAdminMemberTeamTables) {
      var buckets = {};
      for (var j0 = 0; j0 < selectedIdx.length; j0++) {
        var ix = selectedIdx[j0];
        var rowB = teamExportModalRows[ix];
        if (!rowB) continue;
        var teamKey = String(rowB.team || '').trim() || '—';
        if (!Object.prototype.hasOwnProperty.call(buckets, teamKey)) {
          buckets[teamKey] = [];
        }
        var cellsB = exportRowCellsForView(view, rowB, { pdf: true });
        buckets[teamKey].push(
          cellsB.map(function (c) {
            return String(c);
          }),
        );
      }
      var sortedKeys = Object.keys(buckets).sort(function (a, b) {
        return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
      });
      memberTableGroups = sortedKeys.map(function (k) {
        return {
          label: k === '—' ? '— (no team)' : k,
          rows: buckets[k],
        };
      });
      for (var rg = 0; rg < memberTableGroups.length; rg++) {
        rows = rows.concat(memberTableGroups[rg].rows);
      }
    } else {
      for (var j = 0; j < selectedIdx.length; j++) {
        var idx = selectedIdx[j];
        var row = teamExportModalRows[idx];
        if (!row) continue;
        var cells = exportRowCellsForView(view, row, { pdf: true });
        rows.push(
          cells.map(function (c) {
            return String(c);
          }),
        );
      }
    }
    if (rows.length === 0) {
      openRpbddAlert({
        title: 'Export to PDF',
        message: 'No valid rows to export.',
        okLabel: 'OK',
      });
      return null;
    }
    var payload = {
      view: view,
      headers: headers,
      rows: rows,
      teamLabel: computeExportTeamLabelForPrint(view, selectedIdx, teamExportModalRows),
      dateRangeLabel: computeExportDateRangeLabelForPrint(
        view,
        selectedIdx,
        'rpbdd-export-date-from',
        'rpbdd-export-date-to',
        teamExportModalRows,
      ),
    };
    if (memberTableGroups && memberTableGroups.length > 0) {
      payload.memberTableGroups = memberTableGroups;
    }
    return payload;
  }

  /** Build POST body for Print from the current Team Management view (toolbar search + view; all matching rows). */
  function buildTeamPrintPayloadForDirectPrint() {
    var view = state.teamView;
    var dataRows = getTeamExportSourceRows();
    if (!dataRows || dataRows.length === 0) {
      openRpbddAlert({
        title: 'Print',
        message: 'No records to print for this view. Adjust search or switch view.',
        okLabel: 'OK',
      });
      return null;
    }
    var headers = exportTableHeadersForView(view).filter(function (h) {
      return h !== '';
    });
    var selectedIdx = [];
    for (var si = 0; si < dataRows.length; si++) {
      selectedIdx.push(si);
    }
    var prows = [];
    var pmemberTableGroups = null;
    var pUseAdminMemberTables = view === 'members' && currentUserRole() === 'admin';

    if (pUseAdminMemberTables) {
      var pbuckets = {};
      for (var p0 = 0; p0 < selectedIdx.length; p0++) {
        var pix = selectedIdx[p0];
        var prowB = dataRows[pix];
        if (!prowB) continue;
        var pteamKey = String(prowB.team || '').trim() || '—';
        if (!Object.prototype.hasOwnProperty.call(pbuckets, pteamKey)) {
          pbuckets[pteamKey] = [];
        }
        var pcellsB = exportRowCellsForView(view, prowB, { pdf: true });
        pbuckets[pteamKey].push(
          pcellsB.map(function (c) {
            return String(c);
          }),
        );
      }
      var psortedKeys = Object.keys(pbuckets).sort(function (a, b) {
        return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
      });
      pmemberTableGroups = psortedKeys.map(function (k) {
        return {
          label: k === '—' ? '— (no team)' : k,
          rows: pbuckets[k],
        };
      });
      for (var prg = 0; prg < pmemberTableGroups.length; prg++) {
        prows = prows.concat(pmemberTableGroups[prg].rows);
      }
    } else {
      for (var pj = 0; pj < selectedIdx.length; pj++) {
        var pidx = selectedIdx[pj];
        var prow = dataRows[pidx];
        if (!prow) continue;
        var pcells = exportRowCellsForView(view, prow, { pdf: true });
        prows.push(
          pcells.map(function (c) {
            return String(c);
          }),
        );
      }
    }
    if (prows.length === 0) {
      openRpbddAlert({
        title: 'Print',
        message: 'No valid rows to print.',
        okLabel: 'OK',
      });
      return null;
    }
    var ppayload = {
      view: view,
      headers: headers,
      rows: prows,
      teamLabel: computeExportTeamLabelForPrint(view, selectedIdx, dataRows),
      dateRangeLabel: computeExportDateRangeLabelForPrint(view, selectedIdx, false, false, dataRows),
    };
    if (pmemberTableGroups && pmemberTableGroups.length > 0) {
      ppayload.memberTableGroups = pmemberTableGroups;
    }
    return ppayload;
  }

  function runTeamPrint() {
    var printBase = getTeamExportPrintUrl();
    if (!printBase) {
      openRpbddAlert({
        title: 'Print',
        message: 'Print is not configured. Check routes (team-export/print).',
        okLabel: 'OK',
      });
      return;
    }
    var payload = buildTeamPrintPayloadForDirectPrint();
    if (!payload) return;
    // Use a hidden iframe instead of window.open('about:blank') so the user never sees an empty tab;
    // the server HTML includes a script that calls window.print() inside this frame.
    var oldFrame = document.getElementById('rpbdd-team-print-frame');
    if (oldFrame && oldFrame.parentNode) {
      oldFrame.parentNode.removeChild(oldFrame);
    }
    var printFrame = document.createElement('iframe');
    printFrame.id = 'rpbdd-team-print-frame';
    printFrame.setAttribute('title', 'Print document');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.cssText =
      'position:fixed;left:-9999px;top:0;width:210mm;min-height:297mm;border:0;margin:0;padding:0;overflow:hidden';
    document.body.appendChild(printFrame);
    var printWin = printFrame.contentWindow;
    if (!printWin || !printFrame.contentDocument) {
      if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
      openRpbddAlert({
        title: 'Print',
        message: 'Could not prepare print preview in this browser.',
        okLabel: 'OK',
      });
      return;
    }
    function removePrintFrame() {
      try {
        if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
      } catch (eRm) {
        /* ignore */
      }
    }
    var removeAfterPrintBound = false;
    function bindRemoveAfterPrint() {
      if (removeAfterPrintBound) return;
      removeAfterPrintBound = true;
      try {
        printWin.addEventListener('afterprint', removePrintFrame);
      } catch (eAp) {
        /* ignore */
      }
      setTimeout(removePrintFrame, 120000);
    }
    fetch(printBase, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'text/html', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        var ct = (res.headers.get('Content-Type') || '').toLowerCase();
        if (!res.ok) {
          return res.text().then(function (text) {
            var msg = 'Print failed';
            try {
              var jo = text ? JSON.parse(text) : null;
              if (jo && (jo.error || jo.message)) msg = String(jo.error || jo.message);
            } catch (e1) {
              if (text && text.trim()) msg = text.trim().slice(0, 240);
            }
            throw new Error(msg + (res.status ? ' (HTTP ' + res.status + ')' : ''));
          });
        }
        if (ct.indexOf('text/html') === -1) {
          return res.text().then(function (text) {
            throw new Error(text ? text.slice(0, 240) : 'Server did not return HTML.');
          });
        }
        return res.text();
      })
      .then(function (html) {
        if (!html || !String(html).trim()) {
          throw new Error('Empty print document.');
        }
        var doc = printFrame.contentDocument || printWin.document;
        doc.open();
        doc.write(html);
        doc.close();
        bindRemoveAfterPrint();
      })
      .catch(function (err) {
        removePrintFrame();
        openRpbddAlert({
          title: 'Print',
          message: String(err && err.message ? err.message : err),
          okLabel: 'OK',
        });
      });
  }

  function runTeamExportToPdf() {
    var pdfBase = getTeamExportPdfUrl();
    if (!pdfBase) {
      openRpbddAlert({
        title: 'Export to PDF',
        message: 'PDF export is not configured. Check routes and run composer install (dompdf).',
        okLabel: 'OK',
      });
      return;
    }
    var payload = buildTeamExportPayloadFromModal();
    if (!payload) return;
    var view = payload.view;
    fetch(pdfBase, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/pdf', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        var ct = (res.headers.get('Content-Type') || '').toLowerCase();
        if (!res.ok) {
          return res.text().then(function (text) {
            var msg = 'Export failed';
            try {
              var jo = text ? JSON.parse(text) : null;
              if (jo && (jo.error || jo.message)) msg = String(jo.error || jo.message);
            } catch (e1) {
              if (text && text.trim()) msg = text.trim().slice(0, 240);
            }
            throw new Error(msg + (res.status ? ' (HTTP ' + res.status + ')' : ''));
          });
        }
        if (ct.indexOf('application/pdf') === -1) {
          return res.text().then(function (text) {
            throw new Error(text ? text.slice(0, 240) : 'Server did not return a PDF.');
          });
        }
        return res.blob();
      })
      .then(function (blob) {
        if (!blob || blob.size === 0) {
          throw new Error('Empty PDF file.');
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'RPBDD-Export-' + view + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        closeModal('modal-team-export');
      })
      .catch(function (err) {
        openRpbddAlert({
          title: 'Export to PDF',
          message: String(err && err.message ? err.message : err),
          okLabel: 'OK',
        });
      });
  }

  function matchesTeamLogsSearch(r, q) {
    if (!q) return true;
    var norm = function (v) {
      if (v == null) return '';
      return String(v).replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
    };
    var rawDate = getLogRowDateRaw(r);
    var haystack = [
      norm(r && r.fullName),
      norm(r && r.team),
      formatUserLogRoleDisplay(r),
      norm(rawDate),
      formatLogDateLongFromRaw(rawDate),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  /** Active Users toolbar search: same substring style as Logs but no date fields. */
  function matchesActiveUsersSearch(m, q) {
    if (!q) return true;
    var norm = function (v) {
      if (v == null) return '';
      return String(v).replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
    };
    var mid = m && m.id != null ? String(m.id) : '';
    var isLeaderRow = mid.indexOf('leader-') === 0;
    var parts = [
      norm(m && m.name),
      norm(m && m.fullName),
      norm(m && m.Full_Name),
      norm(m && m.full_name),
      norm(m && m.email),
      norm(m && m.team),
      norm(m && m.role),
      norm(m && m.employeeId),
    ];
    if (isLeaderRow) {
      parts.push('Section Chief');
    } else {
      parts.push('Member');
    }
    var haystack = parts.join(' ').toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  /** Total Teams toolbar search (admin: all main fields; team_leader: team leader name, email, position only). */
  function matchesTeamsSearch(t, q) {
    if (!q) return true;
    var norm = function (v) {
      if (v == null) return '';
      return String(v).replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
    };
    if (currentUserRole() === 'team_leader') {
      var hayTl = [norm(t && t.teamLeader), norm(t && t.email), norm(t && t.position)]
        .join(' ')
        .toLowerCase();
      return hayTl.indexOf(q) !== -1;
    }
    var namesJoined = '';
    if (t && Array.isArray(t.memberNames) && t.memberNames.length > 0) {
      namesJoined = t.memberNames
        .map(function (n) {
          return norm(n);
        })
        .join(' ');
    }
    var haystack = [
      norm(teamLeadId(t)),
      norm(t && t.email),
      norm(t && t.teamLeader),
      norm(t && t.sectionTeam),
      norm(t && t.position),
      namesJoined,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  /**
   * Total Members toolbar search (admin: same breadth as Active Users;
   * team_leader: display name + email).
   */
  function matchesMembersSearch(m, q) {
    if (!q) return true;
    if (currentUserRole() === 'team_leader') {
      var normM = function (v) {
        if (v == null) return '';
        return String(v).replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
      };
      var nm = memberDisplayLabel(m);
      var hayTl = [normM(nm), normM(m && m.email)].join(' ').toLowerCase();
      return hayTl.indexOf(q) !== -1;
    }
    return matchesActiveUsersSearch(m, q);
  }

  function applyRoleBasedUi() {
    var role = currentUserRole();
    var teamNavBtn = document.querySelector('[data-nav="team"]');
    if (role === 'member') {
      if (teamNavBtn) {
        teamNavBtn.hidden = true;
        teamNavBtn.setAttribute('aria-hidden', 'true');
      }
      if (state.activeNav === 'team') setNav('dashboard');
      syncEventsRecycleBinChrome();
      if (state.activeNav === 'events') renderEventsPanel();
      return;
    }
    if (teamNavBtn) {
      teamNavBtn.hidden = false;
      teamNavBtn.setAttribute('aria-hidden', 'false');
    }
    var teamsViewBtn = document.getElementById('rpbdd-team-view-teams');
    if (teamsViewBtn) {
      teamsViewBtn.hidden = false;
      teamsViewBtn.setAttribute('aria-hidden', 'false');
    }
    syncEventsRecycleBinChrome();
    if (state.activeNav === 'events') renderEventsPanel();
  }

  function formatTeamCardField(v) {
    if (v == null) return '—';
    var s = String(v).trim();
    return s === '' ? '—' : s;
  }

  function buildActiveUsersData() {
    var role = currentUserRole();
    var out = [];
    var seen = {};
    state.teamMembers.forEach(function (m) {
      if (!m || !m.online) return;
      var key = 'm:' + String(m.email || m.id || '');
      if (seen[key]) return;
      seen[key] = true;
      out.push(m);
    });
    // Section Chief portal: Active Users should list members only.
    if (role === 'team_leader') return out;

    state.teams.forEach(function (t) {
      if (!t || !t.online) return;
      var em = String(t.email || '').trim();
      var key = 'l:' + em;
      if (seen[key]) return;
      seen[key] = true;
      out.push({
        id: 'leader-' + String(t.id),
        employeeId: t.leadId || t.idNumber || '',
        name: (t.teamLeader || '').trim() || 'Section Chief',
        email: em,
        password: t.password || '',
        passwordPlain: t.passwordPlain || '',
        hasPassword: !!t.hasPassword,
        team: String((t.sectionTeam || '').trim() || (t.teamLeader || '').trim()),
        role: (t.position || '').trim() || 'Section Chief',
        photo: t.photo || null,
        online: true,
      });
    });
    return out;
  }

  function teamLocalTimestampNow() {
    var d = new Date();
    function p(n) {
      return n < 10 ? '0' + n : String(n);
    }
    return (
      d.getFullYear() +
      '-' +
      p(d.getMonth() + 1) +
      '-' +
      p(d.getDate()) +
      ' ' +
      p(d.getHours()) +
      ':' +
      p(d.getMinutes()) +
      ':' +
      p(d.getSeconds())
    );
  }

  function memberCardHeadPhotoHtml(m) {
    var photo = m && m.photo;
    if (photo && typeof photo === 'string' && photo.length > 0) {
      return (
        '<div class="rpbdd-team-card-head-photo">' +
        '<img src="' +
        escapeHtml(photo) +
        '" alt="">' +
        '</div>'
      );
    }
    var nm = (m ? memberDisplayLabel(m) : '').trim() || '?';
    var initials = nm
      .split(/\s+/)
      .filter(function (x) { return x.length > 0; })
      .map(function (n) { return n[0]; })
      .join('')
      .toUpperCase()
      .slice(0, 2);
    if (!initials) initials = '?';
    return (
      '<div class="rpbdd-team-card-head-photo rpbdd-team-card-head-photo--fallback">' +
      escapeHtml(initials) +
      '</div>'
    );
  }

  function teamCardHeadPhotoHtml(t) {
    var photo = t.photo;
    if (photo && typeof photo === 'string' && photo.length > 0) {
      return (
        '<div class="rpbdd-team-card-head-photo">' +
        '<img src="' +
        escapeHtml(photo) +
        '" alt="">' +
        '</div>'
      );
    }
    var nm = (t.teamLeader || '?').trim();
    var initials = nm
      .split(/\s+/)
      .filter(function (x) { return x.length > 0; })
      .map(function (n) { return n[0]; })
      .join('')
      .toUpperCase()
      .slice(0, 2);
    if (!initials) initials = '?';
    return (
      '<div class="rpbdd-team-card-head-photo rpbdd-team-card-head-photo--fallback">' +
      escapeHtml(initials) +
      '</div>'
    );
  }

  /** Key/value row for Team Management cards — same pattern as Tasks meta list. */
  function teamMgmtMetaLi(label, valueHtml) {
    return (
      '<li><span class="rpbdd-tasks-meta-k">' +
      escapeHtml(label) +
      '</span><span class="rpbdd-tasks-meta-v">' +
      valueHtml +
      '</span></li>'
    );
  }

  /**
   * Total Teams card. Admin: full password field + show/hide; Edit/Remove.
   * Section Chief (readOnly): same card layout; password line shows only "..." (no eye icon); no actions.
   * Shell matches Tasks module: article.rpbdd-tasks-card + head row + meta list body.
   */
  function renderTeamCardHtml(t, opts) {
    opts = opts || {};
    var readOnly = !!opts.readOnly;
    var tid = String(t.id);
    var expanded = state.expandedTeamId !== null && String(state.expandedTeamId) === tid;
    var col = '#3b82f6';
    var leadLine = (t.teamLeader || '').trim();
    var lead = leadLine ? escapeHtml(leadLine) : '—';
    var secRaw = (t.sectionTeam || '').trim();
    var posRaw = (t.position || '').trim();
    var sec = escapeHtml(secRaw);
    var pos = escapeHtml(posRaw);
    var headSectionLine = secRaw ? sec : '—';

    var pwPlain = typeof t.passwordPlain === 'string' ? t.passwordPlain : '';
    if (!pwPlain && t.password && String(t.password) !== '••••••••') {
      pwPlain = String(t.password);
    }
    var hasPw = (t.hasPassword && pwPlain !== '') || pwPlain !== '';
    var pwInputId = 'rpbdd-team-pw-' + tid.replace(/[^a-zA-Z0-9_-]/g, '_');

    var html = '';
    html +=
      '<article class="rpbdd-tasks-card rpbdd-team-mgmt-card rpbdd-team-mgmt-card--team rpbdd-team-card" style="--rpbdd-team-accent:' +
      col +
      '">';
    html += '<div class="rpbdd-tasks-card-head">';
    html += '<div class="rpbdd-tasks-card-head-row">';
    html +=
      '<div class="rpbdd-tasks-card-head-main" data-expand-team-id="' +
      encodeURIComponent(tid) +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">';
    html += '<h3 class="rpbdd-tasks-card-title rpbdd-team-card-head-title">' + lead + '</h3>';
    html += '<p class="rpbdd-tasks-card-created">' + headSectionLine + '</p>';
    html += '</div>';
    html += '<div class="rpbdd-tasks-card-head-side">';
    html += teamCardHeadPhotoHtml(t);
    html += '<span class="rpbdd-pill rpbdd-team-mgmt-card__role-pill">Section Chief</span>';
    html += '</div>';
    html += '</div></div>';

    html += '<div class="rpbdd-tasks-card-body' + (expanded ? '' : ' is-collapsed') + '">';
    html += '<ul class="rpbdd-tasks-card-meta-list">';
    html += teamMgmtMetaLi('Lead ID', escapeHtml(formatTeamCardField(teamLeadId(t))));
    html += teamMgmtMetaLi('Section Chief', lead);
    html += teamMgmtMetaLi('Email', escapeHtml(formatTeamCardField(t.email)));
    html += '<li><span class="rpbdd-tasks-meta-k">Password</span><span class="rpbdd-tasks-meta-v rpbdd-tasks-meta-v--stack">';
    if (readOnly) {
      if (hasPw || t.hasPassword) {
        html += '<span class="rpbdd-team-mgmt-card__pw-muted">...</span>';
      } else {
        html += '<span class="rpbdd-team-mgmt-card__pw-muted">—</span>';
      }
    } else if (hasPw) {
      html += '<div class="rpbdd-input-wrap rpbdd-input-wrap--modal-pw rpbdd-input-wrap--card-pw">';
      html +=
        '<svg class="rpbdd-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      html +=
        '<input class="rpbdd-input rpbdd-input--simple rpbdd-input--pr" type="password" readonly id="' +
        pwInputId +
        '" value="' +
        escapeHtml(pwPlain) +
        '">';
      html +=
        '<button type="button" class="rpbdd-toggle-pw" data-toggle-password="' +
        pwInputId +
        '" aria-label="Show password" aria-pressed="false">';
      html +=
        '<span class="rpbdd-toggle-pw__icon rpbdd-toggle-pw__icon--masked" aria-hidden="true">' +
        svgPwToggleMasked +
        '</span>';
      html +=
        '<span class="rpbdd-toggle-pw__icon rpbdd-toggle-pw__icon--visible" aria-hidden="true" hidden>' +
        svgPwToggleVisible +
        '</span>';
      html += '</button></div>';
    } else {
      html += '<span class="rpbdd-team-mgmt-card__pw-muted">—</span>';
    }
    html += '</span></li>';
    html += teamMgmtMetaLi('Section Team', sec);
    html += teamMgmtMetaLi('Position', pos);
    var memMain = formatTeamMembersListHtml(t);
    var memExtra = '';
    var mc = t.memberCount;
    if (mc != null && mc !== '' && !isNaN(Number(mc))) {
      var mcNum = Number(mc);
      var nameLen = Array.isArray(t.memberNames) ? t.memberNames.length : 0;
      if (nameLen === 0 && mcNum > 0) {
        memExtra =
          '<br><span class="rpbdd-team-mgmt-card__hint">Saved member count: ' +
          escapeHtml(String(mcNum)) +
          '</span>';
      } else if (nameLen > 0 && nameLen !== mcNum) {
        memExtra =
          '<br><span class="rpbdd-team-mgmt-card__hint">Saved count: ' +
          escapeHtml(String(mcNum)) +
          '</span>';
      }
    }
    html +=
      '<li><span class="rpbdd-tasks-meta-k">Members</span><span class="rpbdd-tasks-meta-v rpbdd-team-mgmt-card__members-v">' +
      memMain +
      memExtra +
      '</span></li>';
    html += teamMgmtMetaLi('Status', escapeHtml(t.online ? 'Active' : 'Inactive'));
    html += '</ul>';
    if (!readOnly) {
      html +=
        '<div class="rpbdd-tasks-card-footer"><div class="rpbdd-tasks-card-footer-right">' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--edit" data-team-edit-id="' +
        encodeURIComponent(tid) +
        '">' +
        svgIconEdit +
        '<span>Edit</span></button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--remove" data-team-remove-id="' +
        encodeURIComponent(tid) +
        '">' +
        svgIconRemove +
        '<span>Remove</span></button>' +
        '</div></div>';
    }
    html += '</div>';
    html += '</article>';
    return html;
  }

  /**
   * Total Members / Active Users — same card shell as Total Teams (Lead ID when Section Chief row;
   * Section Chief, Email, Password, Section Team, Members, Status). Regular members omit Lead ID / Position.
   */
  function renderMemberCardHtml(m) {
    var mid = String(m.id);
    var expanded = state.expandedMemberId !== null && String(state.expandedMemberId) === mid;
    var isLeaderRow = mid.indexOf('leader-') === 0;
    var col = isLeaderRow ? '#3b82f6' : 'var(--rp-green)';
    var nameLine = memberDisplayLabel(m).trim();
    var nameDisp = nameLine ? escapeHtml(nameLine) : '—';
    var teamRaw = (m.team || '').trim();
    var teamDisp = teamRaw ? escapeHtml(teamRaw) : '—';
    var headSub = teamRaw ? teamDisp : '—';
    var statusLabel = m.online ? 'Active' : 'Inactive';
    var pwPlain = typeof m.passwordPlain === 'string' ? m.passwordPlain : '';
    if (!pwPlain && m.password && String(m.password) !== '••••••••') {
      pwPlain = String(m.password);
    }
    var hasPw = (m.hasPassword && pwPlain !== '') || pwPlain !== '';
    var pwInputId = 'rpbdd-member-pw-' + mid.replace(/[^a-zA-Z0-9_-]/g, '_');
    var teamRec = resolveTeamRecordForMember(m);
    var leadIdLine = isLeaderRow && teamRec ? teamLeadId(teamRec) : '';
    var leaderFieldLine = '—';
    if (teamRec && String(teamRec.teamLeader || '').trim()) {
      leaderFieldLine = escapeHtml(String(teamRec.teamLeader).trim());
    } else if (isLeaderRow) {
      leaderFieldLine = nameDisp;
    }
    var secExpanded =
      teamRec != null
        ? escapeHtml(formatTeamCardField(teamRec.sectionTeam))
        : teamRaw
          ? teamDisp
          : '—';
    var pillLabel = isLeaderRow
      ? state.teamView === 'active'
        ? 'Section Chief'
        : 'Section Chief'
      : 'Member';

    var html = '';
    var memberCardClass =
      'rpbdd-tasks-card rpbdd-team-mgmt-card' +
      (isLeaderRow ? ' rpbdd-team-mgmt-card--team' : ' rpbdd-team-mgmt-card--member') +
      ' rpbdd-team-card rpbdd-member-card' +
      (isLeaderRow ? ' rpbdd-member-card--active-leader' : '');
    html +=
      '<article class="' +
      memberCardClass +
      '" style="--rpbdd-team-accent:' +
      col +
      '">';
    html += '<div class="rpbdd-tasks-card-head">';
    html += '<div class="rpbdd-tasks-card-head-row">';
    html +=
      '<div class="rpbdd-tasks-card-head-main" data-expand-member-id="' +
      encodeURIComponent(mid) +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">';
    html += '<h3 class="rpbdd-tasks-card-title rpbdd-team-card-head-title">' + nameDisp + '</h3>';
    html += '<p class="rpbdd-tasks-card-created">' + headSub + '</p>';
    html += '</div>';
    html += '<div class="rpbdd-tasks-card-head-side">';
    html += memberCardHeadPhotoHtml(m);
    html += '<span class="rpbdd-pill rpbdd-team-mgmt-card__role-pill">' + escapeHtml(pillLabel) + '</span>';
    html += '</div>';
    html += '</div></div>';

    html += '<div class="rpbdd-tasks-card-body' + (expanded ? '' : ' is-collapsed') + '">';
    html += '<ul class="rpbdd-tasks-card-meta-list">';
    if (isLeaderRow) {
    html += teamMgmtMetaLi('Lead ID', escapeHtml(leadIdLine || '—'));
    }
    html += teamMgmtMetaLi('Section Chief', leaderFieldLine);
    html += teamMgmtMetaLi('Email', escapeHtml((m.email || '').trim() || '—'));
    html += '<li><span class="rpbdd-tasks-meta-k">Password</span><span class="rpbdd-tasks-meta-v rpbdd-tasks-meta-v--stack">';
    if (hasPw) {
      html += '<div class="rpbdd-input-wrap rpbdd-input-wrap--modal-pw rpbdd-input-wrap--card-pw">';
      html +=
        '<svg class="rpbdd-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      html +=
        '<input class="rpbdd-input rpbdd-input--simple rpbdd-input--pr" type="password" readonly id="' +
        pwInputId +
        '" value="' +
        escapeHtml(pwPlain) +
        '">';
      html +=
        '<button type="button" class="rpbdd-toggle-pw" data-toggle-password="' +
        pwInputId +
        '" aria-label="Show password" aria-pressed="false">';
      html +=
        '<span class="rpbdd-toggle-pw__icon rpbdd-toggle-pw__icon--masked" aria-hidden="true">' +
        svgPwToggleMasked +
        '</span>';
      html +=
        '<span class="rpbdd-toggle-pw__icon rpbdd-toggle-pw__icon--visible" aria-hidden="true" hidden>' +
        svgPwToggleVisible +
        '</span>';
      html += '</button></div>';
    } else {
      html += '<span class="rpbdd-team-mgmt-card__pw-muted">—</span>';
    }
    html += '</span></li>';
    html += teamMgmtMetaLi('Section Team', secExpanded);
    var memMain = formatTeamMembersListHtml(teamRec);
    var memExtra = '';
    if (teamRec) {
      var mc = teamRec.memberCount;
      if (mc != null && mc !== '' && !isNaN(Number(mc))) {
        var mcNum = Number(mc);
        var nameLen = Array.isArray(teamRec.memberNames) ? teamRec.memberNames.length : 0;
        if (nameLen === 0 && mcNum > 0) {
          memExtra =
            '<br><span class="rpbdd-team-mgmt-card__hint">Saved member count: ' +
            escapeHtml(String(mcNum)) +
            '</span>';
        } else if (nameLen > 0 && nameLen !== mcNum) {
          memExtra =
            '<br><span class="rpbdd-team-mgmt-card__hint">Saved count: ' +
            escapeHtml(String(mcNum)) +
            '</span>';
        }
      }
    }
    html +=
      '<li><span class="rpbdd-tasks-meta-k">Members</span><span class="rpbdd-tasks-meta-v rpbdd-team-mgmt-card__members-v">' +
      memMain +
      memExtra +
      '</span></li>';
    html += teamMgmtMetaLi('Status', escapeHtml(statusLabel));
    html += '</ul>';
    var showMemberActions = state.teamView === 'members' && !isLeaderRow;
    if (showMemberActions) {
      html +=
        '<div class="rpbdd-tasks-card-footer"><div class="rpbdd-tasks-card-footer-right">' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--edit" data-member-edit-id="' +
        encodeURIComponent(mid) +
        '">' +
        svgIconEdit +
        '<span>Edit</span></button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--remove" data-member-remove-id="' +
        encodeURIComponent(mid) +
        '">' +
        svgIconRemove +
        '<span>Remove</span></button>' +
        '</div></div>';
    }
    html += '</div>';
    html += '</article>';
    return html;
  }

  function bindMemberCardExpandHandlers(root) {
    if (!root) return;
    root.querySelectorAll('[data-expand-member-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        var raw = node.getAttribute('data-expand-member-id') || '';
        var id = decodeURIComponent(raw);
        state.expandedMemberId = state.expandedMemberId === id ? null : id;
        renderTeamPanel();
      });
      node.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        node.click();
      });
    });
  }

  function confirmRemoveMember(mid) {
    var m = state.teamMembers.find(function (x) {
      return String(x.id) === String(mid);
    });
    if (!m) return;
    var label = String(memberDisplayLabel(m) || m.email || 'This member').trim();
    openRpbddConfirm({
      variant: 'recycle',
      title: 'Move to Recycle Bin?',
      message:
        '“' +
        label +
        '” goes to the Members Recycle Bin. Restore or delete it there anytime.',
      confirmLabel: 'Move to bin',
      cancelLabel: 'Keep',
      danger: false,
    }).then(function (ok) {
      if (!ok) return;
      var base = getMembersApiBase();
      if (!base) {
        state.deletedMembers.push(m);
        state.teamMembers = state.teamMembers.filter(function (x) {
          return String(x.id) !== String(mid);
        });
        if (state.expandedMemberId === String(mid)) state.expandedMemberId = null;
        saveDeletedMembers();
        saveMembers();
        renderTeamPanel();
        renderMembersRecycle();
        return;
      }
      fetch(base + '/' + encodeURIComponent(mid) + '/to-recycle', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: '{}',
      })
        .then(function (r) {
          return r.json().catch(function () {
            return {};
          });
        })
        .then(function (j) {
          if (!j.ok) {
            rpbddAlertMessage(formatRpbddApiError(j, 'Could not move to Recycle Bin'));
            return;
          }
          state.teamMembers = state.teamMembers.filter(function (x) {
            return String(x.id) !== String(mid);
          });
          if (state.expandedMemberId === String(mid)) state.expandedMemberId = null;
          refreshMembersFromApi().then(function () {
            renderTeamPanel();
          });
          renderMembersRecycle();
        })
        .catch(function () {
          rpbddAlertMessage('Network error');
        });
    });
  }

  function bindMemberCardActionHandlers(root) {
    if (!root) return;
    root.querySelectorAll('[data-member-edit-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var raw = btn.getAttribute('data-member-edit-id') || '';
        var id = decodeURIComponent(raw);
        var m = state.teamMembers.find(function (x) {
          return String(x.id) === String(id);
        });
        if (!m) return;
        openMemberEditModal(m);
      });
    });
    root.querySelectorAll('[data-member-remove-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var raw = btn.getAttribute('data-member-remove-id') || '';
        confirmRemoveMember(decodeURIComponent(raw));
      });
    });
  }

  function confirmRemoveTeamToRecycle(tid) {
    var t = state.teams.find(function (x) {
      return String(x.id) === String(tid);
    });
    if (!t) return;
    var label = (t.teamLeader || t.email || 'This team').trim();
    openRpbddConfirm({
      variant: 'recycle',
      title: 'Move to Recycle Bin?',
      message:
        '“' +
        label +
        '” goes to the Teams Recycle Bin. Restore or delete it there anytime.',
      confirmLabel: 'Move to bin',
      cancelLabel: 'Keep',
      danger: false,
    }).then(function (ok) {
      if (!ok) return;
      var base = getTeamsApiBase();
      if (base) {
        fetch(base + '/' + encodeURIComponent(tid) + '/to-recycle', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: '{}',
        })
          .then(function (r) {
            return r.json().catch(function () {
              return {};
            });
          })
          .then(function (j) {
            if (!j.ok) {
              rpbddAlertMessage(formatRpbddApiError(j, 'Could not move to Recycle Bin'));
              return;
            }
            state.teams = state.teams.filter(function (x) {
              return String(x.id) !== String(tid);
            });
            if (state.expandedTeamId === String(tid)) state.expandedTeamId = null;
            refreshTeamsFromApi().then(function () {
              renderTeamPanel();
            });
            renderTeamsRecycle();
          })
          .catch(function () {
            rpbddAlertMessage('Network error');
          });
        return;
      }
      state.deletedTeams.push(t);
      state.teams = state.teams.filter(function (x) {
        return String(x.id) !== String(tid);
      });
      if (state.expandedTeamId === String(tid)) state.expandedTeamId = null;
      saveTeams();
      saveDeletedTeams();
      renderTeamPanel();
      renderTeamsRecycle();
    });
  }

  function bindTeamCardActionHandlers(root) {
    if (!root) return;
    root.querySelectorAll('[data-team-edit-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var raw = btn.getAttribute('data-team-edit-id') || '';
        var id = decodeURIComponent(raw);
        var team = state.teams.find(function (x) {
          return String(x.id) === id;
        });
        if (team) openTeamEditModal(team);
      });
    });
    root.querySelectorAll('[data-team-remove-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var raw = btn.getAttribute('data-team-remove-id') || '';
        confirmRemoveTeamToRecycle(decodeURIComponent(raw));
      });
    });
  }

  function bindTeamCardExpandHandlers(root) {
    if (!root) return;
    root.querySelectorAll('[data-expand-team-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        var raw = node.getAttribute('data-expand-team-id') || '';
        var tid = decodeURIComponent(raw);
        state.expandedTeamId = state.expandedTeamId === tid ? null : tid;
        renderTeamPanel();
      });
      node.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        node.click();
      });
    });
  }

  function renderTeamPanel() {
    applyRoleBasedUi();
    if (state.teamView !== 'teams') state.expandedTeamId = null;
    if (state.teamView !== 'members' && state.teamView !== 'active') state.expandedMemberId = null;

    var data;
    var activeUsersUnfiltered = null;
    var teamsUnfiltered = null;
    var membersUnfiltered = null;
    if (state.teamView === 'teams') {
      teamsUnfiltered = state.teams;
      var teamsQ = String(state.teamTeamsSearch || '').trim().toLowerCase();
      data = teamsUnfiltered.filter(function (t) {
        return matchesTeamsSearch(t, teamsQ);
      });
    } else if (state.teamView === 'members') {
      membersUnfiltered = state.teamMembers;
      var membersQ = String(state.teamMembersSearch || '').trim().toLowerCase();
      data = membersUnfiltered.filter(function (m) {
        return matchesMembersSearch(m, membersQ);
      });
    } else if (state.teamView === 'active') {
      activeUsersUnfiltered = buildActiveUsersData();
      var activeQ = String(state.teamActiveSearch || '').trim().toLowerCase();
      data = activeUsersUnfiltered.filter(function (m) {
        return matchesActiveUsersSearch(m, activeQ);
      });
    } else if (state.teamView === 'logs') {
      var logsQ = String(state.teamLogsSearch || '').trim().toLowerCase();
      data = state.userLogs.filter(function (r) {
        return matchesTeamLogsSearch(r, logsQ);
      });
    }
    else data = [];

    document.querySelectorAll('[data-team-view-btn]').forEach(function (b) {
      b.classList.toggle('is-selected', b.getAttribute('data-team-view-btn') === state.teamView);
    });

    /** Same header row as Total Teams everywhere in Team Management (table hidden when using cards). */
    var teamsTableHeadHtml =
      '<th>Lead ID</th><th>Email</th><th>Password</th><th>Section Chief</th><th>Section Team</th><th>Position</th><th>Members</th>';
    var logsTableHeadHtml =
      '<th>Full Name</th><th>Email</th><th>Team</th><th>Role</th><th>Login</th><th>Logout</th>' +
      '<th scope="col" class="rpbdd-log-date-th"><button type="button" class="rpbdd-log-date-head">Date</button></th>';
    var headRow = document.getElementById('rpbdd-team-table-head-row');
    if (headRow) {
      headRow.innerHTML = state.teamView === 'logs' ? logsTableHeadHtml : teamsTableHeadHtml;
    }

    var elCountTeams = document.getElementById('rpbdd-stat-teams');
    var elCountMembers = document.getElementById('rpbdd-stat-members');
    var elCountActive = document.getElementById('rpbdd-stat-active');
    var elCountLogs = document.getElementById('rpbdd-stat-logs');
    if (elCountTeams) elCountTeams.textContent = state.teams.length;
    if (elCountMembers) elCountMembers.textContent = state.teamMembers.length;
    if (elCountActive) {
      var activeCountBase =
        activeUsersUnfiltered != null ? activeUsersUnfiltered : buildActiveUsersData();
      elCountActive.textContent = activeCountBase.length;
    }
    if (elCountLogs) elCountLogs.textContent = String(state.userLogs.length);

    var head = document.getElementById('rpbdd-team-section-title');
    if (head) {
      if (state.teamView === 'teams') {
        var teamsTitleQ = String(state.teamTeamsSearch || '').trim();
        if (teamsUnfiltered == null) teamsUnfiltered = state.teams;
        if (teamsTitleQ)
          head.textContent =
            'Total Teams (' + data.length + ' of ' + teamsUnfiltered.length + ')';
        else head.textContent = 'Total Teams (' + teamsUnfiltered.length + ')';
      } else if (state.teamView === 'members') {
        var membersTitleQ = String(state.teamMembersSearch || '').trim();
        if (membersUnfiltered == null) membersUnfiltered = state.teamMembers;
        if (membersTitleQ)
          head.textContent =
            'Total Members (' + data.length + ' of ' + membersUnfiltered.length + ')';
        else head.textContent = 'Total Members (' + membersUnfiltered.length + ')';
      } else if (state.teamView === 'active') {
        var activeTitleQ = String(state.teamActiveSearch || '').trim();
        if (activeUsersUnfiltered == null) activeUsersUnfiltered = buildActiveUsersData();
        if (activeTitleQ)
          head.textContent =
            'Active Users (' + data.length + ' of ' + activeUsersUnfiltered.length + ')';
        else head.textContent = 'Active Users (' + activeUsersUnfiltered.length + ')';
      } else if (state.teamView === 'logs') {
        var activeLogsQ = String(state.teamLogsSearch || '').trim();
        if (activeLogsQ) head.textContent = 'Logs (' + data.length + ' of ' + state.userLogs.length + ')';
        else head.textContent = 'Logs (' + state.userLogs.length + ')';
      }
      else head.textContent = 'Logs';
    }

    syncTeamManagementToolbar();

    var tbody = document.getElementById('rpbdd-team-table-body');
    var tableWrap = document.getElementById('rpbdd-team-table-wrap');
    var teamTable = document.getElementById('rpbdd-team-table');
    if (teamTable) {
      teamTable.classList.toggle('rpbdd-table--logs', state.teamView === 'logs');
    }
    var cardsWrap = document.getElementById('rpbdd-team-cards-wrap');
    if (!tbody || !tableWrap || !cardsWrap) return;

    var page = state.currentPage;
    var slice = paginate(data, page);

    if (state.teamView === 'teams' && state.expandedTeamId != null) {
      var sid = String(state.expandedTeamId);
      var stillHere = slice.some(function (t) {
        return String(t.id) === sid;
      });
      if (!stillHere) state.expandedTeamId = null;
    }

    if (
      (state.teamView === 'members' || state.teamView === 'active') &&
      state.expandedMemberId != null
    ) {
      var smid = String(state.expandedMemberId);
      var memberStillHere = slice.some(function (m) {
        return String(m.id) === smid;
      });
      if (!memberStillHere) state.expandedMemberId = null;
    }

    if (state.teamView === 'teams') {
      var teamsCardsReadOnly = currentUserRole() === 'team_leader';
      tableWrap.hidden = true;
      cardsWrap.hidden = false;
      if (slice.length === 0) {
        cardsWrap.innerHTML = '<div class="rpbdd-placeholder rpbdd-team-cards-empty">No records</div>';
      } else {
        cardsWrap.innerHTML = slice
          .map(function (teamRow) {
            return renderTeamCardHtml(teamRow, { readOnly: teamsCardsReadOnly });
          })
          .join('');
        bindTeamCardExpandHandlers(cardsWrap);
        if (!teamsCardsReadOnly) {
          bindTeamCardActionHandlers(cardsWrap);
        }
        if (typeof window.rpbddSyncPasswordToggles === 'function' && !teamsCardsReadOnly) {
          window.rpbddSyncPasswordToggles(cardsWrap);
        }
      }
      tbody.innerHTML = '';
    } else if (state.teamView === 'members' || state.teamView === 'active') {
      tableWrap.hidden = true;
      cardsWrap.hidden = false;
      cardsWrap.innerHTML =
        slice.length === 0
          ? '<div class="rpbdd-placeholder rpbdd-team-cards-empty">No records</div>'
          : slice.map(renderMemberCardHtml).join('');
      bindMemberCardExpandHandlers(cardsWrap);
      bindMemberCardActionHandlers(cardsWrap);
      if (typeof window.rpbddSyncPasswordToggles === 'function') {
        window.rpbddSyncPasswordToggles(cardsWrap);
      }
      tbody.innerHTML = '';
    } else if (state.teamView === 'logs') {
      tableWrap.hidden = false;
      cardsWrap.hidden = true;
      cardsWrap.innerHTML = '';
      if (slice.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="rpbdd-placeholder" style="text-align:center;padding:1.5rem">No records</td></tr>';
      } else {
        tbody.innerHTML = slice
          .map(function (r) {
            var rawDate = getLogRowDateRaw(r);
            var dateShown = state.logsDateLong
              ? formatLogDateLongFromRaw(rawDate)
              : formatLogDateShortFromRaw(rawDate);
            return (
              '<tr>' +
              '<td>' +
              escapeHtml(formatUserLogCell(r.fullName)) +
              '</td>' +
              '<td>' +
              escapeHtml(formatUserLogCell(r.email)) +
              '</td>' +
              '<td>' +
              escapeHtml(formatUserLogCell(r.team)) +
              '</td>' +
              '<td>' +
              escapeHtml(formatUserLogRoleDisplay(r)) +
              '</td>' +
              '<td>' +
              escapeHtml(formatUserLogTime12h(r.login)) +
              '</td>' +
              '<td>' +
              escapeHtml(formatUserLogLogoutCell(r.logout)) +
              '</td>' +
              '<td class="rpbdd-log-date-cell" tabindex="0" role="button" title="Click to toggle date format (MM-DD-YY ⟷ Month D, YYYY)">' +
              escapeHtml(dateShown) +
              '</td>' +
              '</tr>'
            );
          })
          .join('');
      }
    } else {
      tableWrap.hidden = true;
      cardsWrap.hidden = false;
      cardsWrap.innerHTML = '<div class="rpbdd-placeholder rpbdd-team-cards-empty">No records</div>';
      tbody.innerHTML = '';
    }

    var totalPages = Math.max(1, Math.ceil(data.length / state.recordsPerPage));
    var pag = document.getElementById('rpbdd-team-pagination');
    if (pag) {
      pag.innerHTML = '';
      for (var p = 1; p <= totalPages; p++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = String(p);
        b.className = 'rpbdd-pill' + (p === state.currentPage ? ' is-active' : '');
        b.addEventListener(
          'click',
          (function (pn) {
            return function () {
              state.currentPage = pn;
              renderTeamPanel();
            };
          })(p),
        );
        pag.appendChild(b);
      }
    }

    var teamRecycleBtn = document.getElementById('rpbdd-open-teams-recycle');
    if (teamRecycleBtn) {
      var showTeamRecycle =
        state.teamView === 'teams' && currentUserRole() !== 'team_leader';
      teamRecycleBtn.hidden = !showTeamRecycle;
      teamRecycleBtn.setAttribute('aria-hidden', showTeamRecycle ? 'false' : 'true');
    }
    var memberRecycleBtn = document.getElementById('rpbdd-open-members-recycle');
    if (memberRecycleBtn) {
      var roleM = currentUserRole();
      var showMemberRecycle =
        state.teamView === 'members' && (roleM === 'admin' || roleM === 'team_leader');
      memberRecycleBtn.hidden = !showMemberRecycle;
      memberRecycleBtn.setAttribute('aria-hidden', showMemberRecycle ? 'false' : 'true');
    }
  }

  function updateFooterSummary() {
    refreshNotificationBadgeCount();
    renderNotificationWidgetPreview();
    var notif = state.notifPending;
    var badge = document.getElementById('rpbdd-notif-badge');
    if (badge) badge.textContent = String(notif);
  }

  function render() {
    renderCategoryLegend();
    renderCalendar();
    renderSidebarUpcoming();
    updateFooterSummary();
    if (state.activeNav === 'events') renderEventsPanel();
    if (state.activeNav === 'team') renderTeamPanel();
    if (state.activeNav === 'reports') renderReportsPanel();
  }

  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.setAttribute('aria-hidden', 'false');
    m.classList.add('is-open');
  }

  function closeModal(id) {
    if (id === 'modal-add-team') resetAddTeamForm();
    if (id === 'modal-add-member') resetMemberForm();
    if (id === 'modal-add-birthday') resetAddBirthdayForm();
    if (id === 'modal-account') setAccountModalDefaultLayout();
    if (id === 'modal-task-attachment-preview') {
      var prevBody = document.getElementById('rpbdd-task-attachment-preview-body');
      if (prevBody) prevBody.innerHTML = '';
    }
    if (id === 'modal-report-card-detail') {
      resetReportCardModalPersonLabels();
    }
    if (id === 'modal-report-category-display') {
      reportCategoryDisplayModalPhotoClear = false;
      reportCategoryDisplayModalPendingDataUrl = null;
    }
    var m = document.getElementById(id);
    if (!m) return;
    var ae = document.activeElement;
    if (ae && m.contains(ae) && typeof ae.blur === 'function') ae.blur();
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
  }

  function closeAllModals() {
    document.querySelectorAll('.rpbdd-modal-overlay').forEach(function (x) {
      if (x.id === 'modal-add-team') resetAddTeamForm();
      if (x.id === 'modal-add-member') resetMemberForm();
      if (x.id === 'modal-account') setAccountModalDefaultLayout();
      if (x.id === 'modal-task-attachment-preview') {
        var pb = document.getElementById('rpbdd-task-attachment-preview-body');
        if (pb) pb.innerHTML = '';
      }
      if (x.id === 'modal-report-card-detail' && x.classList.contains('rpbdd-report-card-modal--folder')) {
        resetReportCardModalPersonLabels();
      }
      if (x.id === 'modal-report-category-display') {
        reportCategoryDisplayModalPhotoClear = false;
        reportCategoryDisplayModalPendingDataUrl = null;
      }
      var ae = document.activeElement;
      if (ae && x.contains(ae) && typeof ae.blur === 'function') ae.blur();
      x.classList.remove('is-open');
      x.setAttribute('aria-hidden', 'true');
    });
  }

  var teamEditSuccessToastTimer = null;
  var teamEditSuccessToastHideTimer = null;

  /**
   * Shown after a successful team edit from the card/modal. No buttons — auto-hides after 3s.
   * Uses dedicated team-success styling (see rpbdd-team-success-toast-overlay in rpbdd.css).
   */
  function showTeamEditSuccessToast(message) {
    var ov = document.getElementById('rpbdd-team-success-toast');
    var msgEl = document.getElementById('rpbdd-team-success-toast-message');
    if (!ov || !msgEl) return;
    if (teamEditSuccessToastTimer) {
      clearTimeout(teamEditSuccessToastTimer);
      teamEditSuccessToastTimer = null;
    }
    if (teamEditSuccessToastHideTimer) {
      clearTimeout(teamEditSuccessToastHideTimer);
      teamEditSuccessToastHideTimer = null;
    }
    msgEl.textContent = message || 'Team information was updated successfully.';
    ov.setAttribute('aria-hidden', 'false');
    ov.classList.add('is-open');
    teamEditSuccessToastTimer = setTimeout(function () {
      ov.classList.remove('is-open');
      teamEditSuccessToastTimer = null;
      teamEditSuccessToastHideTimer = setTimeout(function () {
        ov.setAttribute('aria-hidden', 'true');
        teamEditSuccessToastHideTimer = null;
      }, 380);
    }, 3000);
  }

  var rpbddConfirmResolver = null;

  function finishRpbddConfirm(result) {
    var confirmOv = document.getElementById('modal-rpbdd-confirm');
    if (confirmOv) {
      var panelCl = confirmOv.querySelector('.rpbdd-confirm-panel');
      if (panelCl) {
        panelCl.classList.remove(
          'rpbdd-confirm-panel--tone-delete',
          'rpbdd-confirm-panel--tone-restore',
          'rpbdd-confirm-panel--tone-recycle',
          'rpbdd-confirm-panel--tone-neutral',
          'rpbdd-confirm-panel--tone-remove',
          'rpbdd-confirm-panel--tone-markread',
          'rpbdd-confirm-panel--from-notifications',
          'rpbdd-confirm-panel--from-notifications-read-recycle'
        );
      }
      confirmOv.setAttribute('aria-hidden', 'true');
    }
    closeModal('modal-rpbdd-confirm');
    var fn = rpbddConfirmResolver;
    rpbddConfirmResolver = null;
    if (fn) fn(!!result);
  }

  function openRpbddAlert(cfg) {
    var ov = document.getElementById('modal-rpbdd-alert');
    if (!ov) {
      try {
        console.error('[RPBDD] Alert modal missing:', (cfg && cfg.message) || '');
      } catch (e) {
        /* ignore */
      }
      return;
    }
    var titleEl = ov.querySelector('[data-alert-title]');
    var msgEl = ov.querySelector('[data-alert-message]');
    var okBtn = ov.querySelector('[data-alert-ok]');
    if (titleEl) titleEl.textContent = (cfg && cfg.title) || 'Notice';
    if (msgEl) msgEl.textContent = (cfg && cfg.message) || '';
    if (okBtn) okBtn.textContent = (cfg && cfg.okLabel) || 'OK';
    ov.setAttribute('aria-hidden', 'false');
    openModal('modal-rpbdd-alert');
  }

  /** Use instead of window.alert — always uses #modal-rpbdd-alert when present. */
  function rpbddAlertMessage(message, title) {
    openRpbddAlert({
      title: title || 'Notice',
      message: message != null ? String(message) : '',
      okLabel: 'OK',
    });
  }

  function confirmDialogIconHtml(variant) {
    if (variant === 'delete' || variant === 'remove') {
      return '<svg class="rpbdd-confirm-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    }
    if (variant === 'markread') {
      return '<svg class="rpbdd-confirm-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    }
    if (variant === 'restore') {
      return '<svg class="rpbdd-confirm-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
    }
    if (variant === 'neutral') {
      return '<svg class="rpbdd-confirm-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
    return '<svg class="rpbdd-confirm-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
  }

  /**
   * @param {{ variant?: string, title: string, message: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean, confirmUiSource?: 'notifications'|'notifications-read-recycle' }} cfg
   * @returns {Promise<boolean>}
   */
  function openRpbddConfirm(cfg) {
    return new Promise(function (resolve) {
      var ov = document.getElementById('modal-rpbdd-confirm');
      if (!ov) {
        resolve(false);
        return;
      }
      rpbddConfirmResolver = resolve;
      var v = cfg.variant || 'recycle';
      var titleEl = ov.querySelector('[data-confirm-title]');
      var msgEl = ov.querySelector('[data-confirm-message]');
      var iconSlot = ov.querySelector('[data-confirm-icon-slot]');
      var accent = ov.querySelector('[data-confirm-accent]');
      var okBtn = ov.querySelector('[data-confirm-ok]');
      var cancelBtn = ov.querySelector('[data-confirm-cancel]');
      var panel = ov.querySelector('.rpbdd-confirm-panel');
      if (panel) {
        panel.classList.remove(
          'rpbdd-confirm-panel--tone-delete',
          'rpbdd-confirm-panel--tone-restore',
          'rpbdd-confirm-panel--tone-recycle',
          'rpbdd-confirm-panel--tone-neutral',
          'rpbdd-confirm-panel--tone-remove',
          'rpbdd-confirm-panel--tone-markread',
          'rpbdd-confirm-panel--from-notifications',
          'rpbdd-confirm-panel--from-notifications-read-recycle'
        );
        var tone;
        if (cfg.danger || v === 'delete') {
          tone = 'delete';
        } else if (v === 'restore') {
          tone = 'restore';
        } else if (v === 'recycle') {
          tone = 'recycle';
        } else if (v === 'remove') {
          tone = 'remove';
        } else if (v === 'markread') {
          tone = 'markread';
        } else {
          tone = 'neutral';
        }
        panel.classList.add('rpbdd-confirm-panel--tone-' + tone);
        var notifUi =
          cfg.confirmUiSource === 'notifications' ||
          cfg.confirmUiSource === 'notifications-read-recycle';
        if (notifUi) {
          panel.classList.add('rpbdd-confirm-panel--from-notifications');
        }
        if (cfg.confirmUiSource === 'notifications-read-recycle') {
          panel.classList.add('rpbdd-confirm-panel--from-notifications-read-recycle');
        }
      }
      if (titleEl) titleEl.textContent = cfg.title || 'Confirm';
      if (msgEl) msgEl.textContent = cfg.message || '';
      var slotVariant;
      if (v === 'remove') {
        slotVariant = 'remove';
      } else if (v === 'markread') {
        slotVariant = 'markread';
      } else if (['delete', 'restore', 'recycle', 'neutral'].indexOf(v) >= 0) {
        slotVariant = v;
      } else {
        slotVariant = 'recycle';
      }
      if (iconSlot) {
        iconSlot.className = 'rpbdd-confirm-icon-slot rpbdd-confirm-icon-slot--' + slotVariant;
        iconSlot.innerHTML = confirmDialogIconHtml(slotVariant);
      }
      if (accent) {
        accent.className = 'rpbdd-confirm-panel__accent rpbdd-confirm-panel__accent--' + slotVariant;
      }
      if (okBtn) {
        okBtn.textContent = cfg.confirmLabel || 'Continue';
        okBtn.className = 'rpbdd-confirm-panel__btn rpbdd-confirm-panel__btn--primary';
        /* Match footer / card actions: restore = green, delete = red (even for informational OK-only). */
        if (v === 'restore') okBtn.classList.add('rpbdd-confirm-ok--safe');
        else if (v === 'delete' || cfg.danger) okBtn.classList.add('rpbdd-confirm-ok--danger');
        else if (v === 'recycle') okBtn.classList.add('rpbdd-confirm-ok--recycle-move');
        else if (v === 'remove') okBtn.classList.add('rpbdd-confirm-ok--remove-move');
        else if (v === 'markread') okBtn.classList.add('rpbdd-confirm-ok--markread');
        else okBtn.classList.add('rpbdd-confirm-ok--neutral');
      }
      if (cancelBtn) cancelBtn.textContent = cfg.cancelLabel || 'Cancel';
      ov.setAttribute('aria-hidden', 'false');
      // Defer open so the click that triggered this (e.g. Delete All inside Recycle Bin) fully completes first
      window.setTimeout(function () {
        openModal('modal-rpbdd-confirm');
      }, 0);
    });
  }

  function applySidebarCollapsedFromState() {
    var sb = document.getElementById('rpbdd-sidebar');
    var app = document.getElementById('rpbdd-app');
    var tg = document.getElementById('rpbdd-sidebar-toggle');
    if (sb) sb.classList.toggle('is-collapsed', state.sidebarCollapsed);
    if (app) app.classList.toggle('is-sidebar-collapsed', state.sidebarCollapsed);
    if (tg) {
      tg.setAttribute('aria-expanded', state.sidebarCollapsed ? 'false' : 'true');
      tg.title = state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse to icons only';
    }
    document.querySelectorAll('.rpbdd-nav [data-nav]').forEach(function (btn) {
      var sp = btn.querySelector('span');
      var label = sp ? sp.textContent.trim() : '';
      if (state.sidebarCollapsed && label) {
        btn.setAttribute('title', label);
      } else {
        btn.removeAttribute('title');
      }
    });
    try {
      localStorage.setItem(LS_SIDEBAR_COLLAPSED, state.sidebarCollapsed ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
  }

  function tasksSnapshotTaskListsForPoll(lists) {
    try {
      return JSON.stringify(lists == null ? [] : lists);
    } catch (e) {
      return '';
    }
  }

  function fetchTaskListsFromApi() {
    var base = getTasksApiBase();
    if (!base) {
      state.taskLists = [];
      return Promise.resolve(false);
    }
    return fetch(base, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) {
        return res.text().then(function (text) {
          var j = null;
          try {
            j = text ? JSON.parse(text) : null;
          } catch (e) {
            j = null;
          }
          return { res: res, j: j };
        });
      })
      .then(function (o) {
        if (!o.res.ok || !o.j || !o.j.ok || !Array.isArray(o.j.lists)) {
          state.taskLists = [];
          return false;
        }
        state.taskLists = o.j.lists;
        return true;
      })
      .catch(function () {
        state.taskLists = [];
        return false;
      });
  }

  /**
   * Background sync so User A’s edits appear for User B without refresh (poll + Supabase Realtime).
   * Refreshes every module that has an API in #rpbdd-app-config while the tab is visible.
   */
  function syncSharedModulesFromApi() {
    if (document.visibilityState !== 'visible') return Promise.resolve();
    var jobs = [];
    if (getEventsApiBase()) {
      jobs.push(refreshEventsFromApi().catch(function () {}));
      jobs.push(refreshEventCategoriesFromApi().catch(function () {}));
      jobs.push(refreshSharedDashboardSettingsFromApi().catch(function () {}));
    }
    if (getTeamsApiBase()) jobs.push(refreshTeamsFromApi().catch(function () {}));
    if (getMembersApiBase()) jobs.push(refreshMembersFromApi().catch(function () {}));
    if (birthdaysApiBase) jobs.push(refreshBirthdaysFromApi().catch(function () {}));
    if (getTasksApiBase()) jobs.push(fetchTaskListsFromApi().catch(function () {}));
    if (!jobs.length) return Promise.resolve();
    return Promise.all(jobs).then(function () {
      render();
      if (state.activeNav === 'tasks') renderTasksPanel();
    });
  }

  var sharedModulesSyncDebounceTimer = null;
  function scheduleDebouncedSharedModulesSync() {
    if (sharedModulesSyncDebounceTimer) window.clearTimeout(sharedModulesSyncDebounceTimer);
    sharedModulesSyncDebounceTimer = window.setTimeout(function () {
      sharedModulesSyncDebounceTimer = null;
      syncSharedModulesFromApi();
    }, 40);
  }

  function applySharedThemeFromRealtimeEvent(ev) {
    var detail = ev && ev.detail ? ev.detail : null;
    var appliedAny = false;
    var rawTheme = detail && detail.theme != null ? String(detail.theme).trim() : '';
    if (rawTheme) {
      var nextTheme = normalizeDashboardTheme(rawTheme);
      var curTheme = normalizeDashboardTheme(document.documentElement.getAttribute('data-rpbdd-theme'));
      if (sharedThemeWriteGuard && nextTheme !== sharedThemeWriteGuard.expected) {
        if (sharedThemeWriteGuardTimer) window.clearTimeout(sharedThemeWriteGuardTimer);
        sharedThemeWriteGuardTimer = null;
        sharedThemeWriteGuard = null;
      }
      if (nextTheme !== curTheme) {
        applyTheme(nextTheme);
      }
      noteSharedThemeConfirmedByServer(rawTheme);
      appliedAny = true;
    }
    if (detail && typeof detail.sidebar_collapsed === 'boolean') {
      state.sidebarCollapsed = !!detail.sidebar_collapsed;
      applySidebarCollapsedFromState();
      appliedAny = true;
    }
    if (detail && detail.density != null && String(detail.density).trim() !== '') {
      applyDensityMode(detail.density);
      appliedAny = true;
    }
    if (!appliedAny) {
      refreshSharedDashboardSettingsFromApi().catch(function () {});
    }
  }

  function tasksNormalizeTeamLabel(s) {
    return String(s || '')
      .trim()
      .toLowerCase();
  }

  function teamLeaderSectionFromState() {
    var my =
      state.currentUser && state.currentUser.email ? String(state.currentUser.email).trim().toLowerCase() : '';
    if (!my) return '';
    var sec = '';
    (state.teams || []).forEach(function (t) {
      if (!t) return;
      var em = String(t.email || '')
        .trim()
        .toLowerCase();
      if (em === my) sec = String(t.sectionTeam || '').trim();
    });
    return sec;
  }

  function memberTeamFromState() {
    var my =
      state.currentUser && state.currentUser.email ? String(state.currentUser.email).trim().toLowerCase() : '';
    if (!my) return '';
    var tm = '';
    (state.teamMembers || []).forEach(function (m) {
      if (!m) return;
      var em = String(m.email || '')
        .trim()
        .toLowerCase();
      if (em === my) {
        tm = firstNonEmptyString(m.team, m.Team, m.sectionTeam, m.section_team, m.Section_Team);
        tm = String(tm || '').trim();
      }
    });
    return tm;
  }

  /** First "Send to" role matching the portal (admin: team leaders; TL: members; member: team leader). */
  function tasksDefaultRecipientRoleForPortal(portalRole) {
    if (portalRole === 'admin') return 'team_leader';
    if (portalRole === 'team_leader') return 'member';
    if (portalRole === 'member' || portalRole === 'user') return 'team_leader';
    return 'team_leader';
  }

  /**
   * @param {string} selectTargetRole — team_leader | member (who receives)
   * @param {string} [portalRole] — current portal; default from currentUserRole()
   */
  function tasksBuildRecipientOptions(selectTargetRole, portalRole) {
    portalRole = portalRole || currentUserRole();
    var rows = [];
    if (portalRole === 'admin') {
      var opts = '<option value="">Everyone in this role</option>';
      if (selectTargetRole === 'team_leader') {
        (state.teams || []).forEach(function (t) {
          if (!t) return;
          var em = String(t.email || '')
            .trim()
            .toLowerCase();
          if (!em) return;
          var team = String(t.sectionTeam || '').trim();
          if (!team) team = '—';
          var name = String(t.teamLeader || '').trim() || em;
          rows.push({
            email: em,
            team: team,
            name: name,
            sortTeam: team.toLowerCase(),
            sortName: name.toLowerCase(),
          });
        });
      } else {
        (state.teamMembers || []).forEach(function (m) {
          if (!m) return;
          var em = String(m.email || '')
            .trim()
            .toLowerCase();
          if (!em) return;
          var team = String(m.team || '').trim();
          if (!team) team = '—';
          var name = String(m.name || '').trim() || em;
          rows.push({
            email: em,
            team: team,
            name: name,
            sortTeam: team.toLowerCase(),
            sortName: name.toLowerCase(),
          });
        });
      }
      var seen = {};
      rows = rows.filter(function (r) {
        if (seen[r.email]) return false;
        seen[r.email] = true;
        return true;
      });
      rows.sort(function (a, b) {
        if (a.sortTeam !== b.sortTeam) return a.sortTeam < b.sortTeam ? -1 : 1;
        if (a.sortName !== b.sortName) return a.sortName < b.sortName ? -1 : 1;
        if (a.email !== b.email) return a.email < b.email ? -1 : 1;
        return 0;
      });
      rows.forEach(function (r) {
        var line = 'Team: ' + r.team + ' — ' + r.name + ' — ' + r.email;
        opts += '<option value="' + escapeHtml(r.email) + '">' + escapeHtml(line) + '</option>';
      });
      return opts;
    }
    if (portalRole === 'team_leader' && selectTargetRole === 'member') {
      var optsTl = '<option value="">Select a member</option>';
      var sec = teamLeaderSectionFromState();
      var nSec = tasksNormalizeTeamLabel(sec);
      (state.teamMembers || []).forEach(function (m) {
        if (!m) return;
        var em = String(m.email || '')
          .trim()
          .toLowerCase();
        if (!em) return;
        if (nSec && tasksNormalizeTeamLabel(m.team || '') !== nSec) return;
        var team = String(m.team || '').trim();
        if (!team) team = '—';
        var name = String(m.name || '').trim() || em;
        rows.push({
          email: em,
          team: team,
          name: name,
          sortTeam: team.toLowerCase(),
          sortName: name.toLowerCase(),
        });
      });
      var seenT = {};
      rows = rows.filter(function (r) {
        if (seenT[r.email]) return false;
        seenT[r.email] = true;
        return true;
      });
      rows.sort(function (a, b) {
        if (a.sortName !== b.sortName) return a.sortName < b.sortName ? -1 : 1;
        return a.email < b.email ? -1 : 1;
      });
      rows.forEach(function (r) {
        var line = 'Team: ' + r.team + ' — ' + r.name + ' — ' + r.email;
        optsTl += '<option value="' + escapeHtml(r.email) + '">' + escapeHtml(line) + '</option>';
      });
      return optsTl;
    }
    if ((portalRole === 'member' || portalRole === 'user') && selectTargetRole === 'team_leader') {
      var optsM = '<option value="">Select section chief</option>';
      var mTeam = memberTeamFromState();
      var nt = tasksNormalizeTeamLabel(mTeam);
      (state.teams || []).forEach(function (t) {
        if (!t) return;
        if (nt && tasksNormalizeTeamLabel(t.sectionTeam || '') !== nt) return;
        var em = String(t.email || '')
          .trim()
          .toLowerCase();
        if (!em) return;
        var team = String(t.sectionTeam || '').trim();
        if (!team) team = '—';
        var name = String(t.teamLeader || '').trim() || em;
        rows.push({
          email: em,
          team: team,
          name: name,
          sortTeam: team.toLowerCase(),
          sortName: name.toLowerCase(),
        });
      });
      /* Fallback: options API omitted email until fixed server-side, or Team vs Section_Team label mismatch */
      if (rows.length === 0) {
        var withEmail = (state.teams || []).filter(function (t) {
          return t && String(t.email || '').trim();
        });
        if (withEmail.length === 1) {
          var t1 = withEmail[0];
          var em1 = String(t1.email || '')
            .trim()
            .toLowerCase();
          var team1 = String(t1.sectionTeam || '').trim();
          if (!team1) team1 = '—';
          var name1 = String(t1.teamLeader || '').trim() || em1;
          rows.push({
            email: em1,
            team: team1,
            name: name1,
            sortTeam: team1.toLowerCase(),
            sortName: name1.toLowerCase(),
          });
        }
      }
      var seenM = {};
      rows = rows.filter(function (r) {
        if (seenM[r.email]) return false;
        seenM[r.email] = true;
        return true;
      });
      rows.sort(function (a, b) {
        if (a.sortName !== b.sortName) return a.sortName < b.sortName ? -1 : 1;
        return a.email < b.email ? -1 : 1;
      });
      rows.forEach(function (r) {
        var line = 'Team: ' + r.team + ' — ' + r.name + ' — ' + r.email;
        optsM += '<option value="' + escapeHtml(r.email) + '">' + escapeHtml(line) + '</option>';
      });
      return optsM;
    }
    return '<option value="">—</option>';
  }

  function tasksSendToRadiosHtml(portalRole) {
    if (portalRole === 'admin') {
      return (
        '<div class="rpbdd-tasks-seg rpbdd-tasks-seg--three" role="radiogroup" aria-label="Recipient role">' +
        '<label><input type="radio" name="rpbdd-tasks-role" value="team_leader" checked /><span>Section Chief</span></label>' +
        '<label><input type="radio" name="rpbdd-tasks-role" value="member" /><span>Members</span></label>' +
        '<label><input type="radio" name="rpbdd-tasks-role" value="admin" /><span>Myself</span></label>' +
        '</div>'
      );
    }
    if (portalRole === 'team_leader') {
      return (
        '<div class="rpbdd-tasks-seg rpbdd-tasks-seg--two" role="radiogroup" aria-label="Recipient role">' +
        '<label><input type="radio" name="rpbdd-tasks-role" value="member" checked /><span>Members</span></label>' +
        '<label><input type="radio" name="rpbdd-tasks-role" value="team_leader" /><span>Myself</span></label>' +
        '</div>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Assign to a member on your team, or <strong>Myself</strong> for your own checklist.</p>'
      );
    }
    if (portalRole === 'member' || portalRole === 'user') {
      return (
        '<div class="rpbdd-tasks-seg rpbdd-tasks-seg--two" role="radiogroup" aria-label="Recipient role">' +
        '<label><input type="radio" name="rpbdd-tasks-role" value="team_leader" checked /><span>Section Chief</span></label>' +
        '<label><input type="radio" name="rpbdd-tasks-role" value="member" /><span>Myself</span></label>' +
        '</div>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Send to your section chief, or <strong>Myself</strong> for a personal checklist.</p>'
      );
    }
    return '';
  }

  function tasksSendToEditRadiosHtml(portalRole) {
    if (portalRole === 'admin') {
      return (
        '<div class="rpbdd-tasks-seg rpbdd-tasks-seg--three" role="radiogroup" aria-label="Recipient role">' +
        '<label><input type="radio" name="rpbdd-tasks-edit-role" value="team_leader" checked /><span>Section Chief</span></label>' +
        '<label><input type="radio" name="rpbdd-tasks-edit-role" value="member" /><span>Members</span></label>' +
        '<label><input type="radio" name="rpbdd-tasks-edit-role" value="admin" /><span>Myself</span></label>' +
        '</div>'
      );
    }
    if (portalRole === 'team_leader') {
      return (
        '<div class="rpbdd-tasks-seg rpbdd-tasks-seg--two" role="radiogroup" aria-label="Recipient role">' +
        '<label><input type="radio" name="rpbdd-tasks-edit-role" value="member" checked /><span>Members</span></label>' +
        '<label><input type="radio" name="rpbdd-tasks-edit-role" value="team_leader" /><span>Myself</span></label>' +
        '</div>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Assign to a member on your team, or <strong>Myself</strong> for your own checklist.</p>'
      );
    }
    if (portalRole === 'member' || portalRole === 'user') {
      return (
        '<div class="rpbdd-tasks-seg rpbdd-tasks-seg--two" role="radiogroup" aria-label="Recipient role">' +
        '<label><input type="radio" name="rpbdd-tasks-edit-role" value="team_leader" checked /><span>Section Chief</span></label>' +
        '<label><input type="radio" name="rpbdd-tasks-edit-role" value="member" /><span>Myself</span></label>' +
        '</div>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Send to your section chief, or <strong>Myself</strong> for a personal checklist.</p>'
      );
    }
    return '';
  }

  function tasksRefreshRecipientSelect() {
    var sel = document.getElementById('rpbdd-tasks-recipient');
    var block = document.getElementById('rpbdd-tasks-recipient-block');
    if (!sel) return;
    var portalRole = currentUserRole();
    var roleEl = document.querySelector('#rpbdd-tasks-shell input[name="rpbdd-tasks-role"]:checked');
    var selectRole = roleEl ? String(roleEl.value || tasksDefaultRecipientRoleForPortal(portalRole)) : 'team_leader';
    if (portalRole === 'admin') {
      if (selectRole === 'admin') {
        if (block) block.hidden = true;
        return;
      }
      if (block) block.hidden = false;
      var prev = sel.value;
      sel.innerHTML = tasksBuildRecipientOptions(selectRole, 'admin');
      if (prev && Array.prototype.some.call(sel.options, function (o) { return o.value === prev; })) {
        sel.value = prev;
      }
      return;
    }
    if (portalRole === 'team_leader') {
      if (selectRole === 'team_leader') {
        if (block) block.hidden = true;
        return;
      }
      if (block) block.hidden = false;
      var prevTl = sel.value;
      sel.innerHTML = tasksBuildRecipientOptions('member', 'team_leader');
      if (prevTl && Array.prototype.some.call(sel.options, function (o) { return o.value === prevTl; })) {
        sel.value = prevTl;
      }
      return;
    }
    if (portalRole === 'member' || portalRole === 'user') {
      if (selectRole === 'member') {
        if (block) block.hidden = true;
        return;
      }
      if (block) block.hidden = false;
      var prevM = sel.value;
      sel.innerHTML = tasksBuildRecipientOptions('team_leader', 'member');
      if (prevM && Array.prototype.some.call(sel.options, function (o) { return o.value === prevM; })) {
        sel.value = prevM;
      }
    }
  }

  function tasksSyncEditDeadlineWrap() {
    var noEl = document.getElementById('rpbdd-tasks-edit-no-deadline');
    var wrap = document.getElementById('rpbdd-tasks-edit-deadline-wrap');
    var dIn = document.getElementById('rpbdd-tasks-edit-deadline-date');
    var tIn = document.getElementById('rpbdd-tasks-edit-deadline-time');
    var dis = !!(noEl && noEl.checked);
    if (wrap) wrap.hidden = dis;
    if (dIn) dIn.disabled = dis;
    if (tIn) tIn.disabled = dis;
  }

  function tasksRefreshEditRecipientSelect() {
    var sel = document.getElementById('rpbdd-tasks-edit-recipient');
    var block = document.getElementById('rpbdd-tasks-edit-recipient-block');
    if (!sel) return;
    var portalRole = currentUserRole();
    var roleEl = document.querySelector('#rpbdd-tasks-shell input[name="rpbdd-tasks-edit-role"]:checked');
    var selectRole = roleEl ? String(roleEl.value || tasksDefaultRecipientRoleForPortal(portalRole)) : 'team_leader';
    if (portalRole === 'admin') {
      if (selectRole === 'admin') {
        if (block) block.hidden = true;
        return;
      }
      if (block) block.hidden = false;
      var prev = sel.value;
      sel.innerHTML = tasksBuildRecipientOptions(selectRole, 'admin');
      if (prev && Array.prototype.some.call(sel.options, function (o) { return o.value === prev; })) {
        sel.value = prev;
      }
      return;
    }
    if (portalRole === 'team_leader') {
      if (selectRole === 'team_leader') {
        if (block) block.hidden = true;
        return;
      }
      if (block) block.hidden = false;
      var prevTl = sel.value;
      sel.innerHTML = tasksBuildRecipientOptions('member', 'team_leader');
      if (prevTl && Array.prototype.some.call(sel.options, function (o) { return o.value === prevTl; })) {
        sel.value = prevTl;
      }
      return;
    }
    if (portalRole === 'member' || portalRole === 'user') {
      if (selectRole === 'member') {
        if (block) block.hidden = true;
        return;
      }
      if (block) block.hidden = false;
      var prevM = sel.value;
      sel.innerHTML = tasksBuildRecipientOptions('team_leader', 'member');
      if (prevM && Array.prototype.some.call(sel.options, function (o) { return o.value === prevM; })) {
        sel.value = prevM;
      }
    }
  }

  function tasksFindListById(id) {
    var want = parseInt(String(id), 10) || 0;
    var found = null;
    (state.taskLists || []).forEach(function (L) {
      if (!L) return;
      if (parseInt(String(L.id), 10) === want) found = L;
    });
    return found;
  }

  function tasksOpenEditTaskModal(L) {
    if (!L) return;
    var lid = parseInt(String(L.id), 10) || 0;
    if (!lid) return;
    var hid = document.getElementById('rpbdd-tasks-edit-list-id');
    if (hid) hid.value = String(lid);
    var titleEl = document.getElementById('rpbdd-tasks-edit-title');
    if (titleEl) titleEl.value = String(L.title || '');
    var wrap = document.getElementById('rpbdd-tasks-edit-lines');
    if (wrap) {
      wrap.innerHTML = '';
      var items = Array.isArray(L.items) ? L.items : [];
      var rows = items.filter(function (it) {
        return it && String((it && it.label) || '').trim() !== '';
      });
      if (rows.length === 0) {
        tasksAppendDraftLineRow(wrap, '', true);
      } else {
        rows.forEach(function (it) {
          var lab = String((it && it.label) || '').trim();
          var allow = !(it && (it.allowAttachment === false || it.allowAttachment === 0));
          tasksAppendDraftLineRow(wrap, lab, allow);
        });
      }
    }
    var shell = document.getElementById('rpbdd-tasks-shell');
    var tr = String(L.targetRole || 'team_leader');
    if (shell) {
      shell.querySelectorAll('input[name="rpbdd-tasks-edit-role"]').forEach(function (r) {
        r.checked = String(r.value) === tr;
      });
    }
    tasksRefreshEditRecipientSelect();
    var recEl = document.getElementById('rpbdd-tasks-edit-recipient');
    var tem = L.targetEmail ? String(L.targetEmail).trim().toLowerCase() : '';
    if (recEl && tem && Array.prototype.some.call(recEl.options, function (o) { return o.value === tem; })) {
      recEl.value = tem;
    } else if (recEl) {
      recEl.value = '';
    }
    var noEl = document.getElementById('rpbdd-tasks-edit-no-deadline');
    var dEl = document.getElementById('rpbdd-tasks-edit-deadline-date');
    var tEl = document.getElementById('rpbdd-tasks-edit-deadline-time');
    var dl = L.deadlineAt || '';
    var parts = tasksDeadlineAtSplitForInputs(dl);
    if (noEl) noEl.checked = !dl;
    if (dEl) dEl.value = dl ? parts.date : '';
    if (tEl) tEl.value = dl ? (parts.time || '23:59') : '23:59';
    tasksSyncEditDeadlineWrap();
    var noteEd = document.getElementById('rpbdd-tasks-edit-creator-notes');
    if (noteEd) noteEd.value = L.creatorNotes != null ? String(L.creatorNotes) : '';
    openModal('modal-edit-task');
  }

  function tasksSubmitEditTask() {
    var base = getTasksApiBase();
    var modal = document.getElementById('modal-edit-task');
    var hid = document.getElementById('rpbdd-tasks-edit-list-id');
    if (!base || !modal || !hid) return;
    var listId = parseInt(String(hid.value || ''), 10) || 0;
    if (!listId) return;
    var titleEl = document.getElementById('rpbdd-tasks-edit-title');
    var title = titleEl ? String(titleEl.value || '').trim() : '';
    var roleEl = modal.querySelector('input[name="rpbdd-tasks-edit-role"]:checked');
    var targetRole = roleEl ? String(roleEl.value || '') : '';
    var recEl = document.getElementById('rpbdd-tasks-edit-recipient');
    var portalRole = currentUserRole();
    var me = state.currentUser && state.currentUser.email ? String(state.currentUser.email).trim().toLowerCase() : '';
    var targetEmail = '';
    if (targetRole === 'admin') {
      if (!me) {
        rpbddAlertMessage('Could not read your account email. Refresh the page and try again.');
        return;
      }
      targetEmail = me;
    } else if (portalRole === 'team_leader' && targetRole === 'team_leader') {
      if (!me) {
        rpbddAlertMessage('Could not read your account email. Refresh the page and try again.');
        return;
      }
      targetEmail = me;
    } else if ((portalRole === 'member' || portalRole === 'user') && targetRole === 'member') {
      if (!me) {
        rpbddAlertMessage('Could not read your account email. Refresh the page and try again.');
        return;
      }
      targetEmail = me;
    } else {
      targetEmail = recEl && recEl.value ? String(recEl.value).trim().toLowerCase() : '';
    }
    var linesWrap = modal.querySelector('#rpbdd-tasks-edit-lines');
    var lines = tasksCollectItemPayloadLines(linesWrap);
    if (!title) {
      rpbddAlertMessage('Please enter a title for this task.');
      return;
    }
    if (targetRole !== 'team_leader' && targetRole !== 'member' && targetRole !== 'admin') {
      rpbddAlertMessage('Choose who this list is for (Section Chiefs, Members, or Myself).');
      return;
    }
    if (
      portalRole === 'team_leader' &&
      targetRole === 'member' &&
      (!targetEmail || targetEmail === '')
    ) {
      rpbddAlertMessage('Select a member from Team & person.');
      return;
    }
    if (
      (portalRole === 'member' || portalRole === 'user') &&
      targetRole === 'team_leader' &&
      (!targetEmail || targetEmail === '')
    ) {
      rpbddAlertMessage('Select your section chief from Team & person.');
      return;
    }
    if (lines.length === 0) {
      rpbddAlertMessage('Add at least one checklist line.');
      return;
    }
    var noDdEl = document.getElementById('rpbdd-tasks-edit-no-deadline');
    var dEl = document.getElementById('rpbdd-tasks-edit-deadline-date');
    var tEl = document.getElementById('rpbdd-tasks-edit-deadline-time');
    var deadlineAt = null;
    if (!noDdEl || !noDdEl.checked) {
      var d = dEl ? String(dEl.value || '').trim() : '';
      if (!d) {
        rpbddAlertMessage('Pick a due date or check No deadline.');
        return;
      }
      var ti = tEl ? String(tEl.value || '').trim() : '';
      deadlineAt = tasksDeadlineDateTimeToApiIso(d, ti);
    }
    fetch(base + '/update-task', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listId: listId,
        title: title,
        targetRole: targetRole,
        targetEmail: targetEmail || null,
        deadlineAt: deadlineAt,
        items: lines,
        creatorNotes: (function () {
          var ne = document.getElementById('rpbdd-tasks-edit-creator-notes');
          return ne ? String(ne.value || '') : '';
        })(),
      }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (e) {
            j = null;
          }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok || !o.j || !o.j.ok) {
          rpbddAlertMessage((o.j && o.j.error) || 'Could not save changes.');
          return;
        }
        closeModal('modal-edit-task');
        return fetchTaskListsFromApi().then(function () {
          renderTasksPanel();
        });
      })
      .catch(function () {
        rpbddAlertMessage('Network error while saving.');
      });
  }

  function tasksOpenCreatorNotesModal(L) {
    if (!L) return;
    var lid = parseInt(String(L.id), 10) || 0;
    if (!lid) return;
    var hid = document.getElementById('rpbdd-tasks-notes-modal-list-id');
    var ta = document.getElementById('rpbdd-tasks-notes-modal-text');
    if (hid) hid.value = String(lid);
    if (ta) ta.value = L.creatorNotes != null ? String(L.creatorNotes) : '';
    openModal('modal-task-creator-notes');
  }

  function tasksSubmitCreatorNotesModal() {
    var base = getTasksApiBase();
    var hid = document.getElementById('rpbdd-tasks-notes-modal-list-id');
    var ta = document.getElementById('rpbdd-tasks-notes-modal-text');
    if (!base || !hid || !ta) return;
    var listId = parseInt(String(hid.value || ''), 10) || 0;
    if (!listId) return;
    fetch(base + '/update-creator-notes', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: listId, creatorNotes: ta.value }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (eN) {
            j = null;
          }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok || !o.j || !o.j.ok) {
          rpbddAlertMessage((o.j && o.j.error) || 'Could not save notes.');
          return;
        }
        closeModal('modal-task-creator-notes');
        return fetchTaskListsFromApi().then(function () {
          renderTasksPanel();
        });
      })
      .catch(function () {
        rpbddAlertMessage('Network error while saving notes.');
      });
  }

  /**
   * DB sends `Y-m-d H:i:s` as Philippines wall clock (server writes Asia/Manila).
   * Convert to UTC ms so display is correct even if the browser is not in PH.
   */
  function tasksMysqlManilaWallToUtcMs(s) {
    var str = String(s).trim();
    var m = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?/);
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    var h = parseInt(m[4], 10);
    var mi = parseInt(m[5], 10);
    var sec = m[6] != null && m[6] !== '' ? parseInt(m[6], 10) : 0;
    if ([y, mo, d, h, mi, sec].some(function (x) { return Number.isNaN(x); })) return null;
    var PH = 8;
    return Date.UTC(y, mo - 1, d, h - PH, mi, sec);
  }

  /** Task card "created" line: exact date & time in Philippine Time. */
  function tasksFormatListDate(raw) {
    if (raw == null || raw === '') return '—';
    var s = String(raw).trim();
    var t = tasksMysqlManilaWallToUtcMs(s);
    if (t == null) {
      var norm = s.indexOf('T') < 0 && /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? s.replace(' ', 'T') : s;
      t = Date.parse(norm);
    }
    if (Number.isNaN(t)) return s;
    try {
      return new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(t));
    } catch (e) {
      return s;
    }
  }

  function tasksDeadlineAtSplitForInputs(raw) {
    if (!raw) return { date: '', time: '' };
    var s = String(raw).trim();
    var m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2})?/);
    if (!m) {
      return { date: '', time: '' };
    }
    return { date: m[1], time: m[2] };
  }

  /** Build ISO fragment for API: date required; empty time defaults to 23:59 (end of day). */
  function tasksDeadlineDateTimeToApiIso(dateStr, timeStr) {
    var d = String(dateStr || '').trim();
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return null;
    }
    var ti = String(timeStr || '').trim();
    if (!ti || !/^\d{2}:\d{2}$/.test(ti)) {
      ti = '23:59';
    }
    return d + 'T' + ti;
  }

  function tasksFormatDeadlineAt(raw) {
    if (!raw) return '';
    var s = String(raw).trim().replace(' ', 'T');
    var t = Date.parse(s);
    if (Number.isNaN(t)) return String(raw);
    try {
      return new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(t));
    } catch (e) {
      return String(raw);
    }
  }

  function tasksDeadlineAtIsPast(raw) {
    if (!raw) return false;
    var s = String(raw).trim().replace(' ', 'T');
    var t = Date.parse(s);
    if (Number.isNaN(t)) return false;
    return t < Date.now();
  }

  function tasksSyncDeadlineWrap() {
    var noEl = document.getElementById('rpbdd-tasks-no-deadline');
    var wrap = document.getElementById('rpbdd-tasks-deadline-wrap');
    var dIn = document.getElementById('rpbdd-tasks-deadline-date');
    var tIn = document.getElementById('rpbdd-tasks-deadline-time');
    var dis = !!(noEl && noEl.checked);
    if (wrap) {
      wrap.hidden = dis;
    }
    if (dIn) {
      dIn.disabled = dis;
    }
    if (tIn) {
      tIn.disabled = dis;
    }
  }

  function tasksSyncCardDeadlineInput(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) return;
    var cb = document.querySelector('.rpbdd-tasks-edit-no-deadline[data-list-id="' + lid + '"]');
    var dIn = document.getElementById('rpbdd-tasks-deadline-date-edit-' + lid);
    var tIn = document.getElementById('rpbdd-tasks-deadline-time-edit-' + lid);
    var dis = !!(cb && cb.checked);
    if (dIn) {
      dIn.disabled = dis;
    }
    if (tIn) {
      tIn.disabled = dis;
    }
  }

  function tasksOpenDeadlineForm(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) return;
    document.querySelectorAll('[data-task-edit-deadline]').forEach(function (b) {
      b.hidden = false;
    });
    document.querySelectorAll('.rpbdd-tasks-card-deadline-form').forEach(function (f) {
      f.hidden = true;
    });
    var form = document.getElementById('rpbdd-tasks-deadline-form-' + lid);
    var btn = document.querySelector('[data-task-edit-deadline="' + lid + '"]');
    if (form) form.hidden = false;
    if (btn) btn.hidden = true;
    tasksSyncCardDeadlineInput(lid);
  }

  function tasksCloseDeadlineForm(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) return;
    var form = document.getElementById('rpbdd-tasks-deadline-form-' + lid);
    var btn = document.querySelector('[data-task-edit-deadline="' + lid + '"]');
    var art = form && form.closest('.rpbdd-tasks-card');
    var orig = art ? String(art.getAttribute('data-deadline-at') || '').trim() : '';
    var cb = document.querySelector('.rpbdd-tasks-edit-no-deadline[data-list-id="' + lid + '"]');
    var dIn = document.getElementById('rpbdd-tasks-deadline-date-edit-' + lid);
    var tIn = document.getElementById('rpbdd-tasks-deadline-time-edit-' + lid);
    var parts = tasksDeadlineAtSplitForInputs(orig);
    if (cb) cb.checked = !orig;
    if (dIn) dIn.value = orig ? parts.date : '';
    if (tIn) tIn.value = orig ? (parts.time || '23:59') : '23:59';
    tasksSyncCardDeadlineInput(lid);
    if (form) form.hidden = true;
    if (btn) btn.hidden = false;
  }

  function tasksSaveListDeadline(listId) {
    var base = getTasksApiBase();
    var lid = parseInt(String(listId), 10) || 0;
    if (!base || !lid) return;
    var noEl = document.querySelector('.rpbdd-tasks-edit-no-deadline[data-list-id="' + lid + '"]');
    var dEl = document.getElementById('rpbdd-tasks-deadline-date-edit-' + lid);
    var tEl = document.getElementById('rpbdd-tasks-deadline-time-edit-' + lid);
    var deadlineAt = null;
    if (!noEl || !noEl.checked) {
      var d = dEl ? String(dEl.value || '').trim() : '';
      if (!d) {
        rpbddAlertMessage('Pick a due date or check No deadline.');
        return;
      }
      var ti = tEl ? String(tEl.value || '').trim() : '';
      deadlineAt = tasksDeadlineDateTimeToApiIso(d, ti);
    }
    fetch(base + '/update-list', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: lid, deadlineAt: deadlineAt }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (e) {
            j = null;
          }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok || !o.j || !o.j.ok) {
          rpbddAlertMessage((o.j && o.j.error) || 'Could not update deadline.');
          return null;
        }
        return fetchTaskListsFromApi();
      })
      .then(function (refreshed) {
        if (refreshed === null) return;
        renderTasksPanel();
      })
      .catch(function () {
        rpbddAlertMessage('Network error while saving deadline.');
      });
  }

  function tasksCollectItemPayloadLines(linesWrap) {
    if (!linesWrap) return [];
    var out = [];
    linesWrap.querySelectorAll('.rpbdd-tasks-line-row').forEach(function (row) {
      var inp = row.querySelector('.rpbdd-tasks-line-input');
      var lab = inp ? String(inp.value || '').trim() : '';
      if (lab === '') return;
      var cb = row.querySelector('.rpbdd-tasks-line-allow-attach');
      var allow = cb ? !!cb.checked : true;
      out.push({ label: lab, allowAttachment: allow });
    });
    return out;
  }

  function tasksAppendDraftLineRow(wrap, initialValue, allowAttach) {
    if (!wrap) return;
    var row = document.createElement('div');
    row.className = 'rpbdd-tasks-line-row';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'rpbdd-tasks-line-input';
    inp.setAttribute('placeholder', 'Checklist item');
    inp.setAttribute('maxlength', '2000');
    if (initialValue) inp.value = String(initialValue);
    var optLb = document.createElement('label');
    optLb.className = 'rpbdd-tasks-line-attach-opt';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'rpbdd-tasks-line-allow-attach';
    cb.checked = allowAttach !== false && allowAttach !== 0;
    var sp = document.createElement('span');
    sp.textContent = 'Allow file';
    optLb.appendChild(cb);
    optLb.appendChild(sp);
    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'rpbdd-tasks-line-remove';
    rm.setAttribute('aria-label', 'Remove checklist line');
    rm.textContent = 'X';
    row.appendChild(inp);
    row.appendChild(optLb);
    row.appendChild(rm);
    wrap.appendChild(row);
  }

  /** @param {string} [wrapId] `rpbdd-tasks-lines` (create) or `rpbdd-tasks-edit-lines` */
  function tasksAddDraftLine(wrapId) {
    var id = wrapId || 'rpbdd-tasks-lines';
    var wrap = document.getElementById(id);
    if (!wrap) return;
    tasksAppendDraftLineRow(wrap, '');
    var inputs = wrap.querySelectorAll('.rpbdd-tasks-line-input');
    var last = inputs[inputs.length - 1];
    if (last) last.focus();
  }

  function tasksSubmitList(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) return;
    var base = getTasksApiBase();
    if (!base) return;
    fetch(base + '/submit-list', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: lid }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (e) {
            j = null;
          }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok || !o.j || !o.j.ok) {
          rpbddAlertMessage((o.j && o.j.error) || 'Could not submit task.');
          return;
        }
        return fetchTaskListsFromApi().then(function () {
          var row = tasksFindListById(lid);
          if (row && tasksBucketForList(row) === 'sent') {
            state.tasksView = 'sent';
          }
          renderTasksPanel();
        }).then(function () {
          return refreshProfileNotificationsFromApi();
        });
      })
      .catch(function () {
        rpbddAlertMessage('Network error while submitting task.');
      });
  }

  function tasksMarkListViewed(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) {
      return Promise.resolve();
    }
    var base = getTasksApiBase();
    if (!base) {
      return Promise.resolve();
    }
    return fetch(base + '/mark-list-viewed', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: lid }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (e) {
            j = null;
          }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok || !o.j || !o.j.ok) {
          return;
        }
        return fetchTaskListsFromApi().then(function () {
          renderTasksPanel();
        });
      })
      .catch(function () {});
  }

  function tasksApproveList(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) return;
    var base = getTasksApiBase();
    if (!base) return;
    fetch(base + '/approve-list', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: lid }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (e) {
            j = null;
          }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok || !o.j || !o.j.ok) {
          rpbddAlertMessage((o.j && o.j.error) || 'Could not approve task.');
          return;
        }
        return fetchTaskListsFromApi().then(function () {
          var row = tasksFindListById(lid);
          if (row && tasksBucketForList(row) === 'done') {
            state.tasksView = 'done';
          }
          renderTasksPanel();
        }).then(function () {
          return refreshProfileNotificationsFromApi();
        });
      })
      .catch(function () {
        rpbddAlertMessage('Network error while approving task.');
      });
  }

  function tasksRequestRevision(listId) {
    var lid = parseInt(String(listId), 10) || 0;
    if (!lid) return;
    var base = getTasksApiBase();
    if (!base) return;
    fetch(base + '/request-revision', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId: lid }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (e) {
            j = null;
          }
          return { ok: r.ok, j: j };
        });
      })
      .then(function (o) {
        if (!o.ok || !o.j || !o.j.ok) {
          rpbddAlertMessage((o.j && o.j.error) || 'Could not send task back for revisions.');
          return;
        }
        return fetchTaskListsFromApi().then(function () {
          var row = tasksFindListById(lid);
          if (row) {
            var b = tasksBucketForList(row);
            if (b === 'pending') state.tasksView = 'pending';
            else state.tasksView = 'new';
          }
          renderTasksPanel();
        }).then(function () {
          return refreshProfileNotificationsFromApi();
        });
      })
      .catch(function () {
        rpbddAlertMessage('Network error while sending task back.');
      });
  }

  function tasksShowSubmitNotice() {
    openRpbddConfirm({
      variant: 'restore',
      title: 'Task Not Ready',
      message: 'Please check all task items first before submitting.',
      confirmLabel: 'OK',
      cancelLabel: 'Back',
      danger: false,
    }).then(function () {});
  }

  function tasksRecipientAvatarHtml(listRow) {
    var photo = listRow && listRow.recipientPhoto != null ? String(listRow.recipientPhoto).trim() : '';
    var label = listRow && listRow.recipientDisplay != null ? String(listRow.recipientDisplay).trim() : '';
    var initials = 'U';
    if (label) {
      var base = label.split('—')[0].trim();
      var parts = base.split(/\s+/).filter(Boolean);
      if (parts.length === 1) initials = parts[0].slice(0, 2).toUpperCase();
      else if (parts.length > 1) initials = (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (photo) {
      return (
        '<span class="rpbdd-tasks-recipient-avatar" aria-hidden="true">' +
        '<img src="' +
        escapeHtml(photo) +
        '" alt="" loading="lazy" decoding="async">' +
        '</span>'
      );
    }

    return '<span class="rpbdd-tasks-recipient-avatar rpbdd-tasks-recipient-avatar--fallback" aria-hidden="true">' + escapeHtml(initials) + '</span>';
  }

  function tasksSubmitNewList() {
    var base = getTasksApiBase();
    var shell = document.getElementById('rpbdd-tasks-shell');
    if (!base || !shell) return;
    var createModal = document.getElementById('modal-add-task');
    var titleEl = document.getElementById('rpbdd-tasks-new-title');
    var title = titleEl ? String(titleEl.value || '').trim() : '';
    var roleEl = (createModal || shell).querySelector('input[name="rpbdd-tasks-role"]:checked');
    var targetRole = roleEl ? String(roleEl.value || '') : '';
    var recEl = document.getElementById('rpbdd-tasks-recipient');
    var portalRole = currentUserRole();
    var me = state.currentUser && state.currentUser.email ? String(state.currentUser.email).trim().toLowerCase() : '';
    var targetEmail = '';
    if (targetRole === 'admin') {
      if (!me) {
        rpbddAlertMessage('Could not read your account email. Refresh the page and try again.');
        return;
      }
      targetEmail = me;
    } else if (portalRole === 'team_leader' && targetRole === 'team_leader') {
      if (!me) {
        rpbddAlertMessage('Could not read your account email. Refresh the page and try again.');
        return;
      }
      targetEmail = me;
    } else if ((portalRole === 'member' || portalRole === 'user') && targetRole === 'member') {
      if (!me) {
        rpbddAlertMessage('Could not read your account email. Refresh the page and try again.');
        return;
      }
      targetEmail = me;
    } else {
      targetEmail = recEl && recEl.value ? String(recEl.value).trim().toLowerCase() : '';
    }
    var linesWrap = createModal ? createModal.querySelector('#rpbdd-tasks-lines') : null;
    var lines = tasksCollectItemPayloadLines(linesWrap);
    if (!title) {
      rpbddAlertMessage('Please enter a title for this to-do list.');
      return;
    }
    if (targetRole !== 'team_leader' && targetRole !== 'member' && targetRole !== 'admin') {
      rpbddAlertMessage('Choose who this list is for (Section Chiefs, Members, or Myself).');
      return;
    }
    if (
      portalRole === 'team_leader' &&
      targetRole === 'member' &&
      (!targetEmail || targetEmail === '')
    ) {
      rpbddAlertMessage('Select a member from Team & person.');
      return;
    }
    if (
      (portalRole === 'member' || portalRole === 'user') &&
      targetRole === 'team_leader' &&
      (!targetEmail || targetEmail === '')
    ) {
      rpbddAlertMessage('Select your section chief from Team & person.');
      return;
    }
    if (lines.length === 0) {
      rpbddAlertMessage('Add at least one checklist line.');
      return;
    }
    var noDdEl = document.getElementById('rpbdd-tasks-no-deadline');
    var dEl = document.getElementById('rpbdd-tasks-deadline-date');
    var tEl = document.getElementById('rpbdd-tasks-deadline-time');
    var deadlineAt = null;
    if (!noDdEl || !noDdEl.checked) {
      var d = dEl ? String(dEl.value || '').trim() : '';
      if (!d) {
        rpbddAlertMessage('Pick a due date or check No deadline.');
        return;
      }
      var ti = tEl ? String(tEl.value || '').trim() : '';
      deadlineAt = tasksDeadlineDateTimeToApiIso(d, ti);
    }
    fetch(base, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title,
        targetRole: targetRole,
        targetEmail: targetEmail || null,
        deadlineAt: deadlineAt,
        items: lines,
        creatorNotes: (function () {
          var nc = document.getElementById('rpbdd-tasks-creator-notes');
          return nc ? String(nc.value || '') : '';
        })(),
      }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try {
            j = t ? JSON.parse(t) : null;
          } catch (e) {
            j = null;
          }
          return { ok: r.ok, j: j, status: r.status, raw: t || '' };
        });
      })
      .then(function (o) {
        if (!o.ok || !o.j || !o.j.ok) {
          var msg = (o.j && o.j.error) || 'Could not save the list.';
          if (o.status) msg += ' (HTTP ' + o.status + ')';
          if (!o.j && o.raw) {
            var rawShort = String(o.raw).replace(/\s+/g, ' ').trim();
            if (rawShort) msg += '\n' + rawShort.slice(0, 240);
          }
          rpbddAlertMessage(msg);
          return;
        }
        if (titleEl) titleEl.value = '';
        var nNew = document.getElementById('rpbdd-tasks-creator-notes');
        if (nNew) nNew.value = '';
        var nod = document.getElementById('rpbdd-tasks-no-deadline');
        var ddel = document.getElementById('rpbdd-tasks-deadline-date');
        var tdel = document.getElementById('rpbdd-tasks-deadline-time');
        if (nod) nod.checked = false;
        if (ddel) ddel.value = '';
        if (tdel) tdel.value = '23:59';
        tasksSyncDeadlineWrap();
        var wrap = document.getElementById('rpbdd-tasks-lines');
        if (wrap) {
          wrap.innerHTML = '';
          for (var i = 0; i < 3; i++) {
            tasksAddDraftLine();
          }
        }
        closeModal('modal-add-task');
        return fetchTaskListsFromApi();
      })
      .then(function () {
        renderTasksPanel();
        return refreshProfileNotificationsFromApi();
      })
      .catch(function () {
        rpbddAlertMessage('Network error while saving.');
      });
  }

  function tasksRequiresApproval(L) {
    if (!L) return false;
    var t = '';
    if (L.targetEmail != null && String(L.targetEmail).trim() !== '') {
      t = String(L.targetEmail).trim();
    } else if (L.target_email != null && String(L.target_email).trim() !== '') {
      t = String(L.target_email).trim();
    }
    return !!t;
  }

  /** Server sets this when task targets one email; fallback for older cached payloads. */
  function tasksMarkViewedApplies(L) {
    if (!L) return false;
    if (typeof L.markViewedApplies === 'boolean') {
      return L.markViewedApplies;
    }
    if (L.markViewedApplies === 1 || L.markViewedApplies === '1') return true;
    if (L.markViewedApplies === 0 || L.markViewedApplies === '0') return false;
    if (typeof L.mark_viewed_applies === 'boolean') {
      return L.mark_viewed_applies;
    }
    if (L.mark_viewed_applies === 1 || L.mark_viewed_applies === '1') return true;
    if (L.mark_viewed_applies === 0 || L.mark_viewed_applies === '0') return false;
    return tasksRequiresApproval(L);
  }

  function tasksIsCreatorList(L) {
    if (!L) return false;
    var myEmail = state.currentUser && state.currentUser.email ? String(state.currentUser.email).trim().toLowerCase() : '';
    var cr = String(L.createdByEmail || '')
      .trim()
      .toLowerCase();
    return !!myEmail && !!cr && myEmail === cr;
  }

  /**
   * Buckets: review (creator — assignee submitted, awaiting decision), sent (assignee — submitted, awaiting approval),
   * done, pending (overdue & not finished), new (Task tab — active work).
   */
  function tasksBucketForList(L) {
    if (!L) return 'new';
    var needAp = tasksMarkViewedApplies(L);
    var appr = !!(L.creatorApprovedAt && String(L.creatorApprovedAt).trim());
    var isCreator = tasksIsCreatorList(L);
    var assigneeSubmitted = !!L.assigneeSubmitted;
    var mySubmitted = !!L.isSubmitted;

    if (needAp && isCreator && assigneeSubmitted && !appr) {
      return 'review';
    }
    if (needAp && !isCreator && !!L.canToggle && mySubmitted && !appr) {
      return 'sent';
    }

    var items = Array.isArray(L.items) ? L.items : [];
    var allDone =
      items.length > 0 &&
      items.every(function (it) {
        return !!it.isDone;
      });
    var isDoneBucket = needAp ? appr : allDone && mySubmitted;
    var effDue = L.deadlineAt || L.deadlineDate || '';
    var overdue = !!(effDue && tasksDeadlineAtIsPast(effDue));
    if (isDoneBucket) return 'done';
    if (!isDoneBucket && overdue) return 'pending';
    return 'new';
  }

  function tasksAttachmentExtFromName(name) {
    var n = String(name || '');
    var i = n.lastIndexOf('.');
    if (i < 0) return '';
    return n.slice(i + 1).toLowerCase();
  }

  function tasksAttachmentPreviewKind(name) {
    var ext = tasksAttachmentExtFromName(name);
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].indexOf(ext) >= 0) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'txt' || ext === 'csv') return 'text';
    if (ext === 'doc' || ext === 'docx') return 'word-html';
    if (['xls', 'xlsx', 'ppt', 'pptx'].indexOf(ext) >= 0) return 'office';
    return 'other';
  }

  function tasksAttachmentWordPreviewUrl(taskApiBase, id) {
    return taskApiBase + '/item-attachment/' + id + '/preview-word';
  }

  function tasksAttachmentViewUrl(taskApiBase, id) {
    return taskApiBase + '/item-attachment/' + id + '/view';
  }

  function tasksAttachmentDownloadUrl(taskApiBase, id) {
    return taskApiBase + '/item-attachment/' + id + '/download';
  }

  function tasksAttachmentDeleteUrl(taskApiBase, id) {
    return taskApiBase + '/item-attachment/' + id;
  }

  /** Microsoft Office Online fetches the signed URL from its servers — cannot reach localhost / most LAN IPs. */
  function tasksOfficeEmbedBlockedByHost() {
    try {
      var h = String(window.location.hostname || '').toLowerCase();
      if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]' || h.endsWith('.local')) {
        return true;
      }
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
      var m = h.match(/^172\.(\d{1,3})\./);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n >= 16 && n <= 31) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /** View — opens global modal with image / iframe / Office embed */
  function tasksOpenAttachmentPreviewModal(listId, kind, title, viewUrl, attachmentId) {
    var overlay = document.getElementById('modal-task-attachment-preview');
    var body = document.getElementById('rpbdd-task-attachment-preview-body');
    var ttl = document.getElementById('rpbdd-task-attachment-preview-title');
    if (!overlay || !body) return;
    if (ttl) ttl.textContent = title || 'File preview';
    body.innerHTML = '';

    function appendEl(el) {
      body.appendChild(el);
    }

    if (kind === 'image') {
      var img = document.createElement('img');
      img.className = 'rpbdd-task-attachment-modal-img';
      img.src = viewUrl;
      img.alt = title || '';
      appendEl(img);
      openModal('modal-task-attachment-preview');
      return;
    }
    if (kind === 'pdf' || kind === 'text' || kind === 'word-html') {
      var frame = document.createElement('iframe');
      frame.className = 'rpbdd-task-attachment-modal-frame';
      frame.title = title || 'Document';
      frame.src = viewUrl;
      appendEl(frame);
      openModal('modal-task-attachment-preview');
      return;
    }
    if (kind === 'office') {
      openModal('modal-task-attachment-preview');
      body.innerHTML =
        '<div class="rpbdd-tasks-card-preview-loading">' + escapeHtml('Loading Office preview…') + '</div>';
      var base0 = getTasksApiBase();
      if (tasksOfficeEmbedBlockedByHost()) {
        var dl0 = base0 && attachmentId ? tasksAttachmentDownloadUrl(base0, attachmentId) : '';
        body.innerHTML =
          '<div class="rpbdd-tasks-card-preview-office-msg">' +
          '<p class="rpbdd-tasks-card-preview-office-lead"><strong>Excel / PowerPoint</strong> preview runs on <strong>Microsoft Office Online</strong>. Microsoft’s servers must download your file from this website.</p>' +
          '<p>On <strong>localhost</strong> or a <strong>private LAN address</strong>, they cannot reach your file. <strong>PDF</strong> and <strong>Word (.doc / .docx)</strong> still preview in this modal from your server.</p>' +
          '<p class="rpbdd-tasks-card-preview-office-tip">Host the app on a public <strong>HTTPS</strong> URL to preview spreadsheets or slides here, or use <strong>Download</strong>.</p>' +
          (dl0
            ? '<a class="rpbdd-btn-sm rpbdd-btn-sm--green" href="' +
              escapeHtml(dl0) +
              '">Download</a>'
            : '') +
        '</div>';
        return;
      }
      var base = getTasksApiBase();
      if (!base || !attachmentId) {
        body.innerHTML =
          '<div class="rpbdd-tasks-card-preview-err">Preview unavailable.</div>';
        return;
      }
      fetch(base + '/item-attachment/' + attachmentId + '/embed-link', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
        .then(function (r) {
          return r.text().then(function (t) {
            var j = null;
            try {
              j = t ? JSON.parse(t) : null;
            } catch (err) {
              j = null;
            }
            return { ok: r.ok, j: j };
          });
        })
        .then(function (o) {
          body.innerHTML = '';
          if (!o.ok || !o.j || !o.j.ok || !o.j.url) {
            body.innerHTML =
              '<div class="rpbdd-tasks-card-preview-err">Could not open Microsoft preview. Use <strong>Download</strong> or deploy on public HTTPS (Office Online cannot reach localhost).</div>';
            return;
          }
          var abs = String(o.j.url);
          var ifm = document.createElement('iframe');
          ifm.className = 'rpbdd-task-attachment-modal-frame rpbdd-task-attachment-modal-frame--office';
          ifm.title = title || 'Office document';
          ifm.src =
            'https://view.officeapps.live.com/op/embed.aspx?ui=en-US&rs=en-US&wdStartOn=1&src=' +
            encodeURIComponent(abs);
          body.appendChild(ifm);
        })
        .catch(function () {
          body.innerHTML =
            '<div class="rpbdd-tasks-card-preview-err">Network error while loading Office preview.</div>';
        });
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'rpbdd-tasks-card-preview-fallback';
    wrap.innerHTML =
      '<p class="rpbdd-tasks-card-preview-fallback-msg">In-browser preview is not available for this type.</p>' +
      '<a class="rpbdd-btn-sm rpbdd-btn-sm--green" href="' +
      escapeHtml(viewUrl) +
      '" target="_blank" rel="noopener">Open in new tab</a>';
    appendEl(wrap);
    openModal('modal-task-attachment-preview');
  }

  function tasksBuildAttachmentSlot(att, taskApiBase, slotClass, byEmail, listId, showRemove, slotUi) {
    if (!att || !att.id || !taskApiBase) return '';
    slotUi = slotUi || {};
    var showDownload = slotUi.showDownload !== false;
    var id = att.id;
    var name = att.originalName || 'File';
    var kind = tasksAttachmentPreviewKind(name);
    var viewU =
      kind === 'word-html' ? tasksAttachmentWordPreviewUrl(taskApiBase, id) : tasksAttachmentViewUrl(taskApiBase, id);
    var dlU = tasksAttachmentDownloadUrl(taskApiBase, id);
    var sc = slotClass || 'rpbdd-tasks-attach-slot';
    var by =
      byEmail && String(byEmail).trim()
        ? '<span class="rpbdd-tasks-support-by">' + escapeHtml(String(byEmail).trim()) + '</span>'
        : '';
    var svgAttachView =
      '<svg class="rpbdd-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    var svgAttachDl =
      '<svg class="rpbdd-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    var svgAttachRm =
      '<svg class="rpbdd-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    var rmBtn = showRemove
      ? '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--attach rpbdd-btn-action--remove" data-task-remove-attachment="' +
        id +
        '" aria-label="Remove attachment">' +
        svgAttachRm +
        '<span>Remove</span>' +
        '</button>'
      : '';
    var showViewBtn = kind === 'image' || kind === 'pdf';
    var hasThreeActionButtons = showViewBtn && showDownload && showRemove;
    var prevBtn = showViewBtn
      ? '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green rpbdd-btn-sm--attach rpbdd-tasks-card-preview-trigger" data-task-preview-list="' +
        listId +
        '" data-task-preview-kind="' +
        escapeHtml(kind) +
        '" data-task-preview-title="' +
        escapeHtml(name) +
        '" data-task-preview-view-url="' +
        escapeHtml(viewU) +
        '" data-task-attachment-id="' +
        id +
        '">' +
        svgAttachView +
        '<span>View</span></button>'
      : '';
    var dlBtn = showDownload
      ? '<a class="rpbdd-btn-sm rpbdd-btn-sm--blue rpbdd-btn-sm--attach" href="' +
        escapeHtml(dlU) +
        '">' +
        svgAttachDl +
        '<span>Download</span></a>'
      : '';
    var iconBlock = '';
    if (kind === 'image') {
      iconBlock =
        '<span class="rpbdd-tasks-attach-mini-img"><img src="' +
        escapeHtml(tasksAttachmentViewUrl(taskApiBase, id)) +
        '" alt="" loading="lazy" referrerpolicy="no-referrer" /></span>';
    } else if (kind === 'pdf') {
      iconBlock = '<span class="rpbdd-tasks-attach-kind-badge rpbdd-tasks-attach-kind-badge--pdf">PDF</span>';
    } else if (kind === 'word-html') {
      iconBlock = '<span class="rpbdd-tasks-attach-kind-badge rpbdd-tasks-attach-kind-badge--doc">DOC</span>';
    } else if (kind === 'office') {
      iconBlock =
        '<span class="rpbdd-tasks-attach-kind-badge rpbdd-tasks-attach-kind-badge--office">' +
        escapeHtml(tasksAttachmentExtFromName(name).toUpperCase()) +
        '</span>';
    } else if (kind === 'text') {
      iconBlock = '<span class="rpbdd-tasks-attach-kind-badge rpbdd-tasks-attach-kind-badge--txt">TXT</span>';
    } else {
      iconBlock = '<span class="rpbdd-tasks-attach-kind-badge rpbdd-tasks-attach-kind-badge--file">FILE</span>';
    }
    return (
      '<div class="' +
      escapeHtml(sc) +
      '">' +
      '<div class="rpbdd-tasks-attach-compact-row">' +
      iconBlock +
      '<span class="rpbdd-tasks-attach-compact-name">' +
      escapeHtml(name) +
      '</span></div>' +
      '<div class="rpbdd-tasks-attach-slot-actions' +
      (hasThreeActionButtons ? ' rpbdd-tasks-attach-slot-actions--stack-remove' : '') +
      '">' +
      prevBtn +
      dlBtn +
      rmBtn +
      '</div>' +
      by +
      '</div>'
    );
  }

  function tasksBuildTaskCardHtml(L, role) {
    if (!L) return '';
        var listId = parseInt(String(L.id), 10) || 0;
    var expanded = state.expandedTaskListId === listId;
    var myEmail = state.currentUser && state.currentUser.email ? String(state.currentUser.email).trim().toLowerCase() : '';
    var myName = state.currentUser && state.currentUser.name ? String(state.currentUser.name).trim().toLowerCase() : '';
    var crEm = (function () {
      var raw = firstNonEmptyString(L.createdByEmail, L.createdBy, L.inputBy, L.created_by_email);
      return String(raw || '').trim().toLowerCase();
    })();
    var crName = String(firstNonEmptyString(L.createdByDisplay, L.createdBy) || '').trim().toLowerCase();
    var isCreatorByEmail = !!myEmail && !!crEm && myEmail === crEm;
    var isCreatorByName = !isCreatorByEmail && !!myName && !!crName && myName === crName;
    var isCreatorPortal =
      role === 'admin' || role === 'team_leader' || role === 'member' || role === 'user';
    var isCreator =
      isCreatorPortal && (isCreatorByEmail || (role === 'admin' && isCreatorByName));
        var badge =
          L.targetRole === 'member'
            ? '<span class="rpbdd-tasks-badge rpbdd-tasks-badge--mb">Members</span>'
            : L.targetRole === 'admin'
              ? '<span class="rpbdd-tasks-badge rpbdd-tasks-badge--self">Myself</span>'
              : '<span class="rpbdd-tasks-badge rpbdd-tasks-badge--tl">Section Chiefs</span>';
        var posted = escapeHtml(tasksFormatListDate(L.createdAt));
    var toVal = escapeHtml(L.recipientDisplay || '—');
    var fromVal = escapeHtml(L.createdByDisplay || L.createdByEmail || '—');
        var metaRows =
      '<li><span class="rpbdd-tasks-meta-k">To</span><span class="rpbdd-tasks-meta-v">' +
      toVal +
          '</span></li>' +
            '<li><span class="rpbdd-tasks-meta-k">From</span><span class="rpbdd-tasks-meta-v">' +
      fromVal +
            '</span></li>';
        var effDue = L.deadlineAt || L.deadlineDate || '';
        if (effDue) {
          var dueDisp = tasksFormatDeadlineAt(effDue);
          var past = tasksDeadlineAtIsPast(effDue);
          metaRows +=
            '<li><span class="rpbdd-tasks-meta-k">Due</span><span class="rpbdd-tasks-meta-v' +
            (past ? ' rpbdd-tasks-meta-v--overdue' : '') +
            '">' +
            escapeHtml(dueDisp) +
            (past ? ' <span class="rpbdd-tasks-overdue-tag">Overdue</span>' : '') +
            '</span></li>';
        }
        var dlParts = tasksDeadlineAtSplitForInputs(L.deadlineAt || '');
        var editDeadlineBlock = '';
    if (isCreator && listId > 0) {
          editDeadlineBlock =
            '<div class="rpbdd-tasks-card-deadline-edit">' +
            '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--blue rpbdd-btn-sm--dense" data-task-edit-deadline="' +
            listId +
            '">Edit deadline</button>' +
            '<div class="rpbdd-tasks-card-deadline-form" id="rpbdd-tasks-deadline-form-' +
            listId +
            '" hidden>' +
            '<label class="rpbdd-tasks-check-inline"><input type="checkbox" class="rpbdd-tasks-edit-no-deadline" data-list-id="' +
            listId +
            '"' +
            (!L.deadlineAt ? ' checked' : '') +
            ' /><span>No deadline</span></label>' +
            '<div class="rpbdd-tasks-deadline-split-row">' +
            '<div class="rpbdd-tasks-deadline-split-field">' +
            '<label class="rpbdd-tasks-deadline-sub" for="rpbdd-tasks-deadline-date-edit-' +
            listId +
            '">Due date</label>' +
            '<input type="date" class="rpbdd-tasks-date-input" id="rpbdd-tasks-deadline-date-edit-' +
            listId +
            '" value="' +
            escapeHtml(dlParts.date) +
            '" />' +
            '</div>' +
            '<div class="rpbdd-tasks-deadline-split-field">' +
            '<label class="rpbdd-tasks-deadline-sub" for="rpbdd-tasks-deadline-time-edit-' +
            listId +
            '">Due time</label>' +
            '<input type="time" class="rpbdd-tasks-date-input" id="rpbdd-tasks-deadline-time-edit-' +
            listId +
            '" value="' +
            escapeHtml(dlParts.time || '23:59') +
            '" />' +
            '</div>' +
            '</div>' +
            '<div class="rpbdd-tasks-card-deadline-actions">' +
            '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green rpbdd-btn-sm--dense" data-task-save-deadline="' +
            listId +
            '">Save</button>' +
            '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--blue rpbdd-btn-sm--dense" data-task-cancel-deadline="' +
            listId +
            '">Cancel</button>' +
            '</div></div></div>';
        }
        var items = Array.isArray(L.items) ? L.items : [];
    var isSubmitted = !!L.isSubmitted;
    var openedByAssignee = !!(L.assigneeOpenedAt && String(L.assigneeOpenedAt).trim());
    var needsAp = tasksMarkViewedApplies(L);
    var taskInDoneBucket = tasksBucketForList(L) === 'done';
    var cardSeenClass = openedByAssignee ? ' rpbdd-tasks-card--opened' : '';
    var maxAttachPerLine =
      typeof L.maxAttachmentsPerLine === 'number' && L.maxAttachmentsPerLine > 0
        ? L.maxAttachmentsPerLine
        : 20;
    var taskApiBase = getTasksApiBase();
    var svgTaskAttach =
      '<svg class="rpbdd-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>';
        var lis = '';
        items.forEach(function (it) {
          if (!it || !it.id) return;
          var done = !!it.isDone;
          var can = !!L.canToggle;
          var id = parseInt(String(it.id), 10) || 0;
      var myAttachments = [];
      if (Array.isArray(it.attachments) && it.attachments.length) {
        it.attachments.forEach(function (a) {
          if (a && a.id) {
            myAttachments.push(a);
          }
        });
      } else if (it.attachment && it.attachment.id) {
        myAttachments.push(it.attachment);
      }
      var support = Array.isArray(it.supportingFiles) ? it.supportingFiles : [];
      var sideParts = [];
      var allowLineAttach = !(it.allowAttachment === false || it.allowAttachment === 0);
      var canAddMoreFiles = myAttachments.length < maxAttachPerLine;
      var showRemoveAllMy =
        can && !isSubmitted && !taskInDoneBucket && allowLineAttach && myAttachments.length >= 2;
      if (can && !isSubmitted && !taskInDoneBucket && allowLineAttach && (canAddMoreFiles || showRemoveAllMy)) {
        var rmAllIds = showRemoveAllMy
          ? myAttachments
              .map(function (a) {
                return a && a.id ? String(a.id) : '';
              })
              .filter(Boolean)
              .join(',')
          : '';
        sideParts.push(
          '<div class="rpbdd-tasks-item-attach rpbdd-tasks-attach-actions-row' +
            (showRemoveAllMy ? ' has-remove-all' : '') +
            '">'
        );
        if (canAddMoreFiles) {
          sideParts.push(
            '<label class="rpbdd-tasks-attach-label rpbdd-btn-sm rpbdd-btn-sm--blue rpbdd-btn-sm--attach" title="You can select multiple files at once (images, PDFs, etc.). Each file up to 10 MB.">' +
              '<input type="file" class="rpbdd-tasks-attach-input" multiple data-task-attach-item="' +
              id +
              '" data-task-attach-remaining="' +
              (maxAttachPerLine - myAttachments.length) +
              '" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.zip,application/pdf,application/zip" />' +
              svgTaskAttach +
              '<span class="rpbdd-tasks-attach-label-text"><span>Attach</span> <span class="rpbdd-tasks-attach-optional-note">(optional)</span></span>' +
              '</label>'
          );
        }
        if (showRemoveAllMy && rmAllIds) {
          sideParts.push(
            '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--orange rpbdd-btn-sm--attach rpbdd-tasks-remove-all-attachments" data-task-remove-all-attachments="' +
            escapeHtml(rmAllIds) +
            '" title="Remove every file you attached on this line">' +
            svgIconRemove +
            '<span>Remove All</span></button>'
          );
        }
        sideParts.push('</div>');
      } else if (isCreator && allowLineAttach && (!can || isSubmitted) && support.length === 0) {
        sideParts.push(
          '<div class="rpbdd-tasks-item-attach rpbdd-tasks-item-attach--display-only" title="Shown when the assignee has not attached a file yet. After they attach, this preview is hidden and their files appear below.">' +
            '<span class="rpbdd-tasks-attach-display-only">' +
            svgTaskAttach +
            '<span>Attach</span> <span class="rpbdd-tasks-attach-optional-note">(optional)</span>' +
            '</span>' +
            '</div>'
        );
      }
      var attachmentSlotChunks = [];
      if (taskApiBase && allowLineAttach) {
        myAttachments.forEach(function (att) {
          if (!att || !att.id) {
            return;
          }
          attachmentSlotChunks.push(
            tasksBuildAttachmentSlot(
              att,
              taskApiBase,
              'rpbdd-tasks-attach-slot',
              '',
              listId,
              !!L.canToggle && !isSubmitted && !taskInDoneBucket,
              { showDownload: true }
            )
          );
        });
      }
      if (support.length > 0 && isCreator && !L.canToggle) {
        support.forEach(function (sf) {
          if (!sf || !sf.id || !taskApiBase) return;
          attachmentSlotChunks.push(
            tasksBuildAttachmentSlot(
              { id: sf.id, originalName: sf.originalName },
              taskApiBase,
              'rpbdd-tasks-attach-slot rpbdd-tasks-attach-slot--support',
              sf.uploadedByEmail || '',
              listId,
              false,
              { showDownload: true }
            )
          );
        });
      }
      if (attachmentSlotChunks.length > 0) {
        sideParts.push(
          '<div class="rpbdd-tasks-attachments-scroll">' + attachmentSlotChunks.join('') + '</div>'
        );
      }
      var sideInner = sideParts.join('');
          lis +=
        '<li class="rpbdd-tasks-checklist-item">' +
        '<div class="rpbdd-tasks-checklist-item-main">' +
            '<input type="checkbox" class="rpbdd-tasks-check" data-task-list="' +
            listId +
            '" data-task-item="' +
            id +
            '"' +
            (done ? ' checked' : '') +
        (!can || isSubmitted ? ' disabled' : '') +
            ' />' +
            '<span class="rpbdd-tasks-item-label' +
            (done ? ' is-done' : '') +
            '">' +
            escapeHtml(it.label || '') +
        '</span></div>' +
        '<div class="rpbdd-tasks-checklist-item-side">' +
        sideInner +
        '</div>' +
            '</li>';
        });
    var allDone =
      items.length > 0 &&
      items.every(function (it) {
        return !!it.isDone;
      });
    var footerLeft = '';
    var footerRight = '';
    var revReq = !!(L.revisionRequestedAt && String(L.revisionRequestedAt).trim());
    var approved = !!(L.creatorApprovedAt && String(L.creatorApprovedAt).trim());
    if (!isSubmitted && !!L.canToggle && revReq && needsAp) {
      footerLeft =
        '<span class="rpbdd-tasks-revision-tag">Please apply the requested changes, then submit again.</span>';
    } else if (allDone && !isSubmitted && !!L.canToggle) {
      footerLeft = '<span class="rpbdd-tasks-pending-tag">Pending submission</span>';
    }
    else if (isSubmitted && needsAp && !approved) {
      footerLeft = '<span class="rpbdd-tasks-submitted-tag">Submitted — awaiting creator review</span>';
    } else if (isSubmitted && !needsAp) {
      footerLeft = '<span class="rpbdd-tasks-submitted-tag">Submitted</span>';
    } else if (isSubmitted && needsAp && approved) {
      footerLeft = '<span class="rpbdd-tasks-submitted-tag">Approved</span>';
    }
    if (!!L.canToggle && !isSubmitted && listId > 0) {
      footerRight +=
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green" data-task-submit-list="' +
        listId +
        '" data-task-all-done="' +
        (allDone ? '1' : '0') +
        '">Submit Task</button>';
    }
    var creatorMayEdit = isCreator && !isSubmitted && listId > 0 && !(needsAp && !!L.assigneeSubmitted);
    if (creatorMayEdit) {
      footerRight +=
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--edit" data-task-open-edit="' +
        listId +
        '">' +
        svgIconEdit +
        '<span>Edit</span></button>';
    }
    if (isCreator && expanded && listId > 0 && !taskInDoneBucket) {
      footerRight +=
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete" data-task-delete-list="' +
        listId +
        '" data-task-delete-submitted="' +
        (isSubmitted ? '1' : '0') +
        '">' +
        svgIconRemove +
        '<span>Delete task</span></button>';
    }
    var inReviewTab = String(state.tasksView || '').toLowerCase() === 'review';
    if (
      isCreator &&
      inReviewTab &&
      expanded &&
      listId > 0 &&
      needsAp &&
      !!L.assigneeSubmitted &&
      !approved
    ) {
      footerRight +=
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green" data-task-approve-list="' +
        listId +
        '">Approve</button>';
      footerRight +=
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--neutral" data-task-request-revision-list="' +
        listId +
        '">Send back for revisions</button>';
    }
    var footerHtml = '';
    if (footerLeft || footerRight) {
      footerHtml =
        '<div class="rpbdd-tasks-card-footer">' +
        '<div class="rpbdd-tasks-card-footer-left">' +
        footerLeft +
        '</div>' +
        '<div class="rpbdd-tasks-card-footer-right">' +
        footerRight +
        '</div>' +
        '</div>';
    }
    var notesTrim =
      L.creatorNotes != null && String(L.creatorNotes).trim() !== '' ? String(L.creatorNotes).trim() : '';
    var notesBlock = '';
    if (notesTrim !== '') {
      notesBlock =
        '<div class="rpbdd-tasks-card-notes">' +
        '<div class="rpbdd-tasks-card-notes-h">Notes / remarks</div>' +
        '<div class="rpbdd-tasks-card-notes-body">' +
        escapeHtml(notesTrim) +
        '</div></div>';
    }
    var notesEditRow = '';
    if (isCreator && listId > 0) {
      notesEditRow =
        '<div class="rpbdd-tasks-card-notes-edit">' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--orange rpbdd-btn-sm--dense" data-task-edit-creator-notes="' +
        listId +
        '">' +
        (notesTrim ? 'Edit notes / remarks' : 'Add notes / remarks') +
        '</button></div>';
    }
    var recipientAvatar = tasksRecipientAvatarHtml(L);
    var markViewedHintHtml = '';
    if (listId > 0 && expanded) {
      var mvApplies = needsAp;
      var rowParts = [
        '<div class="rpbdd-tasks-mark-viewed-row" role="region" aria-label="Mark as viewed">',
        '<span class="rpbdd-tasks-mark-viewed-badge">Mark as viewed</span>',
      ];
      if (mvApplies) {
        if (!openedByAssignee && !!L.canToggle) {
          rowParts.push(
            '<p class="rpbdd-tasks-mark-viewed-hint" role="note">Expand this task after you read it. Your card and the creator’s card will <strong>highlight automatically</strong>.</p>'
          );
        } else if (!openedByAssignee && isCreator) {
          rowParts.push(
            '<p class="rpbdd-tasks-mark-viewed-hint rpbdd-tasks-mark-viewed-hint--creator" role="note">Waiting for the assignee to view this task. Once viewed, both cards <strong>highlight automatically</strong>.</p>'
          );
        } else if (!openedByAssignee) {
          rowParts.push(
            '<p class="rpbdd-tasks-mark-viewed-desc rpbdd-tasks-mark-viewed-desc--muted">Assigned to one person — tracking turns on when they expand the card.</p>'
          );
        }
      } else {
        rowParts.push(
          '<p class="rpbdd-tasks-mark-viewed-desc rpbdd-tasks-mark-viewed-desc--muted">Choose <strong>one person</strong> under Team &amp; person (not “Everyone”) to track when they open the task.</p>'
        );
      }
      rowParts.push('</div>');
      markViewedHintHtml = rowParts.join('');
    }
    return (
          '<article class="rpbdd-tasks-card' +
      cardSeenClass +
      '" data-deadline-at="' +
          escapeHtml(L.deadlineAt || '') +
      '">' +
      '<div class="rpbdd-tasks-card-head">' +
      '<div class="rpbdd-tasks-card-head-row">' +
          '<div class="rpbdd-tasks-card-head-main" data-expand-task-list="' +
      listId +
      '">' +
          '<h3 class="rpbdd-tasks-card-title">' +
          escapeHtml(L.title || '') +
          '</h3>' +
      '<p class="rpbdd-tasks-card-created">' +
      posted +
      '</p>' +
      markViewedHintHtml +
      '</div>' +
      '<div class="rpbdd-tasks-card-head-side">' +
      recipientAvatar +
          badge +
          '</div>' +
      '</div>' +
      '</div>' +
      '<div class="rpbdd-tasks-card-body' +
      (expanded ? '' : ' is-collapsed') +
      '">' +
      '<ul class="rpbdd-tasks-card-meta-list">' +
      metaRows +
      '</ul>' +
      notesBlock +
      notesEditRow +
          editDeadlineBlock +
          '<ul class="rpbdd-tasks-checklist">' +
          lis +
          '</ul>' +
      footerHtml +
      '</div>' +
      '</article>'
    );
  }

  function renderTasksPanel() {
    var shell = document.getElementById('rpbdd-tasks-shell');
    if (!shell) return;
    var base = getTasksApiBase();
    var role = currentUserRole();
    if (!base) {
      shell.innerHTML =
        '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--err">Tasks are not configured on this server (missing tasks API URL).</div>';
      return;
    }

    var lists = state.taskLists || [];
    var newRows = [];
    var sentRows = [];
    var pendingRows = [];
    var doneRows = [];
    var reviewRows = [];
    lists.forEach(function (L) {
      if (!L) return;
      var b = tasksBucketForList(L);
      if (b === 'review') reviewRows.push(L);
      else if (b === 'sent') sentRows.push(L);
      else if (b === 'done') doneRows.push(L);
      else if (b === 'pending') pendingRows.push(L);
      else newRows.push(L);
    });
    var newCount = newRows.length;
    var sentCount = sentRows.length;
    var pendingCount = pendingRows.length;
    var reviewCount = reviewRows.length;
    var doneCount = doneRows.length;
    var showReviewPill = reviewCount > 0;
    var showSentPill = sentCount > 0;
    var tasksViewLo = String(state.tasksView || '').toLowerCase();
    if (tasksViewLo === 'review' && !showReviewPill) {
      state.tasksView = 'new';
    }
    if (tasksViewLo === 'sent' && !showSentPill) {
      state.tasksView = 'new';
    }

    var compose = '';
    var reviewPillHtml = showReviewPill
      ? '<button type="button" class="rpbdd-pill' +
        (String(state.tasksView || '').toLowerCase() === 'review' ? ' is-active' : '') +
        '" data-tasks-view="review">Review (<span id="rpbdd-count-task-review">0</span>)</button>'
      : '';
    var sentPillHtml = showSentPill
      ? '<button type="button" class="rpbdd-pill' +
        (String(state.tasksView || '').toLowerCase() === 'sent' ? ' is-active' : '') +
        '" data-tasks-view="sent">Sent (<span id="rpbdd-count-task-sent">0</span>)</button>'
      : '';
    var createTaskTrigger =
      '<div class="rpbdd-toolbar rpbdd-tasks-toolbar">' +
      '<div class="rpbdd-pill-group">' +
      '<button type="button" class="rpbdd-pill' +
      (state.tasksView === 'new' ? ' is-active' : '') +
      '" data-tasks-view="new">Task (<span id="rpbdd-count-task-new">0</span>)</button>' +
      sentPillHtml +
      '<button type="button" class="rpbdd-pill' +
      (state.tasksView === 'pending' ? ' is-active' : '') +
      '" data-tasks-view="pending">Pending (<span id="rpbdd-count-task-pending">0</span>)</button>' +
      reviewPillHtml +
      '<button type="button" class="rpbdd-pill' +
      (state.tasksView === 'done' ? ' is-active' : '') +
      '" data-tasks-view="done">Done Task (<span id="rpbdd-count-task-done">0</span>)</button>' +
      '</div>' +
      ((role === 'admin' || role === 'team_leader' || role === 'member' || role === 'user') &&
      String(state.tasksView || 'new').toLowerCase() === 'new'
        ? '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green" id="rpbdd-open-add-task">Create Task</button>'
        : '') +
      '</div>';
    if (role === 'admin' || role === 'team_leader' || role === 'member' || role === 'user') {
      var addRecvHint =
        role === 'admin'
          ? 'Each option shows team, name, and email. Leave on <strong>Everyone</strong> to send to the whole role.'
          : 'Pick the person who should receive this task.';
      compose =
        '<div class="rpbdd-modal-overlay" id="modal-add-task">' +
        '<div class="rpbdd-modal rpbdd-modal--lg">' +
        '<div class="rpbdd-modal-head">' +
        '<h2>Create Task</h2>' +
        '<button type="button" class="rpbdd-modal-close" data-close-modal="modal-add-task" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="rpbdd-modal-body">' +
        '<div class="rpbdd-tasks-compose-body">' +
        '<div class="rpbdd-tasks-compose-col rpbdd-tasks-compose-col--main">' +
        '<div class="rpbdd-tasks-field">' +
        '<label for="rpbdd-tasks-new-title">List title</label>' +
        '<input type="text" id="rpbdd-tasks-new-title" class="rpbdd-tasks-title-input" maxlength="500" placeholder="e.g. Weekly compliance review" />' +
        '</div>' +
        '<div class="rpbdd-tasks-field">' +
        '<label for="rpbdd-tasks-creator-notes">Notes / remarks</label>' +
        '<textarea id="rpbdd-tasks-creator-notes" class="rpbdd-tasks-notes-input" rows="3" maxlength="5000" placeholder="Optional — visible to the assignee"></textarea>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Optional instructions or context for whoever receives this task.</p>' +
        '</div>' +
        '<div class="rpbdd-tasks-field">' +
        '<label>Checklist items</label>' +
        '<div class="rpbdd-tasks-lines" id="rpbdd-tasks-lines">' +
        '<div class="rpbdd-tasks-line-row"><input type="text" class="rpbdd-tasks-line-input" placeholder="Checklist item" maxlength="2000" /><label class="rpbdd-tasks-line-attach-opt"><input type="checkbox" class="rpbdd-tasks-line-allow-attach" checked /><span>Allow file</span></label><button type="button" class="rpbdd-tasks-line-remove" aria-label="Remove checklist line">X</button></div>' +
        '<div class="rpbdd-tasks-line-row"><input type="text" class="rpbdd-tasks-line-input" placeholder="Checklist item" maxlength="2000" /><label class="rpbdd-tasks-line-attach-opt"><input type="checkbox" class="rpbdd-tasks-line-allow-attach" checked /><span>Allow file</span></label><button type="button" class="rpbdd-tasks-line-remove" aria-label="Remove checklist line">X</button></div>' +
        '<div class="rpbdd-tasks-line-row"><input type="text" class="rpbdd-tasks-line-input" placeholder="Checklist item" maxlength="2000" /><label class="rpbdd-tasks-line-attach-opt"><input type="checkbox" class="rpbdd-tasks-line-allow-attach" checked /><span>Allow file</span></label><button type="button" class="rpbdd-tasks-line-remove" aria-label="Remove checklist line">X</button></div>' +
        '</div>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Per line: uncheck <strong>Allow file</strong> if that step should not accept an upload.</p>' +
        '</div>' +
        '</div>' +
        '<div class="rpbdd-tasks-compose-col rpbdd-tasks-compose-col--side">' +
        '<div class="rpbdd-tasks-field">' +
        '<label>Send to</label>' +
        tasksSendToRadiosHtml(role) +
        '</div>' +
        '<div class="rpbdd-tasks-field" id="rpbdd-tasks-recipient-block">' +
        '<label for="rpbdd-tasks-recipient">Team &amp; person</label>' +
        '<select id="rpbdd-tasks-recipient" class="rpbdd-tasks-recipient-select" aria-label="Pick a team and person, or everyone in role">' +
        tasksBuildRecipientOptions(tasksDefaultRecipientRoleForPortal(role), role) +
        '</select>' +
        '<p class="rpbdd-tasks-hint">' +
        addRecvHint +
        '</p>' +
        '</div>' +
        '<div class="rpbdd-tasks-field rpbdd-tasks-field--deadline">' +
        '<label>Deadline</label>' +
        '<label class="rpbdd-tasks-check-inline">' +
        '<input type="checkbox" id="rpbdd-tasks-no-deadline" />' +
        '<span>No deadline</span>' +
        '</label>' +
        '<div class="rpbdd-tasks-deadline-wrap" id="rpbdd-tasks-deadline-wrap" hidden>' +
        '<div class="rpbdd-tasks-deadline-split-row">' +
        '<div class="rpbdd-tasks-deadline-split-field">' +
        '<label class="rpbdd-tasks-deadline-sub" for="rpbdd-tasks-deadline-date">Due date</label>' +
        '<input type="date" id="rpbdd-tasks-deadline-date" class="rpbdd-tasks-date-input" disabled />' +
        '</div>' +
        '<div class="rpbdd-tasks-deadline-split-field">' +
        '<label class="rpbdd-tasks-deadline-sub" for="rpbdd-tasks-deadline-time">Due time</label>' +
        '<input type="time" id="rpbdd-tasks-deadline-time" class="rpbdd-tasks-date-input" value="23:59" disabled />' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Set <strong>Due date</strong> and optional <strong>Due time</strong>. Check <strong>No deadline</strong> if this list has no due date.</p>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="rpbdd-modal-foot">' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--blue" data-close-modal="modal-add-task">Cancel</button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--orange" id="rpbdd-tasks-add-line">Add line</button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green" id="rpbdd-tasks-submit">Publish list</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="rpbdd-modal-overlay" id="modal-edit-task">' +
        '<div class="rpbdd-modal rpbdd-modal--lg">' +
        '<div class="rpbdd-modal-head">' +
        '<h2>Edit task</h2>' +
        '<button type="button" class="rpbdd-modal-close" data-close-modal="modal-edit-task" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="rpbdd-modal-body">' +
        '<input type="hidden" id="rpbdd-tasks-edit-list-id" value="" />' +
        '<div class="rpbdd-tasks-compose-body">' +
        '<div class="rpbdd-tasks-compose-col rpbdd-tasks-compose-col--main">' +
        '<div class="rpbdd-tasks-field">' +
        '<label for="rpbdd-tasks-edit-title">List title</label>' +
        '<input type="text" id="rpbdd-tasks-edit-title" class="rpbdd-tasks-title-input" maxlength="500" placeholder="e.g. Weekly compliance review" />' +
        '</div>' +
        '<div class="rpbdd-tasks-field">' +
        '<label for="rpbdd-tasks-edit-creator-notes">Notes / remarks</label>' +
        '<textarea id="rpbdd-tasks-edit-creator-notes" class="rpbdd-tasks-notes-input" rows="3" maxlength="5000" placeholder="Optional — visible to the assignee"></textarea>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">You can also update notes after submit using <strong>Notes / remarks</strong> on the task card.</p>' +
        '</div>' +
        '<div class="rpbdd-tasks-field">' +
        '<label>Checklist items</label>' +
        '<div class="rpbdd-tasks-lines" id="rpbdd-tasks-edit-lines"></div>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Per line: uncheck <strong>Allow file</strong> if that step should not accept an upload.</p>' +
        '</div>' +
        '</div>' +
        '<div class="rpbdd-tasks-compose-col rpbdd-tasks-compose-col--side">' +
        '<div class="rpbdd-tasks-field">' +
        '<label>Send to</label>' +
        tasksSendToEditRadiosHtml(role) +
        '</div>' +
        '<div class="rpbdd-tasks-field" id="rpbdd-tasks-edit-recipient-block">' +
        '<label for="rpbdd-tasks-edit-recipient">Team &amp; person</label>' +
        '<select id="rpbdd-tasks-edit-recipient" class="rpbdd-tasks-recipient-select" aria-label="Pick a team and person, or everyone in role">' +
        tasksBuildRecipientOptions(tasksDefaultRecipientRoleForPortal(role), role) +
        '</select>' +
        '<p class="rpbdd-tasks-hint">' +
        addRecvHint +
        '</p>' +
        '</div>' +
        '<div class="rpbdd-tasks-field rpbdd-tasks-field--deadline">' +
        '<label>Deadline</label>' +
        '<label class="rpbdd-tasks-check-inline">' +
        '<input type="checkbox" id="rpbdd-tasks-edit-no-deadline" />' +
        '<span>No deadline</span>' +
        '</label>' +
        '<div class="rpbdd-tasks-deadline-wrap" id="rpbdd-tasks-edit-deadline-wrap" hidden>' +
        '<div class="rpbdd-tasks-deadline-split-row">' +
        '<div class="rpbdd-tasks-deadline-split-field">' +
        '<label class="rpbdd-tasks-deadline-sub" for="rpbdd-tasks-edit-deadline-date">Due date</label>' +
        '<input type="date" id="rpbdd-tasks-edit-deadline-date" class="rpbdd-tasks-date-input" disabled />' +
        '</div>' +
        '<div class="rpbdd-tasks-deadline-split-field">' +
        '<label class="rpbdd-tasks-deadline-sub" for="rpbdd-tasks-edit-deadline-time">Due time</label>' +
        '<input type="time" id="rpbdd-tasks-edit-deadline-time" class="rpbdd-tasks-date-input" value="23:59" disabled />' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight">Set <strong>Due date</strong> and optional <strong>Due time</strong>. Check <strong>No deadline</strong> if this list has no due date.</p>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="rpbdd-modal-foot">' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--blue" data-close-modal="modal-edit-task">Cancel</button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--orange" id="rpbdd-tasks-edit-add-line">Add line</button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green" id="rpbdd-tasks-edit-save">Save changes</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="rpbdd-modal-overlay" id="modal-task-creator-notes">' +
        '<div class="rpbdd-modal rpbdd-modal--lg">' +
        '<div class="rpbdd-modal-head">' +
        '<h2>Notes / remarks</h2>' +
        '<button type="button" class="rpbdd-modal-close" data-close-modal="modal-task-creator-notes" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="rpbdd-modal-body">' +
        '<input type="hidden" id="rpbdd-tasks-notes-modal-list-id" value="" />' +
        '<p class="rpbdd-tasks-hint rpbdd-tasks-hint--tight" style="margin-top:0">Shown on the task card for the assignee. Max 5000 characters.</p>' +
        '<textarea id="rpbdd-tasks-notes-modal-text" class="rpbdd-tasks-notes-input" rows="8" maxlength="5000" placeholder=""></textarea>' +
        '</div>' +
        '<div class="rpbdd-modal-foot">' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--blue" data-close-modal="modal-task-creator-notes">Cancel</button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-sm--green" id="rpbdd-tasks-notes-modal-save">Save notes</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    var viewRaw = String(state.tasksView || 'new').toLowerCase();
    var activeTasksView =
      viewRaw === 'done'
        ? 'done'
        : viewRaw === 'pending'
          ? 'pending'
          : viewRaw === 'review'
            ? 'review'
            : viewRaw === 'sent'
              ? 'sent'
              : 'new';
    var activeRows =
      activeTasksView === 'done'
        ? doneRows
        : activeTasksView === 'pending'
          ? pendingRows
          : activeTasksView === 'review'
            ? reviewRows
            : activeTasksView === 'sent'
              ? sentRows
              : newRows;
    var curPage =
      activeTasksView === 'done'
        ? state.tasksPageDone
        : activeTasksView === 'pending'
          ? state.tasksPagePending
          : activeTasksView === 'review'
            ? state.tasksPageReview
            : activeTasksView === 'sent'
              ? state.tasksPageSent
              : state.tasksPageNew;
    var totalPages = Math.max(1, Math.ceil(activeRows.length / TASKS_CARDS_PER_PAGE));
    if (curPage > totalPages) curPage = totalPages;
    if (curPage < 1) curPage = 1;
    if (activeTasksView === 'done') state.tasksPageDone = curPage;
    else if (activeTasksView === 'pending') state.tasksPagePending = curPage;
    else if (activeTasksView === 'review') state.tasksPageReview = curPage;
    else if (activeTasksView === 'sent') state.tasksPageSent = curPage;
    else state.tasksPageNew = curPage;
    var pageStart = (curPage - 1) * TASKS_CARDS_PER_PAGE;
    var pageSlice = activeRows.slice(pageStart, pageStart + TASKS_CARDS_PER_PAGE);
    var feedCards = '';
    pageSlice.forEach(function (L) {
      feedCards += tasksBuildTaskCardHtml(L, role);
    });

    var newEmpty =
      '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">' +
      (role === 'admin'
        ? 'No new tasks right now.'
        : 'No new tasks assigned to you right now.') +
      '</div>';
    var sentEmpty =
      '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">Nothing in Sent. After you submit a task, it appears here until the creator approves it.</div>';
    var pendingEmpty =
      '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">' +
      (role === 'admin'
        ? 'No overdue tasks right now.'
        : 'No overdue tasks assigned to you right now.') +
      '</div>';
    var doneEmpty =
      '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">No completed tasks yet.</div>';
    var reviewEmpty =
      '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">Nothing in review. Tasks appear here after an assignee submits.</div>';
    var feedBody = '';
    if (activeRows.length === 0) {
      feedBody =
        activeTasksView === 'done'
          ? doneEmpty
          : activeTasksView === 'pending'
            ? pendingEmpty
            : activeTasksView === 'review'
              ? reviewEmpty
              : activeTasksView === 'sent'
                ? sentEmpty
                : newEmpty;
    } else {
      feedBody = feedCards;
    }
    var pagHtml = '';
    if (totalPages > 1) {
      pagHtml = '<div class="rpbdd-tasks-pagination-wrap"><nav class="rpbdd-tasks-pagination" aria-label="Task pages">';
      for (var pg = 1; pg <= totalPages; pg++) {
        pagHtml +=
          '<button type="button" class="rpbdd-pill' +
          (pg === curPage ? ' is-active' : '') +
          '" data-tasks-panel-page="' +
          pg +
          '"' +
          (pg === curPage ? ' aria-current="page"' : '') +
          ' aria-label="Page ' +
          pg +
          ' of ' +
          totalPages +
          '">' +
          String(pg) +
          '</button>';
      }
      pagHtml += '</nav></div>';
    }
    var feed =
      '<div id="rpbdd-tasks-list" class="rpbdd-events-list-fill' +
      (activeTasksView === 'done' ? ' rpbdd-tasks-cards--compact' : '') +
      '">' +
      feedBody +
      '</div>' +
      pagHtml;

    var taskAttachmentPreviewModal =
      '<div class="rpbdd-modal-overlay" id="modal-task-attachment-preview" aria-hidden="true">' +
      '<div class="rpbdd-modal rpbdd-modal--lg rpbdd-modal--attachment-preview">' +
      '<div class="rpbdd-modal-head">' +
      '<h2 id="rpbdd-task-attachment-preview-title">File preview</h2>' +
      '<button type="button" class="rpbdd-modal-close" data-close-modal="modal-task-attachment-preview" aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="rpbdd-modal-body rpbdd-modal-body--attachment-preview">' +
      '<div id="rpbdd-task-attachment-preview-body"></div>' +
      '</div>' +
      '</div>' +
      '</div>';

    shell.innerHTML =
      createTaskTrigger +
      compose +
      taskAttachmentPreviewModal +
      '<div class="rpbdd-tasks-feed" id="rpbdd-tasks-feed">' +
      feed +
      '</div>';
    var cNew = document.getElementById('rpbdd-count-task-new');
    var cSent = document.getElementById('rpbdd-count-task-sent');
    var cPending = document.getElementById('rpbdd-count-task-pending');
    var cReview = document.getElementById('rpbdd-count-task-review');
    var cDone = document.getElementById('rpbdd-count-task-done');
    if (cNew) cNew.textContent = String(newCount);
    if (cSent) cSent.textContent = String(sentCount);
    if (cPending) cPending.textContent = String(pendingCount);
    if (cReview) cReview.textContent = String(reviewCount);
    if (cDone) cDone.textContent = String(doneCount);
    if (role === 'admin' || role === 'team_leader' || role === 'member' || role === 'user') {
      tasksSyncDeadlineWrap();
      tasksRefreshRecipientSelect();
      tasksSyncEditDeadlineWrap();
      tasksRefreshEditRecipientSelect();
    }
  }

  function reportsAvatarHtml(name, photo, fallbackBgHex) {
    var cleanName = String(name || '').trim();
    if (photo && String(photo).trim()) {
      return (
        '<span class="rpbdd-reports-card-avatar"><img src="' +
        escapeHtml(String(photo).trim()) +
        '" alt="' +
        escapeHtml(cleanName || 'Profile photo') +
        '"></span>'
      );
    }
    var initials = teamLeaderInitialsFromName(cleanName || 'U');
    var bg = String(fallbackBgHex || '').trim();
    var bgAttr = /^#[0-9a-fA-F]{6}$/.test(bg) ? ' style="background-color:' + escapeHtml(bg) + ';"' : '';
    return (
      '<span class="rpbdd-reports-card-avatar rpbdd-reports-card-avatar--fallback"' +
      bgAttr +
      '>' +
      escapeHtml(initials) +
      '</span>'
    );
  }

  function reportsDoneTaskListsCountForEmail(email) {
    var em = String(email || '')
      .trim()
      .toLowerCase();
    if (!em) return 0;
    var lists = Array.isArray(state.taskLists) ? state.taskLists : [];
    var n = 0;
    for (var i = 0; i < lists.length; i++) {
      var L = lists[i];
      if (!L) continue;
      if (tasksBucketForList(L) !== 'done') continue;
      var tgt = String(L.targetEmail || L.target_email || '')
        .trim()
        .toLowerCase();
      if (tgt === em) n += 1;
    }
    return n;
  }

  function reportsHexToRgb(hex) {
    var m = /^#([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function reportsRgbChannelClamp(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  function reportsRgbToHex(r, g, b) {
    return (
      '#' +
      reportsRgbChannelClamp(r).toString(16).padStart(2, '0') +
      reportsRgbChannelClamp(g).toString(16).padStart(2, '0') +
      reportsRgbChannelClamp(b).toString(16).padStart(2, '0')
    );
  }

  /** factor > 1 lightens, < 1 darkens. */
  function reportsShadeHex(hex, factor) {
    var rgb = reportsHexToRgb(hex);
    if (!rgb) return '#3B82F6';
    var f = Number(factor);
    if (!Number.isFinite(f) || f <= 0) f = 1;
    return reportsRgbToHex(rgb.r * f, rgb.g * f, rgb.b * f);
  }

  var reportCategoryDisplayModalPhotoClear = false;
  var reportCategoryDisplayModalPendingDataUrl = null;

  function loadReportCategoryDisplayMap() {
    try {
      var raw = localStorage.getItem(LS_REPORT_CATEGORY_DISPLAY);
      var j = raw ? JSON.parse(raw) : {};
      return j && typeof j === 'object' ? j : {};
    } catch (e) {
      return {};
    }
  }

  function saveReportCategoryDisplayMap(map) {
    try {
      localStorage.setItem(LS_REPORT_CATEGORY_DISPLAY, JSON.stringify(map || {}));
    } catch (err) {
      /* ignore quota */
    }
  }

  function getReportCategoryDisplayRecord(catKey) {
    var k = canonicalCategoryKey(catKey);
    if (!k) return { name: '', position: '', photo: '' };
    if (getEventsApiBase()) {
      var catRow = eventCategories.find(function (c) {
        return c && canonicalCategoryKey(c.name) === k;
      });
      if (!catRow) return { name: '', position: '', photo: '' };
      return {
        name: String(catRow.display_name != null ? catRow.display_name : ''),
        position: String(catRow.position != null ? catRow.position : ''),
        photo: String(catRow.photo != null ? catRow.photo : ''),
      };
    }
    var map = loadReportCategoryDisplayMap();
    var row = map[k];
    if (!row || typeof row !== 'object') return { name: '', position: '', photo: '' };
    return {
      name: String(row.name != null ? row.name : ''),
      position: String(row.position != null ? row.position : ''),
      photo: String(row.photo != null ? row.photo : ''),
    };
  }

  function setReportCategoryDisplayRecord(catKey, rec) {
    var k = canonicalCategoryKey(catKey);
    if (!k) return;
    var name = String(rec.name != null ? rec.name : '').trim();
    var position = String(rec.position != null ? rec.position : '').trim();
    var photo = String(rec.photo != null ? rec.photo : '').trim();
    if (getEventsApiBase()) {
      var idx = eventCategories.findIndex(function (c) {
        return c && canonicalCategoryKey(c.name) === k;
      });
      if (idx < 0) return;
      var c = eventCategories[idx];
      if (!name && !position && !photo) {
        eventCategories[idx] = {
          name: c.name,
          color: c.color,
          display_name: '',
          position: '',
          photo: '',
        };
      } else {
        eventCategories[idx] = {
          name: c.name,
          color: c.color,
          display_name: name,
          position: position,
          photo: photo,
        };
      }
      var mapApi = loadReportCategoryDisplayMap();
      if (!name && !position && !photo) delete mapApi[k];
      else mapApi[k] = { name: name, position: position, photo: photo };
      saveReportCategoryDisplayMap(mapApi);
      mirrorEventCategoriesToLocalStorage();
      persistEventCategoriesToApi();
      return;
    }
    var map = loadReportCategoryDisplayMap();
    if (!name && !position && !photo) {
      delete map[k];
    } else {
      map[k] = { name: name, position: position, photo: photo };
    }
    saveReportCategoryDisplayMap(map);
  }

  function reportCategoryAccentHexByName(catName) {
    var key = canonicalCategoryKey(catName);
    if (!key) return '#3B82F6';
    var cats = sortEventCategoriesDisplayOrder(Array.isArray(eventCategories) ? eventCategories : []);
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      if (!c || !c.name) continue;
      if (canonicalCategoryKey(c.name) !== key) continue;
      var col = String(c.color || '').trim();
      return /^#[0-9a-fA-F]{6}$/.test(col) ? col.toUpperCase() : '#3B82F6';
    }
    return '#3B82F6';
  }

  function openReportCategoryDisplayModal(catKey) {
    var k = canonicalCategoryKey(catKey);
    if (!k) return;
    reportCategoryDisplayModalPhotoClear = false;
    reportCategoryDisplayModalPendingDataUrl = null;
    var rec = getReportCategoryDisplayRecord(k);
    var hid = document.getElementById('rpbdd-report-cat-display-key');
    var secInp = document.getElementById('rpbdd-report-cat-display-section');
    var nameInp = document.getElementById('rpbdd-report-cat-display-name');
    var posInp = document.getElementById('rpbdd-report-cat-display-position');
    var fileEl = document.getElementById('rpbdd-report-cat-display-photo-file');
    var prev = document.getElementById('rpbdd-report-cat-display-photo-preview');
    if (hid) hid.value = k;
    if (secInp) secInp.value = k;
    if (nameInp) nameInp.value = rec.name ? rec.name : k;
    if (posInp) posInp.value = rec.position || '';
    if (fileEl) fileEl.value = '';
    if (prev) {
      prev.innerHTML = '';
      if (rec.photo) {
        var im = document.createElement('img');
        im.alt = '';
        im.src = rec.photo;
        prev.appendChild(im);
      } else {
        var ph = document.createElement('span');
        ph.className = 'rpbdd-report-cat-display-photo-placeholder';
        ph.textContent = 'No photo';
        prev.appendChild(ph);
      }
    }
    openModal('modal-report-category-display');
  }

  function commitReportCategoryDisplayModal() {
    var hid = document.getElementById('rpbdd-report-cat-display-key');
    var k = hid ? canonicalCategoryKey(hid.value) : '';
    if (!k) return;
    var nameInp = document.getElementById('rpbdd-report-cat-display-name');
    var posInp = document.getElementById('rpbdd-report-cat-display-position');
    var nameRaw = nameInp ? String(nameInp.value || '').trim() : '';
    var nameStored = nameRaw === '' || nameRaw === k ? '' : nameRaw;
    var position = posInp ? String(posInp.value || '').trim() : '';
    var existing = getReportCategoryDisplayRecord(k);
    var photo = existing.photo;
    if (reportCategoryDisplayModalPhotoClear) photo = '';
    else if (reportCategoryDisplayModalPendingDataUrl) photo = reportCategoryDisplayModalPendingDataUrl;
    setReportCategoryDisplayRecord(k, { name: nameStored, position: position, photo: photo });
    reportCategoryDisplayModalPhotoClear = false;
    reportCategoryDisplayModalPendingDataUrl = null;
    closeModal('modal-report-category-display');
    renderReportsPanel();
    syncOpenReportFolderModalFromDisplayRecord(k);
  }

  /** Category cards: keep legend color vars; shell texture is styled in CSS. */
  function reportsCategoryCardStyleAttr(hex) {
    var base = /^#[0-9a-fA-F]{6}$/.test(String(hex || '').trim()) ? String(hex).trim().toUpperCase() : '#3B82F6';
    var light = reportsShadeHex(base, 1.16);
    var mid = reportsShadeHex(base, 0.88);
    var deep = reportsShadeHex(base, 0.62);
    var rgb = reportsHexToRgb(base);
    var rgbStr = rgb ? rgb.r + ', ' + rgb.g + ', ' + rgb.b : '59, 130, 246';
    return (
      ' style="--rpbdd-report-cat:' +
      escapeHtml(base) +
      ';--rpbdd-report-cat-light:' +
      escapeHtml(light) +
      ';--rpbdd-report-cat-mid:' +
      escapeHtml(mid) +
      ';--rpbdd-report-cat-deep:' +
      escapeHtml(deep) +
      ';--rpbdd-report-cat-rgb:' +
      escapeHtml(rgbStr) +
      ';"'
    );
  }

  /** Same CSS vars as category card (for modal avatar wrapper; DOM-safe hex only). */
  function reportsCategoryCssVarsText(hex) {
    var base = /^#[0-9a-fA-F]{6}$/.test(String(hex || '').trim()) ? String(hex).trim().toUpperCase() : '#3B82F6';
    var light = reportsShadeHex(base, 1.16);
    var mid = reportsShadeHex(base, 0.88);
    var deep = reportsShadeHex(base, 0.62);
    var rgb = reportsHexToRgb(base);
    var rgbStr = rgb ? rgb.r + ', ' + rgb.g + ', ' + rgb.b : '59, 130, 246';
    return (
      '--rpbdd-report-cat:' +
      base +
      ';--rpbdd-report-cat-light:' +
      light +
      ';--rpbdd-report-cat-mid:' +
      mid +
      ';--rpbdd-report-cat-deep:' +
      deep +
      ';--rpbdd-report-cat-rgb:' +
      rgbStr +
      ';'
    );
  }

  function syncOpenReportFolderModalFromDisplayRecord(savedCatKey) {
    var k = canonicalCategoryKey(savedCatKey);
    if (!k) return;
    var mod = document.getElementById('modal-report-card-detail');
    if (!mod || !mod.classList.contains('rpbdd-report-card-modal--folder')) return;
    if (canonicalCategoryKey(state.reportFolderModalCatName) !== k) return;
    var catDisp = getReportCategoryDisplayRecord(k);
    var dispName = String(catDisp.name || '').trim() || k;
    var dispPos = String(catDisp.position || '').trim();
    var catHex = reportCategoryAccentHexByName(k);
    var t = document.getElementById('rpbdd-report-card-modal-title');
    var fpos = document.getElementById('rpbdd-report-card-modal-folder-position');
    var a = document.getElementById('rpbdd-report-card-modal-avatar');
    if (t) t.textContent = dispName || 'Report Details';
    if (fpos) fpos.textContent = dispPos || '—';
    mod.setAttribute('style', reportsCategoryCssVarsText(catHex));
    if (a) {
      a.innerHTML = reportsAvatarHtml(dispName, catDisp.photo || '', catHex);
      a.classList.add('is-clickable', 'rpbdd-report-card-modal-avatar--category');
      a.setAttribute('style', reportsCategoryCssVarsText(catHex));
      a.setAttribute('role', 'button');
      a.setAttribute('tabindex', '0');
      a.setAttribute('data-report-avatar-edit', k);
    }
  }

  function reportsCardHtml(cfg) {
    cfg = cfg || {};
    var reportKind = String(cfg.reportKind || 'person').toLowerCase();
    var isCategory = reportKind === 'category';
    var title = String(cfg.title || '—');
    var subtitle = String(cfg.subtitle || '—');
    var meta = String(cfg.meta || '—');
    var position = String(cfg.position != null ? cfg.position : cfg.roleLabel || '—').trim() || '—';
    var taskCount = parseInt(String(cfg.taskCount != null ? cfg.taskCount : 0), 10);
    if (!Number.isFinite(taskCount) || taskCount < 0) taskCount = 0;
    var upcomingCount = parseInt(String(cfg.upcomingCount != null ? cfg.upcomingCount : 0), 10);
    var doneCount = parseInt(String(cfg.doneCount != null ? cfg.doneCount : 0), 10);
    if (!Number.isFinite(upcomingCount) || upcomingCount < 0) upcomingCount = 0;
    if (!Number.isFinite(doneCount) || doneCount < 0) doneCount = 0;
    var tone = String(cfg.tone || 'section_chief');
    var toneClass = '';
    if (isCategory) {
      toneClass = 'rpbdd-reports-card--category';
    } else {
      toneClass =
      tone === 'access-admin'
        ? 'rpbdd-reports-card--access-admin'
        : tone === 'access-member'
          ? 'rpbdd-reports-card--access-member'
          : tone === 'access-section-chief'
            ? 'rpbdd-reports-card--access-section-chief'
            : tone === 'member'
              ? 'rpbdd-reports-card--access-member'
              : tone === 'my_own'
                ? 'rpbdd-reports-card--access-admin'
                : 'rpbdd-reports-card--access-section-chief';
    }
    var lbl = String(cfg.sectionLabel || 'Report');
    var roleLbl = String(cfg.roleLabel || 'Access');
    var cardKey = String(cfg.cardKey || '');
    var catKey = String(cfg.categoryKey || title || '').trim();
    var catHex = String(cfg.categoryAccent || '').trim();
    var catAccentData = '';
    if (isCategory) {
      catAccentData =
        ' data-report-category-accent="' +
        escapeHtml(
          /^#[0-9a-fA-F]{6}$/.test(catHex) ? String(catHex).trim().toUpperCase() : '#3B82F6'
        ) +
        '"';
    }
    var articleStyle = '';
    if (isCategory) {
      articleStyle = reportsCategoryCardStyleAttr(catHex);
    }
    var footArrowSvg =
      '<svg class="rpbdd-reports-card-foot-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h12"/><path d="M13 6l6 6-6 6"/></svg>';
    var headInner;
    if (isCategory) {
      headInner =
        '<div class="rpbdd-reports-card-head-row">' +
        '<div class="rpbdd-reports-card-head-main">' +
        '<span class="rpbdd-reports-card-kicker">' +
        escapeHtml(lbl) +
        '</span>' +
        '<div class="rpbdd-reports-card-head-text">' +
        '<h3 class="rpbdd-reports-card-title" title="' +
      escapeHtml(title) +
        '">' +
        escapeHtml(title) +
        '</h3>' +
        '<p class="rpbdd-reports-card-sub" title="' +
      escapeHtml(subtitle) +
        '">' +
        escapeHtml(subtitle) +
        '</p>' +
        '<p class="rpbdd-reports-card-meta" title="' +
      escapeHtml(meta) +
      '">' +
        escapeHtml(meta) +
        '</p>' +
        '</div>' +
        '</div>' +
        '<div class="rpbdd-reports-card-head-avatar-wrap">' +
        reportsAvatarHtml(cfg.avatarName || title, cfg.avatarPhoto || '') +
        '</div>' +
        '</div>';
    } else {
      headInner =
      '<span class="rpbdd-reports-card-kicker">' +
      escapeHtml(lbl) +
      '</span>' +
      '<div class="rpbdd-reports-card-head-text">' +
      '<h3 class="rpbdd-reports-card-title" title="' +
      escapeHtml(title) +
      '">' +
      escapeHtml(title) +
      '</h3>' +
      '<p class="rpbdd-reports-card-sub" title="' +
      escapeHtml(subtitle) +
      '">' +
      escapeHtml(subtitle) +
      '</p>' +
      '<p class="rpbdd-reports-card-meta" title="' +
      escapeHtml(meta) +
      '">' +
      escapeHtml(meta) +
      '</p>' +
      '</div>' +
        reportsAvatarHtml(cfg.avatarName || title, cfg.avatarPhoto || '');
    }
    var bodyHtml;
    if (isCategory) {
      bodyHtml =
        '<div class="rpbdd-reports-card-body">' +
        '<div class="rpbdd-reports-card-stat rpbdd-reports-card-stat--upcoming"><span>Upcoming Events</span><strong>' +
        '<span class="rpbdd-reports-card-task-badge rpbdd-reports-card-task-badge--upcoming" title="Events not yet done (same rules as Events tab)">' +
        escapeHtml(String(upcomingCount)) +
        '</span></strong></div>' +
        '<div class="rpbdd-reports-card-stat rpbdd-reports-card-stat--task"><span>Done Events</span><strong>' +
        '<span class="rpbdd-reports-card-task-badge" title="Past or completed events in this category">' +
        escapeHtml(String(doneCount)) +
        '</span></strong></div>' +
        '</div>';
    } else {
      bodyHtml =
      '<div class="rpbdd-reports-card-body">' +
      '<div class="rpbdd-reports-card-stat"><span>Position</span><strong title="' +
      escapeHtml(position) +
      '">' +
      escapeHtml(position) +
      '</strong></div>' +
      '<div class="rpbdd-reports-card-stat rpbdd-reports-card-stat--task"><span>Done Task</span><strong>' +
      '<span class="rpbdd-reports-card-task-badge" title="Completed (Done) task lists for this profile">' +
      escapeHtml(String(taskCount)) +
      '</span></strong></div>' +
        '</div>';
    }
    return (
      '<article class="rpbdd-reports-card ' +
      toneClass +
      '"' +
      articleStyle +
      ' role="button" tabindex="0" data-report-open="' +
      escapeHtml(cardKey) +
      '" data-report-kind="' +
      escapeHtml(isCategory ? 'category' : 'person') +
      '" data-report-title="' +
      escapeHtml(title) +
      '" data-report-subtitle="' +
      escapeHtml(subtitle) +
      '" data-report-meta="' +
      escapeHtml(meta) +
      '" data-report-role="' +
      escapeHtml(roleLbl) +
      '" data-report-position="' +
      escapeHtml(position) +
      '" data-report-task-count="' +
      escapeHtml(String(taskCount)) +
      '" data-report-section="' +
      escapeHtml(lbl) +
      '" data-report-email="' +
      escapeHtml(String(cfg.email || '')) +
      '" data-report-category-key="' +
      escapeHtml(isCategory ? catKey : '') +
      '"' +
      catAccentData +
      ' data-report-upcoming="' +
      escapeHtml(String(upcomingCount)) +
      '" data-report-done="' +
      escapeHtml(String(doneCount)) +
      '">' +
      '<div class="rpbdd-reports-card-accent"></div>' +
      '<div class="rpbdd-reports-card-head">' +
      headInner +
      '</div>' +
      bodyHtml +
      '<div class="rpbdd-reports-card-foot">' +
      '<span class="rpbdd-reports-card-foot-cta">' +
      '<span class="rpbdd-reports-card-foot-label">View details</span>' +
      footArrowSvg +
      '</span>' +
      '</div>' +
      '</article>'
    );
  }

  function reportDoneTasksForEmail(email) {
    var em = String(email || '')
      .trim()
      .toLowerCase();
    if (!em) return [];
    var lists = Array.isArray(state.taskLists) ? state.taskLists : [];
    return lists.filter(function (l) {
      if (!l) return false;
      if (tasksBucketForList(l) !== 'done') return false;
      var tgt = String(l.targetEmail || l.target_email || '')
        .trim()
        .toLowerCase();
      return !!tgt && tgt === em;
    });
  }

  function renderReportCardDoneTasks(email) {
    var host = document.getElementById('rpbdd-report-card-modal-done-tasks');
    if (!host) return;
    host.classList.remove('rpbdd-report-folder-events-as-cards');
    var rows = reportDoneTasksForEmail(email);
    if (!rows.length) {
      host.innerHTML = '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">No completed tasks found for this profile.</div>';
      return;
    }
    rows.sort(function (a, b) {
      var ad = new Date(String(a.creatorApprovedAt || a.createdAt || '')).getTime();
      var bd = new Date(String(b.creatorApprovedAt || b.createdAt || '')).getTime();
      return bd - ad;
    });
    host.innerHTML =
      '<div class="rpbdd-report-card-done-cards rpbdd-tasks-cards--compact">' +
      rows
        .slice(0, 25)
        .map(function (r) {
          return tasksBuildTaskCardHtml(r, currentUserRole());
        })
        .join('') +
      '</div>';
  }

  function resetReportCardModalPersonLabels() {
    state.reportFolderEventExpandedKey = null;
    state.reportFolderModalCatName = '';
    state.reportFolderModalView = 'up';
    var doneHost = document.getElementById('rpbdd-report-card-modal-done-tasks');
    if (doneHost) doneHost.classList.remove('rpbdd-report-folder-events-as-cards');
    var mod = document.getElementById('modal-report-card-detail');
    if (mod) {
      mod.classList.remove('rpbdd-report-card-modal--folder');
      mod.removeAttribute('style');
    }
    var fm = document.getElementById('rpbdd-report-card-modal-folder-meta');
    if (fm) fm.setAttribute('hidden', '');
    var grid = document.querySelector('#modal-report-card-detail .rpbdd-report-card-modal-grid');
    if (grid) {
      var items = grid.querySelectorAll('.rpbdd-report-card-modal-item');
      if (items[0]) {
        var l0 = items[0].querySelector('.rpbdd-report-card-modal-label');
        if (l0) l0.textContent = 'Position';
        var v0 = items[0].querySelector('.rpbdd-report-card-modal-value');
        if (v0) v0.textContent = '';
        items[0].classList.remove('rpbdd-report-folder-stat-switcher', 'is-active');
        items[0].removeAttribute('data-report-folder-view');
        items[0].removeAttribute('role');
        items[0].removeAttribute('tabindex');
      }
      if (items[1]) {
        var l1 = items[1].querySelector('.rpbdd-report-card-modal-label');
        if (l1) l1.textContent = 'Done tasks';
        var v1 = items[1].querySelector('.rpbdd-report-card-modal-value');
        if (v1) v1.textContent = '';
        items[1].classList.remove('rpbdd-report-folder-stat-switcher', 'is-active');
        items[1].removeAttribute('data-report-folder-view');
        items[1].removeAttribute('role');
        items[1].removeAttribute('tabindex');
      }
    }
    var taskHeading = document.querySelector('#modal-report-card-detail .rpbdd-report-card-modal-tasks > .rpbdd-report-card-modal-label');
    if (taskHeading) taskHeading.textContent = 'Completed Tasks (Done)';
  }

  function userEventsMatchingReportCategory(catName) {
    var key = canonicalCategoryKey(catName);
    return (Array.isArray(state.events) ? state.events : []).filter(function (e) {
      if (!e || e.isHoliday) return false;
      return canonicalCategoryKey(e.category) === key;
    });
  }

  function reportCategoryUpcomingDoneCounts(catName) {
    syncPastUserEventsToDone();
    var evs = userEventsMatchingReportCategory(catName);
    var up = [];
    var dn = [];
    for (var i = 0; i < evs.length; i++) {
      if (eventsPanelItemStatus(evs[i]) === 'done') dn.push(evs[i]);
      else up.push(evs[i]);
    }
    var upGroups = groupEventsByTitle(up);
    var dnGroups = groupEventsByTitle(dn);
    return { upcoming: Object.keys(upGroups).length, done: Object.keys(dnGroups).length };
  }

  function renderReportCategoryModalEvents(catName) {
    var host = document.getElementById('rpbdd-report-card-modal-done-tasks');
    if (!host) return;
    state.reportFolderModalCatName = String(catName || '').trim();
    var key = canonicalCategoryKey(catName);
    if (!key) {
      host.classList.remove('rpbdd-report-folder-events-as-cards');
      host.innerHTML = '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">No category selected.</div>';
      return;
    }
    var evs = userEventsMatchingReportCategory(key);
    if (!evs.length) {
      host.classList.remove('rpbdd-report-folder-events-as-cards');
      host.innerHTML = '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">No events in this category yet.</div>';
      return;
    }
    host.classList.add('rpbdd-report-folder-events-as-cards');
    var up = [];
    var dn = [];
    evs.forEach(function (e) {
      if (eventsPanelItemStatus(e) === 'done') dn.push(e);
      else up.push(e);
    });
    function cmp(a, b) {
      var da = normalizeEventDateYmd(a.date) || '';
      var db = normalizeEventDateYmd(b.date) || '';
      return da.localeCompare(db);
    }
    up.sort(cmp);
    dn.sort(cmp);
    var upCount = Object.keys(groupEventsByTitle(up)).length;
    var dnCount = Object.keys(groupEventsByTitle(dn)).length;
    function titlesSorted(groups) {
      return Object.keys(groups).sort(function (a, b) {
        var da = minIsoYmdInList(groups[a]);
        var db = minIsoYmdInList(groups[b]);
        return da.localeCompare(db) || a.localeCompare(b);
      });
    }
    function sectionHtml(bucket, list, active) {
      if (!list.length) {
        return (
          '<div class="rpbdd-report-category-ev-block"' +
          (active ? '' : ' hidden') +
          ' data-report-folder-panel="' +
          escapeHtml(bucket) +
          '">' +
          '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">No ' +
          (bucket === 'up' ? 'upcoming' : 'done') +
          ' events in this category.</div></div>'
        );
      }
      var groups = groupEventsByTitle(list);
      var titles = titlesSorted(groups);
      var inner = '';
      titles.forEach(function (gk) {
        var grp = groups[gk];
        var expKey = bucket + ':' + gk;
        var expanded = state.reportFolderEventExpandedKey === expKey;
        inner += eventCardHtmlFromTitleGroup(grp, expanded, false, {
          expandAttr: 'data-report-folder-expand',
          expandVal: encodeURIComponent(expKey),
        });
      });
      return (
        '<div class="rpbdd-report-category-ev-block"' +
        (active ? '' : ' hidden') +
        ' data-report-folder-panel="' +
        escapeHtml(bucket) +
        '">' +
        '<div class="rpbdd-report-folder-ev-cards">' +
        inner +
        '</div></div>'
      );
    }
    if (state.reportFolderModalView !== 'up' && state.reportFolderModalView !== 'dn') {
      state.reportFolderModalView = 'up';
    }
    var upActive = state.reportFolderModalView === 'up';
    var dnActive = state.reportFolderModalView === 'dn';
    var html = sectionHtml('up', up, upActive) + sectionHtml('dn', dn, dnActive);
    host.innerHTML = html || '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">No events.</div>';
    syncReportFolderModalStatSwitchers(upCount, dnCount);
    applyReportFolderModalPanelsVisibility();
    host.querySelectorAll('[data-report-folder-expand]').forEach(function (node) {
      node.addEventListener('click', function () {
        var k = decodeURIComponent(node.getAttribute('data-report-folder-expand') || '');
        state.reportFolderEventExpandedKey = state.reportFolderEventExpandedKey === k ? null : k;
        renderReportCategoryModalEvents(state.reportFolderModalCatName);
      });
    });
  }

  function applyReportFolderModalPanelsVisibility() {
    var host = document.getElementById('rpbdd-report-card-modal-done-tasks');
    if (!host) return;
    host.querySelectorAll('[data-report-folder-panel]').forEach(function (panel) {
      var v = String(panel.getAttribute('data-report-folder-panel') || 'up').toLowerCase() === 'dn' ? 'dn' : 'up';
      if (v === state.reportFolderModalView) panel.removeAttribute('hidden');
      else panel.setAttribute('hidden', '');
    });
  }

  function syncReportFolderModalStatSwitchers(upCount, dnCount) {
    var mod = document.getElementById('modal-report-card-detail');
    if (!mod || !mod.classList.contains('rpbdd-report-card-modal--folder')) return;
    var nodes = mod.querySelectorAll('.rpbdd-report-folder-stat-switcher[data-report-folder-view]');
    nodes.forEach(function (node) {
      var view = String(node.getAttribute('data-report-folder-view') || 'up').toLowerCase() === 'dn' ? 'dn' : 'up';
      node.classList.toggle('is-active', state.reportFolderModalView === view);
      node.setAttribute('aria-pressed', state.reportFolderModalView === view ? 'true' : 'false');
      node.onclick = function () {
        state.reportFolderModalView = view;
        state.reportFolderEventExpandedKey = null;
        renderReportCategoryModalEvents(state.reportFolderModalCatName);
      };
      node.onkeydown = function (e) {
        if (!e) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        state.reportFolderModalView = view;
        state.reportFolderEventExpandedKey = null;
        renderReportCategoryModalEvents(state.reportFolderModalCatName);
      };
    });
    var grid = mod.querySelector('.rpbdd-report-card-modal-grid');
    if (grid) {
      grid.setAttribute('data-report-folder-up-count', String(upCount || 0));
      grid.setAttribute('data-report-folder-dn-count', String(dnCount || 0));
    }
  }

  var reportFolderModalKeyNavBound = false;
  function bindReportFolderModalKeyboardNav() {
    if (reportFolderModalKeyNavBound) return;
    reportFolderModalKeyNavBound = true;
    document.addEventListener('keydown', function (e) {
      if (!e || e.defaultPrevented) return;
      var k = e.key || '';
      if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
      var mod = document.getElementById('modal-report-card-detail');
      if (!mod || !mod.classList.contains('is-open')) return;
      if (!mod.classList.contains('rpbdd-report-card-modal--folder')) return;
      var tag = e.target && e.target.tagName ? String(e.target.tagName).toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      var cat = String(state.reportFolderModalCatName || '').trim();
      if (!cat) return;
      e.preventDefault();
      var next = state.reportFolderModalView === 'dn' ? 'up' : 'dn';
      if (k === 'ArrowRight') next = state.reportFolderModalView === 'up' ? 'dn' : 'up';
      if (k === 'Home') next = 'up';
      if (k === 'End') next = 'dn';
      state.reportFolderModalView = next === 'dn' ? 'dn' : 'up';
      state.reportFolderEventExpandedKey = null;
      renderReportCategoryModalEvents(cat);
    });
  }

  function openReportCardModalFromNode(node) {
    if (!node) return;
    var kind = String(node.getAttribute('data-report-kind') || 'person').toLowerCase();
    var title = String(node.getAttribute('data-report-title') || 'Report Details');
    var subtitle = String(node.getAttribute('data-report-subtitle') || '—');
    var section = String(node.getAttribute('data-report-section') || 'Report');
    var role = String(node.getAttribute('data-report-role') || '—');
    var position = String(node.getAttribute('data-report-position') || '').trim();
    if (!position) position = role;
    var taskCountDisp = String(node.getAttribute('data-report-task-count') || '0').trim() || '0';
    var email = String(node.getAttribute('data-report-email') || '').trim();
    var avatarNode = node.querySelector('.rpbdd-reports-card-avatar');
    var avatarHtml = avatarNode ? avatarNode.outerHTML : '—';
    var t = document.getElementById('rpbdd-report-card-modal-title');
    var sec = document.getElementById('rpbdd-report-card-modal-section');
    var n = document.getElementById('rpbdd-report-card-modal-name');
    var tm = document.getElementById('rpbdd-report-card-modal-team');
    var r = document.getElementById('rpbdd-report-card-modal-role');
    var m = document.getElementById('rpbdd-report-card-modal-meta');
    var a = document.getElementById('rpbdd-report-card-modal-avatar');

    if (kind === 'category') {
      var catKey = String(node.getAttribute('data-report-category-key') || '').trim();
      var upDisp = String(node.getAttribute('data-report-upcoming') || '0').trim() || '0';
      var dnDisp = String(node.getAttribute('data-report-done') || '0').trim() || '0';
      var catDisp = getReportCategoryDisplayRecord(catKey || title);
      var dispName = String(catDisp.name || '').trim() || String(title || catKey || 'Category');
      var dispPos = String(catDisp.position || '').trim();
      state.reportModalEmail = '';
      var catHexModal = String(node.getAttribute('data-report-category-accent') || '').trim();
      var mod = document.getElementById('modal-report-card-detail');
      if (mod) {
        mod.classList.add('rpbdd-report-card-modal--folder');
        mod.setAttribute('style', reportsCategoryCssVarsText(catHexModal));
      }
      var fm = document.getElementById('rpbdd-report-card-modal-folder-meta');
      var fsec = document.getElementById('rpbdd-report-card-modal-folder-section');
      var fpos = document.getElementById('rpbdd-report-card-modal-folder-position');
      if (fm) fm.removeAttribute('hidden');
      if (fsec) fsec.textContent = catKey || title || '—';
      if (fpos) fpos.textContent = dispPos || '—';
      if (t) t.textContent = dispName || 'Report Details';
      if (sec) {
        sec.textContent = '';
        sec.className = 'rpbdd-report-card-modal-kicker rpbdd-report-card-modal-kicker--section-chief';
      }
      if (n) n.textContent = '';
      if (tm) tm.textContent = '';
      var grid = document.querySelector('#modal-report-card-detail .rpbdd-report-card-modal-grid');
      if (grid) {
        var items = grid.querySelectorAll('.rpbdd-report-card-modal-item');
        if (items[0]) {
          var l0 = items[0].querySelector('.rpbdd-report-card-modal-label');
          var v0 = items[0].querySelector('.rpbdd-report-card-modal-value');
          if (l0) l0.textContent = 'Upcoming Events';
          if (v0) {
            v0.innerHTML =
              '<span class="rpbdd-reports-card-task-badge rpbdd-reports-card-task-badge--upcoming" title="Events not yet done (same rules as Events tab)">' +
              escapeHtml(upDisp) +
              '</span>';
          }
          items[0].setAttribute('role', 'button');
          items[0].setAttribute('tabindex', '0');
          items[0].setAttribute('data-report-folder-view', 'up');
          items[0].classList.add('rpbdd-report-folder-stat-switcher');
        }
        if (items[1]) {
          var l1 = items[1].querySelector('.rpbdd-report-card-modal-label');
          var v1 = items[1].querySelector('.rpbdd-report-card-modal-value');
          if (l1) l1.textContent = 'Done Events';
          if (v1) {
            v1.innerHTML =
              '<span class="rpbdd-reports-card-task-badge" title="Past or completed events in this category">' +
              escapeHtml(dnDisp) +
              '</span>';
          }
          items[1].setAttribute('role', 'button');
          items[1].setAttribute('tabindex', '0');
          items[1].setAttribute('data-report-folder-view', 'dn');
          items[1].classList.add('rpbdd-report-folder-stat-switcher');
        }
      }
      if (a) {
        a.innerHTML = avatarHtml;
        a.classList.add('is-clickable', 'rpbdd-report-card-modal-avatar--category');
        a.setAttribute('style', reportsCategoryCssVarsText(catHexModal));
        a.setAttribute('role', 'button');
        a.setAttribute('tabindex', '0');
        a.setAttribute('data-report-avatar-edit', catKey || title || '');
      }
      var taskHeading = document.querySelector('#modal-report-card-detail .rpbdd-report-card-modal-tasks > .rpbdd-report-card-modal-label');
      if (taskHeading) taskHeading.textContent = 'Events in this category';
      state.reportFolderEventExpandedKey = null;
      openModal('modal-report-card-detail');
      syncReportFolderModalStatSwitchers(parseInt(upDisp, 10) || 0, parseInt(dnDisp, 10) || 0);
      renderReportCategoryModalEvents(catKey || title);
      return;
    }

    resetReportCardModalPersonLabels();
    state.reportModalEmail = email.toLowerCase();
    if (t) t.textContent = title || 'Report Details';
    if (sec) {
      sec.textContent = section || 'Report';
      var kickerTone = 'rpbdd-report-card-modal-kicker--section-chief';
      if (node.classList.contains('rpbdd-reports-card--access-admin')) {
        kickerTone = 'rpbdd-report-card-modal-kicker--admin';
      } else if (node.classList.contains('rpbdd-reports-card--access-member')) {
        kickerTone = 'rpbdd-report-card-modal-kicker--member';
      }
      sec.className = 'rpbdd-report-card-modal-kicker ' + kickerTone;
    }
    if (n) n.textContent = subtitle || '—';
    if (tm) tm.textContent = title || '—';
    if (r) r.textContent = position || '—';
    if (m) m.textContent = taskCountDisp;
    if (a) {
      a.innerHTML = avatarHtml;
      a.classList.remove('is-clickable', 'rpbdd-report-card-modal-avatar--category');
      a.removeAttribute('style');
      a.removeAttribute('role');
      a.removeAttribute('tabindex');
      a.removeAttribute('data-report-avatar-edit');
    }
    openModal('modal-report-card-detail');
    var doneHost = document.getElementById('rpbdd-report-card-modal-done-tasks');
    if (doneHost) doneHost.textContent = 'Loading...';
    var done = function () {
      renderReportCardDoneTasks(email);
    };
    if (Array.isArray(state.taskLists) && state.taskLists.length) {
      done();
    } else {
      fetchTaskListsFromApi().then(function () {
        done();
      });
    }
  }

  function renderReportsPanel() {
    var listEl = document.getElementById('rpbdd-reports-list');
    if (!listEl) return;
    var cats = sortEventCategoriesDisplayOrder(Array.isArray(eventCategories) ? eventCategories : []);
    if (!cats.length) {
        listEl.innerHTML =
        '<div class="rpbdd-tasks-msg rpbdd-tasks-msg--empty">No calendar categories yet. Add categories from the calendar (event form / legend) so they appear here.</div>';
        return;
      }
    var html = '<div class="rpbdd-reports-grid">';
    cats.forEach(function (cat) {
      if (!cat || !cat.name) return;
      var name = String(cat.name).trim();
      if (!name) return;
      var col = String(cat.color || '').trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(col)) col = '#3B82F6';
      var cnt = reportCategoryUpcomingDoneCounts(name);
      var disp = getReportCategoryDisplayRecord(name);
      var displayName = disp.name ? String(disp.name).trim() : name;
      var displayPhoto = disp.photo ? String(disp.photo).trim() : '';
      var displayPosition = disp.position ? String(disp.position).trim() : '';
      var metaCounts = 'Upcoming: ' + cnt.upcoming + ' · Done: ' + cnt.done;
      html += reportsCardHtml({
        reportKind: 'category',
        title: displayName,
        subtitle: displayPosition || '—',
        meta: metaCounts,
        sectionLabel: name,
        roleLabel: 'Events',
        position: name,
        taskCount: 0,
        categoryKey: name,
        categoryAccent: col,
        upcomingCount: cnt.upcoming,
        doneCount: cnt.done,
        cardKey: 'category:' + name,
        avatarName: displayName,
        avatarPhoto: displayPhoto,
      });
    });
    html += '</div>';
    listEl.innerHTML = html;
  }

  function bind() {
    bindTeamCustomDropdowns();
    bindMemberCustomDropdowns();

    document.getElementById('rpbdd-theme-toggle')?.addEventListener('click', function () {
      var cur = normalizeDashboardTheme(document.documentElement.getAttribute('data-rpbdd-theme'));
      applyTheme(cur === 'light' ? 'night' : 'light', { persistShared: true });
    });

    document.getElementById('rpbdd-sidebar-toggle')?.addEventListener('click', function () {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      applySidebarCollapsedFromState();
      if (getEventsApiBase()) {
        persistSharedSidebarCollapsedToApi(state.sidebarCollapsed).catch(function () {});
      }
    });

    document.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setNav(btn.getAttribute('data-nav'));
      });
    });

    document.getElementById('rpbdd-btn-prev-month')?.addEventListener('click', function () {
      var d = state.currentDate;
      state.currentDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      state.sidebarSelectedYmd = null;
      syncBirthdayModalMonthToCalendarIfOpen();
      render();
    });
    document.getElementById('rpbdd-btn-next-month')?.addEventListener('click', function () {
      var d = state.currentDate;
      state.currentDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      state.sidebarSelectedYmd = null;
      syncBirthdayModalMonthToCalendarIfOpen();
      render();
    });

    document.getElementById('rpbdd-cal-grid-wrap')?.addEventListener('click', function (ev) {
      var dayCell = ev.target.closest('.rpbdd-cal-cell[data-day]');
      if (dayCell) {
        var day = parseInt(dayCell.getAttribute('data-day'), 10);
        if (!day) return;
        var y = state.currentDate.getFullYear();
        var m = state.currentDate.getMonth();
        state.sidebarSelectedYmd = ymd(y, m, day);
        render();
        return;
      }
      state.sidebarSelectedYmd = null;
      render();
    });

    document.getElementById('rpbdd-view-all-events')?.addEventListener('click', function () {
      var d = state.currentDate;
      state.eventsPanelDate = new Date(d.getFullYear(), d.getMonth(), 1);
      state.expandedEventGroupKey = null;
      state.eventsPanelPage = 1;
      setNav('events');
    });

    document.getElementById('rpbdd-events-prev-month')?.addEventListener('click', function () {
      var d = state.eventsPanelDate;
      state.eventsPanelDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      state.expandedEventGroupKey = null;
      state.eventsPanelPage = 1;
      render();
    });
    document.getElementById('rpbdd-events-next-month')?.addEventListener('click', function () {
      var d = state.eventsPanelDate;
      state.eventsPanelDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      state.expandedEventGroupKey = null;
      state.eventsPanelPage = 1;
      render();
    });

    document.getElementById('rpbdd-open-notifications')?.addEventListener('click', function () {
      state.birthdayModalView = 'upcoming';
      state.expandedBirthdayId = null;
      var d = state.eventsPanelDate || state.currentDate;
      state.birthdayModalPanelDate = new Date(d.getFullYear(), d.getMonth(), 1);
      renderNotificationsModal();
      openModal('modal-notifications');
    });
    document.getElementById('rpbdd-bday-modal-prev-month')?.addEventListener('click', function () {
      var d = state.birthdayModalPanelDate;
      state.birthdayModalPanelDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      state.expandedBirthdayId = null;
        renderNotificationsModal();
      });
    document.getElementById('rpbdd-bday-modal-next-month')?.addEventListener('click', function () {
      var d = state.birthdayModalPanelDate;
      state.birthdayModalPanelDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      state.expandedBirthdayId = null;
      renderNotificationsModal();
    });
    document.querySelectorAll('[data-birthday-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = String(btn.getAttribute('data-birthday-view') || 'upcoming').trim().toLowerCase();
        state.birthdayModalView = v === 'done' ? 'done' : 'upcoming';
        renderNotificationsModal();
      });
    });
    document.getElementById('rpbdd-bday-search')?.addEventListener('input', function () {
        renderNotificationsModal();
    });
    document.getElementById('rpbdd-open-add-birthday')?.addEventListener('click', function () {
      resetAddBirthdayForm();
      var rawBirthdayPos = [];
      var rawBirthdaySec = [];
      try {
        rawBirthdayPos = JSON.parse(localStorage.getItem(LS_BIRTHDAY_POSITIONS) || '[]');
        rawBirthdaySec = JSON.parse(localStorage.getItem(LS_BIRTHDAY_SECTIONS) || '[]');
      } catch (e) {
        rawBirthdayPos = [];
        rawBirthdaySec = [];
      }
      state.birthdayPositions = normalizeBirthdayPositionsFromStorage(Array.isArray(rawBirthdayPos) ? rawBirthdayPos : []);
      state.birthdaySections =
        Array.isArray(rawBirthdaySec) && rawBirthdaySec.length ? rawBirthdaySec : defaultBirthdaySectionsFromLegend();
      renderBirthdaySelectOptions();
      refreshBirthdayOptionsFromApi().catch(function () {});
      openModal('modal-add-birthday');
    });
    document.getElementById('birthday-position-trigger')?.addEventListener('click', function () {
      toggleBirthdayDropdownMenu('position');
    });
    document.getElementById('birthday-section-trigger')?.addEventListener('click', function () {
      toggleBirthdayDropdownMenu('section');
    });
    document.addEventListener('click', function (e) {
      var pTr = document.getElementById('birthday-position-trigger');
      var pMn = document.getElementById('birthday-position-menu');
      var sTr = document.getElementById('birthday-section-trigger');
      var sMn = document.getElementById('birthday-section-menu');
      var inPos = pTr && pTr.contains(e.target);
      var inPosMenu = pMn && pMn.contains(e.target);
      var inSec = sTr && sTr.contains(e.target);
      var inSecMenu = sMn && sMn.contains(e.target);
      if (!inPos && !inPosMenu && !inSec && !inSecMenu) closeBirthdayDropdownMenus();
    });
    document.getElementById('rpbdd-add-birthday-position')?.addEventListener('click', function () {
      openBirthdayOptionModal('position');
    });
    document.getElementById('rpbdd-add-birthday-section')?.addEventListener('click', function () {
      openBirthdayOptionModal('section');
    });
    document.getElementById('rpbdd-save-birthday-option')?.addEventListener('click', function () {
      var kindEl = document.getElementById('rpbdd-birthday-option-kind');
      var valueEl = document.getElementById('rpbdd-birthday-option-value');
      var saveBtn = document.getElementById('rpbdd-save-birthday-option');
      var kind = String((kindEl && kindEl.value) || '').trim().toLowerCase() === 'section' ? 'section' : 'position';
      var val = String((valueEl && valueEl.value) || '').trim();
      var mode = String((saveBtn && saveBtn.dataset && saveBtn.dataset.mode) || 'add').trim().toLowerCase();
      var oldVal = String((saveBtn && saveBtn.dataset && saveBtn.dataset.oldValue) || '').trim();
      if (!val) {
        rpbddAlertMessage('Please enter a value');
        return;
      }
      if (mode === 'edit' && oldVal) {
        if (birthdayOptionExists(kind, val, oldVal)) {
          rpbddAlertMessage('That value already exists.');
          return;
        }
        if (!updateBirthdayOptionValue(kind, oldVal, val)) {
          rpbddAlertMessage('Could not update option.');
          return;
        }
        var baseUpd = getBirthdaysApiBase();
        if (baseUpd) {
          fetch(baseUpd + '/options/update', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: kind, old_value: oldVal, value: val }),
          })
            .then(parseEventsApiResponse)
            .then(function (parsed) {
              var j = parsed.data;
              if (!j || !j.ok) rpbddAlertMessage(formatEventsApiError(parsed));
            })
            .catch(function () {
              rpbddAlertMessage('Network error — could not update option on server');
            });
        }
      } else {
        if (birthdayOptionExists(kind, val, '')) {
          rpbddAlertMessage('That value already exists.');
          return;
        }
        if (kind === 'position') state.birthdayPositions.push(val);
        else state.birthdaySections.push(val);
        saveBirthdayDropdowns();
        var baseAdd = getBirthdaysApiBase();
        if (baseAdd) {
          fetch(baseAdd + '/options', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: kind, value: val }),
          })
            .then(parseEventsApiResponse)
            .then(function (parsed) {
              var j = parsed.data;
              if (!j || !j.ok) rpbddAlertMessage(formatEventsApiError(parsed));
            })
            .catch(function () {
              rpbddAlertMessage('Network error — could not save option on server');
            });
        }
      }
      renderBirthdaySelectOptions();
      setBirthdayDropdownValue(kind, val);
      closeModal('modal-add-birthday-option');
    });
    document.getElementById('birthday-photo')?.addEventListener('change', function (e) {
      var file = e.target && e.target.files && e.target.files[0] ? e.target.files[0] : null;
      var name = String((document.getElementById('birthday-name') && document.getElementById('birthday-name').value) || '').trim();
      if (!file) {
        renderBirthdayPhotoAvatar('', name);
        return;
      }
      var rd = new FileReader();
      rd.onload = function () {
        renderBirthdayPhotoAvatar(String(rd.result || ''), name);
      };
      rd.onerror = function () {
        rpbddAlertMessage('Could not read photo file');
      };
      rd.readAsDataURL(file);
    });
    document.getElementById('birthday-name')?.addEventListener('input', function () {
      var prev = document.getElementById('birthday-photo-preview');
      var src = prev && prev.src ? String(prev.src) : '';
      renderBirthdayPhotoAvatar(src, this.value || '');
    });
    document.getElementById('birthday-photo-remove')?.addEventListener('click', function () {
      var photoEl = document.getElementById('birthday-photo');
      if (photoEl) photoEl.value = '';
      var name = String((document.getElementById('birthday-name') && document.getElementById('birthday-name').value) || '').trim();
      renderBirthdayPhotoAvatar('', name);
    });
    document.getElementById('rpbdd-save-add-birthday')?.addEventListener('click', function () {
      var nameEl = document.getElementById('birthday-name');
      var posEl = document.getElementById('birthday-position');
      var secEl = document.getElementById('birthday-section');
      var dobEl = document.getElementById('birthday-dob');
      var photoEl = document.getElementById('birthday-photo');
      var name = String((nameEl && nameEl.value) || '').trim();
      var position = String((posEl && posEl.value) || '').trim();
      var section = String((secEl && secEl.value) || '').trim();
      var dob = normalizeBirthdayYmd((dobEl && dobEl.value) || '');
      if (!name || !position || !section || !dob) {
        rpbddAlertMessage('Please fill Photo (optional), Name, Position, Section, and Date of Birth');
        return;
      }
      var finishSave = function (photoData) {
        var photoOut = String(photoData || '').trim();
        var base = getBirthdaysApiBase();
        if (base) {
          var body = {
            name: name,
            position: position,
            section: section,
            dob: dob,
            photo: photoOut,
          };
          var url = state.editingBirthdayId
            ? base + '/' + encodeURIComponent(String(state.editingBirthdayId)) + '/update'
            : base;
          fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
            .then(parseEventsApiResponse)
            .then(function (parsed) {
              var j = parsed.data;
              if (!j || !j.ok) {
                rpbddAlertMessage(formatEventsApiError(parsed));
                return;
              }
              refreshBirthdaysFromApi().then(function () {
                closeModal('modal-add-birthday');
                renderNotificationsModal();
                render();
              });
            })
            .catch(function () {
              rpbddAlertMessage('Network error — could not reach the server');
            });
          return;
        }
        if (state.editingBirthdayId) {
          state.birthdayCelebrants = (state.birthdayCelebrants || []).map(function (x) {
            if (String(x.id || '') !== String(state.editingBirthdayId || '')) return x;
            return {
              id: x.id,
              name: name,
              position: position,
              section: section,
              dob: dob,
              photo: photoOut || String(x.photo || ''),
              createdAt: x.createdAt || new Date().toISOString(),
            };
          });
        } else {
          state.birthdayCelebrants.push({
            id: 'bday-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
            name: name,
            position: position,
            section: section,
            dob: dob,
            photo: photoOut,
            createdAt: new Date().toISOString(),
          });
        }
        saveBirthdayCelebrants();
        closeModal('modal-add-birthday');
        renderNotificationsModal();
        render();
      };
      var file = photoEl && photoEl.files && photoEl.files[0] ? photoEl.files[0] : null;
      if (!file) {
        var prev = document.getElementById('birthday-photo-preview');
        var keepSrc = prev && prev.src ? String(prev.src) : '';
        finishSave(keepSrc || '');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        finishSave(String(reader.result || ''));
      };
      reader.onerror = function () {
        rpbddAlertMessage('Could not read photo file');
      };
      reader.readAsDataURL(file);
    });
    document.getElementById('rpbdd-open-account')?.addEventListener('click', function () {
      if (currentUserRole() === 'admin') {
        openAdminAccountModal();
        return;
      }
      if (currentUserRole() === 'team_leader') {
        openTeamLeaderAccountModal();
        return;
      }
      if (currentUserRole() === 'member') {
        openMemberAccountModal();
        return;
      }
      setAccountModalDefaultLayout();
      openModal('modal-account');
    });

    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeModal(btn.getAttribute('data-close-modal'));
      });
    });
    bindReportFolderModalKeyboardNav();

    document.getElementById('rpbdd-open-add-event')?.addEventListener('click', function () {
      state.eventDates = [''];
      document.getElementById('add-title').value = '';
      document.getElementById('add-description').value = '';
      document.getElementById('add-location').value = '';
      document.getElementById('add-time').value = '';
      renderCategoryDropdowns('', '');
      toggleAddCategoryDropdown(false);
      renderDateRows();
      syncAddEventInputByField();
      openModal('modal-add-event');
    });
    document.getElementById('add-category')?.addEventListener('change', handleAddCategorySelectChange);
    document.getElementById('edit-category')?.addEventListener('change', handleEditCategorySelectChange);
    document.getElementById('rpbdd-category-dropdown-trigger')?.addEventListener('click', function () {
      var menu = document.getElementById('rpbdd-category-dropdown-menu');
      var isOpen = !!menu && menu.style.display === 'block';
      toggleAddCategoryDropdown(!isOpen);
    });
    document.getElementById('rpbdd-edit-category-dropdown-trigger')?.addEventListener('click', function () {
      var menu = document.getElementById('rpbdd-edit-category-dropdown-menu');
      var isOpen = !!menu && menu.style.display === 'block';
      toggleEditCategoryDropdown(!isOpen);
    });
    document.addEventListener('click', function (e) {
      var trigger = document.getElementById('rpbdd-category-dropdown-trigger');
      var menu = document.getElementById('rpbdd-category-dropdown-menu');
      var triggerEdit = document.getElementById('rpbdd-edit-category-dropdown-trigger');
      var menuEdit = document.getElementById('rpbdd-edit-category-dropdown-menu');
      var keepAddOpen = !!trigger && !!menu && (trigger.contains(e.target) || menu.contains(e.target));
      var keepEditOpen =
        !!triggerEdit && !!menuEdit && (triggerEdit.contains(e.target) || menuEdit.contains(e.target));
      if (!keepAddOpen) toggleAddCategoryDropdown(false);
      if (!keepEditOpen) toggleEditCategoryDropdown(false);
    });
    document.getElementById('rpbdd-category-editor-save')?.addEventListener('click', saveCategoryEditorAction);
    document.getElementById('rpbdd-category-editor-input')?.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      saveCategoryEditorAction();
    });
    document.getElementById('rpbdd-category-editor-input')?.addEventListener('input', updateCategoryEditorPreview);
    document.getElementById('rpbdd-category-editor-color')?.addEventListener('input', updateCategoryEditorPreview);
    document.getElementById('rpbdd-category-edit-select')?.addEventListener('change', function () {
      renderCategoryEditOptions(document.getElementById('rpbdd-category-edit-select').value);
      updateCategoryEditPreview();
    });
    document.getElementById('rpbdd-category-edit-color')?.addEventListener('input', updateCategoryEditPreview);

    document.getElementById('rpbdd-add-date-row')?.addEventListener('click', function () {
      state.eventDates.push('');
      renderDateRows();
    });
    document.getElementById('rpbdd-edit-add-date-row')?.addEventListener('click', function () {
      state.editEventDates.push('');
      renderEditEventDateRows();
    });

    document.getElementById('rpbdd-save-add-event')?.addEventListener('click', function () {
      var title = document.getElementById('add-title').value.trim();
      var cat = canonicalCategoryKey(document.getElementById('add-category').value);
      var timeRaw = String(document.getElementById('add-time').value || '').trim();
      var desc = document.getElementById('add-description').value.trim();
      var loc = document.getElementById('add-location').value.trim();
      var dates = collectAddEventDatesFromDom();
      if (dates.length === 0) {
        dates = state.eventDates.filter(function (d) { return d; });
      }
      if (!title || !cat || dates.length === 0) {
        rpbddAlertMessage('Please fill Event Title, at least one Date, and Category');
        return;
      }
      var inputByEl = document.getElementById('add-input-by');
      var createdBy =
        inputByEl && String(inputByEl.value || '').trim()
          ? String(inputByEl.value).trim()
          : formatEventInputByDisplay();
      var timeDisp = formatTimeTo12Hour(timeRaw);
      var base = getEventsApiBase();
      if (base) {
        fetch(base, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            description: desc,
            location: loc,
            dates: dates,
            time_raw: timeRaw,
            time_display: timeDisp,
            category: cat,
            status: 'upcoming',
            input_by: createdBy,
          }),
        })
          .then(parseEventsApiResponse)
          .then(function (parsed) {
            var j = parsed.data;
            if (!j || !j.ok || !j.row) {
              var extra = j && j.details ? '\n' + JSON.stringify(j.details) : '';
              rpbddAlertMessage(formatEventsApiError(parsed) + extra);
              return;
            }
            if (dates.length && dates[0] && /^\d{4}-\d{2}-\d{2}$/.test(dates[0])) {
              var pe = dates[0].split('-');
              state.eventsPanelDate = new Date(parseInt(pe[0], 10), parseInt(pe[1], 10) - 1, 1);
              state.eventsPanelPage = 1;
            }
            state.events = state.events.concat(expandDbRow(j.row));
            closeModal('modal-add-event');
            render();
            broadcastEventsChanged();
          })
          .catch(function () {
            rpbddAlertMessage('Network error — could not reach the server');
          });
        return;
      }
      var newEv = dates.map(function (date, idx) {
        return {
          id: Date.now() + idx,
          title: title,
          date: date,
          time: timeDisp,
          rawTime: timeRaw,
          category: cat,
          status: 'upcoming',
          description: desc,
          location: loc,
          createdBy: createdBy,
        };
      });
      state.events = state.events.concat(newEv);
      saveEvents();
      closeModal('modal-add-event');
      render();
    });

    document.getElementById('rpbdd-save-edit-event')?.addEventListener('click', function () {
      if (!state.editingEvent) return;
      var title = document.getElementById('edit-title').value.trim();
      var cat = canonicalCategoryKey(document.getElementById('edit-category').value);
      var timeRaw = String(document.getElementById('edit-time').value || '').trim();
      var datesFromDom = collectEditEventDatesFromDom();
      if (datesFromDom.length === 0) {
        datesFromDom = state.editEventDates.filter(function (d) {
          return d;
        });
      }
      var datesNorm = normalizeDedupeSortDatesArray(datesFromDom);
      if (!title || !cat || datesNorm.length === 0) {
        rpbddAlertMessage('Please fill title, category, and at least one date');
        return;
      }
      var timeDisp = formatTimeTo12Hour(timeRaw);
      var desc = document.getElementById('edit-description').value.trim();
      var loc = document.getElementById('edit-location').value.trim();
      var datesForApi = datesNorm;
      var dbId = canonicalEventDbId(state.editingEvent.dbId);
      var base = getEventsApiBase();
      if (dbId && base) {
        fetch(base + '/' + encodeURIComponent(dbId) + '/update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title,
            category: cat,
            time_raw: timeRaw,
            time_display: timeDisp,
            description: desc,
            location: loc,
            dates: datesForApi,
          }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            if (!j.ok || !j.row) {
              rpbddAlertMessage(formatRpbddApiError(j, 'Could not update event'));
              return;
            }
            var removeKey = canonicalEventDbId(dbId);
            state.events = state.events.filter(function (e) {
              return canonicalEventDbId(e.dbId) !== removeKey;
            });
            state.events = state.events.concat(expandDbRow(j.row));
            state.editingEvent = null;
            state.editingEventGroupKey = null;
            closeModal('modal-edit-event');
            render();
            broadcastEventsChanged();
          })
          .catch(function () {
            rpbddAlertMessage('Network error');
          });
        return;
      }
      var ed = state.editingEvent;
      var egk = state.editingEventGroupKey;
      if (ed && !ed.isHoliday) {
        state.events = state.events.filter(function (e) {
          if (e.isHoliday) return true;
          if (egk) return eventGroupKey(e) !== egk;
          return e.id !== ed.id;
        });
        var t0 = Date.now();
        datesNorm.forEach(function (date, idx) {
          state.events.push({
            id: t0 + idx,
            title: title,
            date: date,
            time: timeDisp,
            rawTime: timeRaw,
            category: cat,
            status: ed.status || 'upcoming',
            description: desc,
            location: loc,
            createdBy: ed.createdBy || '',
          });
        });
      }
      state.editingEventGroupKey = null;
      saveEvents();
      state.editingEvent = null;
      closeModal('modal-edit-event');
      render();
    });

    document.querySelectorAll('[data-events-view]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var raw = String(btn.getAttribute('data-events-view') || 'upcoming').trim().toLowerCase();
        state.eventsView = raw === 'done' ? 'done' : 'upcoming';
        state.eventsPanelPage = 1;
        state.expandedEventGroupKey = null;
        document.querySelectorAll('[data-events-view]').forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-events-view') === state.eventsView);
        });
        renderEventsPanel();
      });
    });

    (function bindReportsCardsOpen() {
      var wrap = document.getElementById('rpbdd-reports-list');
      if (!wrap || wrap.dataset.rpbddReportCardsBound === '1') return;
      wrap.dataset.rpbddReportCardsBound = '1';
      wrap.addEventListener('click', function (e) {
        var card = e.target.closest('[data-report-open]');
        if (!card) return;
        e.preventDefault();
        openReportCardModalFromNode(card);
      });
      wrap.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('[data-report-open]');
        if (!card) return;
        e.preventDefault();
        openReportCardModalFromNode(card);
      });
    })();

    (function bindReportModalAvatarEditor() {
      var avatarWrap = document.getElementById('rpbdd-report-card-modal-avatar');
      if (!avatarWrap || avatarWrap.dataset.rpbddBound === '1') return;
      avatarWrap.dataset.rpbddBound = '1';
      avatarWrap.addEventListener('click', function (e) {
        var ck = String(avatarWrap.getAttribute('data-report-avatar-edit') || '').trim();
        if (!ck) return;
        e.preventDefault();
        openReportCategoryDisplayModal(ck);
      });
      avatarWrap.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var ck = String(avatarWrap.getAttribute('data-report-avatar-edit') || '').trim();
        if (!ck) return;
        e.preventDefault();
        openReportCategoryDisplayModal(ck);
      });
    })();

    (function bindReportCategoryDisplayModal() {
      var mo = document.getElementById('modal-report-category-display');
      if (!mo || mo.dataset.rpbddBound === '1') return;
      mo.dataset.rpbddBound = '1';
      var fileEl = document.getElementById('rpbdd-report-cat-display-photo-file');
      if (!fileEl) return;
      fileEl.addEventListener('change', function () {
        var f = this.files && this.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) {
          rpbddAlertMessage('Please choose an image file.');
          this.value = '';
          return;
        }
        var rd = new FileReader();
        var inputEl = this;
        rd.onload = function () {
          var data = String(rd.result || '');
          if (data.length > 1600000) {
            rpbddAlertMessage('Image is too large for local storage. Try a smaller file (under ~1.2MB).');
            reportCategoryDisplayModalPendingDataUrl = null;
            inputEl.value = '';
            return;
          }
          reportCategoryDisplayModalPendingDataUrl = data;
          reportCategoryDisplayModalPhotoClear = false;
          var prev = document.getElementById('rpbdd-report-cat-display-photo-preview');
          if (!prev) return;
          prev.innerHTML = '';
          var im = document.createElement('img');
          im.alt = '';
          im.src = data;
          prev.appendChild(im);
        };
        rd.readAsDataURL(f);
      });
      document.getElementById('rpbdd-report-cat-display-photo-remove')?.addEventListener('click', function () {
        reportCategoryDisplayModalPhotoClear = true;
        reportCategoryDisplayModalPendingDataUrl = null;
        var fe = document.getElementById('rpbdd-report-cat-display-photo-file');
        if (fe) fe.value = '';
        var prev = document.getElementById('rpbdd-report-cat-display-photo-preview');
        if (prev) {
          prev.innerHTML = '';
          var ph = document.createElement('span');
          ph.className = 'rpbdd-report-cat-display-photo-placeholder';
          ph.textContent = 'No photo';
          prev.appendChild(ph);
        }
      });
      document.getElementById('rpbdd-report-cat-display-save')?.addEventListener('click', function () {
        commitReportCategoryDisplayModal();
      });
    })();

    (function bindReportModalDoneTaskCards() {
      var wrap = document.getElementById('rpbdd-report-card-modal-done-tasks');
      if (!wrap || wrap.dataset.rpbddReportDoneCardsBound === '1') return;
      wrap.dataset.rpbddReportDoneCardsBound = '1';
      wrap.addEventListener('click', function (e) {
        var prevTrg = e.target.closest('.rpbdd-tasks-card-preview-trigger');
        if (prevTrg) {
          e.preventDefault();
          var plid = parseInt(prevTrg.getAttribute('data-task-preview-list'), 10) || 0;
          var pk = String(prevTrg.getAttribute('data-task-preview-kind') || 'other');
          var ptitle = prevTrg.getAttribute('data-task-preview-title') || '';
          var purl = prevTrg.getAttribute('data-task-preview-view-url') || '';
          var paid = parseInt(prevTrg.getAttribute('data-task-attachment-id'), 10) || 0;
          if (purl) tasksOpenAttachmentPreviewModal(plid, pk, ptitle, purl, paid);
          return;
        }
        var expandTaskCard = e.target.closest('[data-expand-task-list]');
        if (expandTaskCard) {
          e.preventDefault();
          var listCardId = parseInt(expandTaskCard.getAttribute('data-expand-task-list'), 10) || 0;
          if (listCardId > 0) {
            var willCollapse = state.expandedTaskListId === listCardId;
            state.expandedTaskListId = willCollapse ? null : listCardId;
            renderReportCardDoneTasks(state.reportModalEmail || '');
          }
        }
      });
      wrap.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var expandTaskCard = e.target.closest('[data-expand-task-list]');
        if (!expandTaskCard) return;
        e.preventDefault();
        expandTaskCard.click();
      });
    })();

    document.getElementById('rpbdd-events-search')?.addEventListener('input', function () {
      state.eventsSearch = this.value;
      state.eventsPanelPage = 1;
      state.expandedEventGroupKey = null;
      if (state.activeNav === 'events') renderEventsPanel();
    });

    document.getElementById('rpbdd-team-logs-search')?.addEventListener('input', function () {
      state.teamLogsSearch = String(this.value || '');
      state.currentPage = 1;
      if (state.activeNav === 'team') renderTeamPanel();
    });

    document.getElementById('rpbdd-team-active-search')?.addEventListener('input', function () {
      state.teamActiveSearch = String(this.value || '');
      state.currentPage = 1;
      if (state.activeNav === 'team') renderTeamPanel();
    });

    document.getElementById('rpbdd-team-teams-search')?.addEventListener('input', function () {
      state.teamTeamsSearch = String(this.value || '');
      state.currentPage = 1;
      if (state.activeNav === 'team') renderTeamPanel();
    });

    document.getElementById('rpbdd-team-members-search')?.addEventListener('input', function () {
      state.teamMembersSearch = String(this.value || '');
      state.currentPage = 1;
      if (state.activeNav === 'team') renderTeamPanel();
    });

    document.getElementById('rpbdd-open-recycle')?.addEventListener('click', function () {
      syncEventsRecycleBinChrome();
      state.expandedEventRecycleId = null;
      state.recycleEventsPage = 1;
      openModal('modal-recycle');
      renderRecycle();
    });

    document.getElementById('modal-recycle')?.addEventListener('click', function (e) {
      var delAll = e.target.closest('#rpbdd-recycle-delete-all');
      var restoreAllBtn = e.target.closest('#rpbdd-recycle-restore-all');
      if (!delAll && !restoreAllBtn) return;
      if (!roleCanManageEventsRecycle()) return;
      e.preventDefault();
      e.stopPropagation();

      var list = document.getElementById('rpbdd-recycle-list');
      var hasItems = !!(list && list.querySelector('.rpbdd-event-card--recycle'));
      var loadPh = list && list.querySelector('.rpbdd-placeholder');
      var loadText = loadPh ? String(loadPh.textContent || '') : '';
      var isLoading = !!(loadPh && /loading/i.test(loadText) && !hasItems);

      if (isLoading) {
        openRpbddConfirm({
          variant: 'neutral',
          title: 'Please wait',
          message: 'The list is still loading. Try again in a moment.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (loadPh && /could not load/i.test(loadText) && !hasItems) {
        openRpbddConfirm({
          variant: 'neutral',
          title: 'List unavailable',
          message: 'The recycle list could not be loaded. Close and reopen the Recycle Bin, then try again.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (!hasItems) {
        openRpbddConfirm({
          variant: restoreAllBtn ? 'restore' : 'delete',
          title: 'Recycle Bin is empty',
          message: restoreAllBtn
            ? 'There is nothing to restore. Items appear here when you move them from Done.'
            : 'There is nothing to delete. Items appear here when you move them from Done.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (restoreAllBtn) {
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore all items?',
          message: 'Everything in the Recycle Bin returns to your live events and calendar.',
          confirmLabel: 'Restore all',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          var apiBase = getEventsApiBase();
          if (!apiBase) {
            restoreAllLocalRecycleEntries();
            renderRecycle();
            render();
            return;
          }
          restoreAllDbRecycleRows(apiBase)
            .then(function () {
              restoreAllLocalRecycleEntries();
              return renderRecycle();
            })
            .then(function () {
              render();
            })
            .catch(function () {
              rpbddAlertMessage('Could not restore all items. Check your connection and try again.');
              return renderRecycle().then(function () {
                render();
              });
            });
        });
        return;
      }

      openRpbddConfirm({
        variant: 'delete',
        title: 'Empty Recycle Bin?',
        message: 'All items will be permanently removed. This cannot be undone.',
        confirmLabel: 'Delete all',
        cancelLabel: 'Cancel',
        danger: true,
      }).then(function (ok) {
        if (!ok) return;
        var apiBase = getEventsApiBase();
        if (!apiBase) {
          clearLocalRecycleOnlyEntries();
          renderRecycle();
          return;
        }
        purgeAllDbRecycleRows(apiBase)
          .then(function () {
            clearLocalRecycleOnlyEntries();
            return renderRecycle();
          })
          .catch(function () {
            rpbddAlertMessage('Could not clear all database items. Check your connection and try again.');
            return renderRecycle();
          });
      });
    });

    document.getElementById('rpbdd-open-teams-recycle')?.addEventListener('click', function () {
      state.expandedTeamRecycleId = null;
      openModal('modal-teams-recycle');
      renderTeamsRecycle();
    });

    document.getElementById('modal-teams-recycle')?.addEventListener('click', function (e) {
      var delAll = e.target.closest('#rpbdd-teams-recycle-delete-all');
      var restoreAllBtn = e.target.closest('#rpbdd-teams-recycle-restore-all');
      if (!delAll && !restoreAllBtn) return;
      e.preventDefault();
      e.stopPropagation();

      var list = document.getElementById('rpbdd-teams-recycle-list');
      var hasItems = !!(list && list.querySelector('.rpbdd-team-card--recycle'));
      var loadPh = list && list.querySelector('.rpbdd-placeholder');
      var loadText = loadPh ? String(loadPh.textContent || '') : '';
      var isLoading = !!(loadPh && /loading/i.test(loadText) && !hasItems);

      if (isLoading) {
        openRpbddConfirm({
          variant: 'neutral',
          title: 'Please wait',
          message: 'The list is still loading. Try again in a moment.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (loadPh && /could not load/i.test(loadText) && !hasItems) {
        openRpbddConfirm({
          variant: 'neutral',
          title: 'List unavailable',
          message: 'The teams recycle list could not be loaded. Close and reopen the bin, then try again.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (!hasItems) {
        openRpbddConfirm({
          variant: restoreAllBtn ? 'restore' : 'delete',
          title: 'Recycle Bin is empty',
          message: restoreAllBtn
            ? 'There is nothing to restore. Teams appear here when you remove them from Total Teams.'
            : 'There is nothing to delete.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (restoreAllBtn) {
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore all teams?',
          message: 'Everything in the Teams Recycle Bin returns to Total Teams.',
          confirmLabel: 'Restore all',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          var apiBase = getTeamsApiBase();
          if (!apiBase) {
            restoreAllTeamsLocalRecycleEntries();
            renderTeamsRecycle();
            renderTeamPanel();
            return;
          }
          restoreAllTeamsDbRecycleRows(apiBase)
            .then(function () {
              restoreAllTeamsLocalRecycleEntries();
              return refreshTeamsFromApi();
            })
            .then(function () {
              renderTeamsRecycle();
              renderTeamPanel();
            })
            .catch(function () {
              rpbddAlertMessage('Could not restore all teams. Check your connection and try again.');
              return renderTeamsRecycle().then(function () {
                renderTeamPanel();
              });
            });
        });
        return;
      }

      openRpbddConfirm({
        variant: 'delete',
        title: 'Empty Teams Recycle Bin?',
        message: 'All items will be permanently removed. This cannot be undone.',
        confirmLabel: 'Delete all',
        cancelLabel: 'Cancel',
        danger: true,
      }).then(function (ok) {
        if (!ok) return;
        var apiBase = getTeamsApiBase();
        if (!apiBase) {
          clearTeamsLocalRecycleOnly();
          renderTeamsRecycle();
          return;
        }
        purgeAllTeamsDbRecycleRows(apiBase)
          .then(function () {
            clearTeamsLocalRecycleOnly();
            return renderTeamsRecycle();
          })
          .catch(function () {
            rpbddAlertMessage('Could not clear all database items. Check your connection and try again.');
            return renderTeamsRecycle();
          });
      });
    });

    document.getElementById('rpbdd-open-members-recycle')?.addEventListener('click', function () {
      state.expandedMemberRecycleId = null;
      openModal('modal-members-recycle');
      renderMembersRecycle();
    });

    document.getElementById('modal-members-recycle')?.addEventListener('click', function (e) {
      var delAllM = e.target.closest('#rpbdd-members-recycle-delete-all');
      var restoreAllBtnM = e.target.closest('#rpbdd-members-recycle-restore-all');
      if (!delAllM && !restoreAllBtnM) return;
      e.preventDefault();
      e.stopPropagation();

      var listM = document.getElementById('rpbdd-members-recycle-list');
      var hasItemsM = !!(listM && listM.querySelector('.rpbdd-member-recycle-card'));
      var loadPhM = listM && listM.querySelector('.rpbdd-placeholder');
      var loadTextM = loadPhM ? String(loadPhM.textContent || '') : '';
      var isLoadingM = !!(loadPhM && /loading/i.test(loadTextM) && !hasItemsM);

      if (isLoadingM) {
        openRpbddConfirm({
          variant: 'neutral',
          title: 'Please wait',
          message: 'The list is still loading. Try again in a moment.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (loadPhM && /could not load/i.test(loadTextM) && !hasItemsM) {
        openRpbddConfirm({
          variant: 'neutral',
          title: 'List unavailable',
          message: 'The members recycle list could not be loaded. Close and reopen the bin, then try again.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (!hasItemsM) {
        openRpbddConfirm({
          variant: restoreAllBtnM ? 'restore' : 'delete',
          title: 'Recycle Bin is empty',
          message: restoreAllBtnM
            ? 'There is nothing to restore. Members appear here when you remove them from Total Members.'
            : 'There is nothing to delete.',
          confirmLabel: 'OK',
          cancelLabel: 'Close',
          danger: false,
        });
        return;
      }

      if (restoreAllBtnM) {
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore all members?',
          message: 'Everything in the Members Recycle Bin returns to Total Members.',
          confirmLabel: 'Restore all',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          var apiBaseM = getMembersApiBase();
          if (!apiBaseM) {
            restoreAllMembersLocalRecycleEntries();
            renderMembersRecycle();
            renderTeamPanel();
            return;
          }
          restoreAllMembersDbRecycleRows(apiBaseM)
            .then(function () {
              restoreAllMembersLocalRecycleEntries();
              return refreshMembersFromApi();
            })
            .then(function () {
              renderMembersRecycle();
              renderTeamPanel();
            })
            .catch(function () {
              rpbddAlertMessage('Could not restore all members. Check your connection and try again.');
              return renderMembersRecycle().then(function () {
                renderTeamPanel();
              });
            });
        });
        return;
      }

      openRpbddConfirm({
        variant: 'delete',
        title: 'Empty Members Recycle Bin?',
        message: 'All items will be permanently removed. This cannot be undone.',
        confirmLabel: 'Delete all',
        cancelLabel: 'Cancel',
        danger: true,
      }).then(function (ok) {
        if (!ok) return;
        var apiBaseM2 = getMembersApiBase();
        if (!apiBaseM2) {
          clearMembersLocalRecycleOnly();
          renderMembersRecycle();
          return;
        }
        purgeAllMembersDbRecycleRows(apiBaseM2)
          .then(function () {
            clearMembersLocalRecycleOnly();
            return renderMembersRecycle();
          })
          .catch(function () {
            rpbddAlertMessage('Could not clear all database items. Check your connection and try again.');
            return renderMembersRecycle();
          });
      });
    });

    document.getElementById('rpbdd-team-view-teams')?.addEventListener('click', function () {
      state.teamView = 'teams';
      state.currentPage = 1;
      var after = function () {
        renderTeamPanel();
      };
      if (getTeamsApiBase()) {
        refreshTeamsFromApi().then(after);
      } else {
        after();
      }
    });
    document.getElementById('rpbdd-team-view-members')?.addEventListener('click', function () {
      state.teamView = 'members';
      state.currentPage = 1;
      refreshMembersFromApi().then(function () {
        renderTeamPanel();
      });
    });
    document.getElementById('rpbdd-team-view-active')?.addEventListener('click', function () {
      state.teamView = 'active';
      state.currentPage = 1;
      Promise.all([refreshMembersFromApi(), refreshTeamsFromApi()]).then(function () {
        renderTeamPanel();
      });
    });
    document.getElementById('rpbdd-team-view-logs')?.addEventListener('click', function () {
      state.teamView = 'logs';
      state.currentPage = 1;
      refreshUserLogsFromApi().then(function () {
        renderTeamPanel();
      });
    });

    document.getElementById('team-photo')?.addEventListener('change', function () {
      var prev = document.getElementById('team-photo-preview');
      var av = document.getElementById('team-photo-avatar');
      if (!prev) return;
      var f = this.files && this.files[0];
      if (prev.dataset.objectUrl) {
        URL.revokeObjectURL(prev.dataset.objectUrl);
        delete prev.dataset.objectUrl;
      }
      if (!f) {
        if (av) av.classList.remove('has-image');
        prev.removeAttribute('src');
        return;
      }
      if (!/^image\//.test(f.type)) {
        rpbddAlertMessage('Please choose an image file.');
        this.value = '';
        if (av) av.classList.remove('has-image');
        prev.removeAttribute('src');
        return;
      }
      var url = URL.createObjectURL(f);
      prev.dataset.objectUrl = url;
      prev.src = url;
      if (av) av.classList.add('has-image');
    });

    document.getElementById('account-photo')?.addEventListener('change', function () {
      var team = state.accountLeaderTeam;
      if (!team || currentUserRole() !== 'team_leader') return;
      var tid = pickTeamRowId(team);
      if (tid == null || tid === '') {
        rpbddAlertMessage('Missing team id.');
        this.value = '';
        return;
      }
      var f = this.files && this.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) {
        rpbddAlertMessage('Please choose an image file.');
        this.value = '';
        return;
      }
      var maxBytes = 5 * 1024 * 1024;
      if (f.size > maxBytes) {
        rpbddAlertMessage('Image must be 5 MB or smaller.');
        this.value = '';
        return;
      }
      var apiBase = getTeamsApiBase();
      if (!apiBase) {
        rpbddAlertMessage('Teams API is not configured.');
        this.value = '';
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        var photoDataUrl = typeof reader.result === 'string' ? reader.result : null;
        if (!photoDataUrl) {
          rpbddAlertMessage('Could not read the image. Try another file.');
          return;
        }
        fetch(apiBase + '/' + encodeURIComponent(tid) + '/update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: firstNonEmptyString(team.leadId, team.lead_id, team.Lead_ID),
            email: firstNonEmptyString(team.email, team.Email),
            password: '',
            teamLeader: firstNonEmptyString(team.teamLeader, team.team_leader, team.Team_Leader),
            sectionTeam: firstNonEmptyString(team.sectionTeam, team.section_team, team.Section_Team),
            position: firstNonEmptyString(team.position, team.Position),
            photo: photoDataUrl,
          }),
        })
          .then(function (res) {
            return res.text().then(function (text) {
              var j = null;
              try {
                j = text ? JSON.parse(text) : null;
              } catch (e) {
                j = null;
              }
              return { res: res, j: j, raw: text || '' };
            });
          })
          .then(function (o) {
            if (!o.res.ok || !o.j || !o.j.ok || !o.j.team) {
              var msg = formatRpbddApiError(o.j, 'Could not update photo');
              if (o.res && o.res.status) msg += '\nHTTP ' + o.res.status;
              rpbddAlertMessage(msg);
              return;
            }
            fillAccountLeaderFormFromTeam(o.j.team);
            applyTeamLeaderSidebarFromApiTeam(o.j.team);
            createProfileUpdateNotification('updated profile photo');
            showTeamEditSuccessToast('Profile photo updated successfully.');
          })
          .catch(function () {
            rpbddAlertMessage('Network error while updating photo');
          })
          .finally(function () {
            var inp = document.getElementById('account-photo');
            if (inp) inp.value = '';
          });
      };
      reader.onerror = function () {
        rpbddAlertMessage('Could not read the image. Try another file.');
      };
      reader.readAsDataURL(f);
    });

    document.getElementById('account-member-photo-input')?.addEventListener('change', function () {
      var mem = state.accountMemberMember;
      if (!mem || currentUserRole() !== 'member') return;
      var mid = pickMemberRowId(mem);
      if (mid == null || mid === '') {
        rpbddAlertMessage('Missing member id.');
        this.value = '';
        return;
      }
      var f = this.files && this.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) {
        rpbddAlertMessage('Please choose an image file.');
        this.value = '';
        return;
      }
      var maxBytes = 5 * 1024 * 1024;
      if (f.size > maxBytes) {
        rpbddAlertMessage('Image must be 5 MB or smaller.');
        this.value = '';
        return;
      }
      var apiBase = getMembersApiBase();
      if (!apiBase) {
        rpbddAlertMessage('Members API is not configured.');
        this.value = '';
        return;
      }
      var readerM = new FileReader();
      readerM.onload = function () {
        var photoDataUrl = typeof readerM.result === 'string' ? readerM.result : null;
        if (!photoDataUrl) {
          rpbddAlertMessage('Could not read the image. Try another file.');
          return;
        }
        fetch(apiBase + '/' + encodeURIComponent(mid) + '/update', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: firstNonEmptyString(mem.email, mem.Email),
            password: '',
            team: firstNonEmptyString(mem.team, mem.Team),
            photo: photoDataUrl,
          }),
        })
          .then(function (res) {
            return res.text().then(function (text) {
              var j = null;
              try {
                j = text ? JSON.parse(text) : null;
              } catch (e) {
                j = null;
              }
              return { res: res, j: j, raw: text || '' };
            });
          })
          .then(function (o) {
            if (!o.res.ok || !o.j || !o.j.ok || !o.j.member) {
              var msg = formatRpbddApiError(o.j, 'Could not update photo');
              if (o.res && o.res.status) msg += '\nHTTP ' + o.res.status;
              rpbddAlertMessage(msg);
              return;
            }
            fillAccountMemberFormFromMember(o.j.member);
            applyMemberSidebarFromApiMember(o.j.member);
            if (!(getMembersApiBase() && currentUserRole() === 'member')) {
              createProfileUpdateNotification('updated profile photo');
            }
            showTeamEditSuccessToast('Profile photo updated successfully.');
          })
          .catch(function () {
            rpbddAlertMessage('Network error while updating photo');
          })
          .finally(function () {
            var inp = document.getElementById('account-member-photo-input');
            if (inp) inp.value = '';
          });
      };
      readerM.onerror = function () {
        rpbddAlertMessage('Could not read the image. Try another file.');
      };
      readerM.readAsDataURL(f);
    });

    document.getElementById('account-admin-photo-input')?.addEventListener('change', function () {
      if (currentUserRole() !== 'admin') return;
      var f = this.files && this.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) {
        rpbddAlertMessage('Please choose an image file.');
        this.value = '';
        return;
      }
      var maxBytes = 5 * 1024 * 1024;
      if (f.size > maxBytes) {
        rpbddAlertMessage('Image must be 5 MB or smaller.');
        this.value = '';
        return;
      }
      var apiBase = getAdminAccountApiBase();
      if (!apiBase) {
        rpbddAlertMessage('Admin account API is not configured.');
        this.value = '';
        return;
      }
      var readerA = new FileReader();
      readerA.onload = function () {
        var photoDataUrl = typeof readerA.result === 'string' ? readerA.result : null;
        if (!photoDataUrl) {
          rpbddAlertMessage('Could not read the image. Try another file.');
          return;
        }
        // Immediate UI preview (same behavior expectation as member/team: visible without refresh).
        var emNow = document.getElementById('account-admin-email');
        var fullNameNow = emNow ? displayNameFromEmail(emNow.value) : '';
        setAccountModalPhotoFromAdmin({ photo: photoDataUrl, email: emNow ? String(emNow.value || '') : '', fullName: fullNameNow });
        if (state.currentUser) state.currentUser.photo = photoDataUrl;
        persistCurrentUserToLocalStorage();
        var sidebarNow = document.getElementById('rpbdd-avatar-img');
        var initialsNow = document.getElementById('rpbdd-user-initials');
        if (sidebarNow) {
          sidebarNow.src = photoDataUrl;
          sidebarNow.style.display = 'block';
          if (initialsNow) initialsNow.style.display = 'none';
        }
        fetch(apiBase + '/photo', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: photoDataUrl }),
        })
          .then(function (res) {
            return res.text().then(function (text) {
              var j = null;
              try {
                j = text ? JSON.parse(text) : null;
              } catch (e) {
                j = null;
              }
              return { res: res, j: j, raw: text || '' };
            });
          })
          .then(function (o) {
            if (!o.res.ok || !o.j || !o.j.ok || !o.j.admin) {
              var msg = formatRpbddApiError(o.j, 'Could not update photo');
              if (o.res && o.res.status) msg += '\nHTTP ' + o.res.status;
              rpbddAlertMessage(msg);
              return;
            }
            var freshPhoto = firstNonEmptyString(o.j.admin.photo, photoDataUrl);
            if (freshPhoto && !/^data:/i.test(freshPhoto)) {
              freshPhoto += (freshPhoto.indexOf('?') >= 0 ? '&' : '?') + 'v=' + String(Date.now());
            }
            o.j.admin.photo = freshPhoto;
            fillAccountAdminForm(o.j.admin);
            if (state.currentUser) {
              state.currentUser.photo = freshPhoto || null;
              persistCurrentUserToLocalStorage();
              var sidebarAv = document.getElementById('rpbdd-avatar-img');
              var initialsEl = document.getElementById('rpbdd-user-initials');
              if (sidebarAv && freshPhoto) {
                sidebarAv.src = freshPhoto;
                sidebarAv.style.display = 'block';
                if (initialsEl) initialsEl.style.display = 'none';
              }
            }
            showTeamEditSuccessToast('Profile photo updated successfully.');
          })
          .catch(function () {
            // Keep immediate preview visible locally; only notify save failure to DB.
            rpbddAlertMessage('Network error while updating photo');
          })
          .finally(function () {
            var inp = document.getElementById('account-admin-photo-input');
            if (inp) inp.value = '';
          });
      };
      readerA.onerror = function () {
        rpbddAlertMessage('Could not read the image. Try another file.');
      };
      readerA.readAsDataURL(f);
    });

    document.getElementById('rpbdd-open-add-team')?.addEventListener('click', function () {
      if (currentUserRole() === 'team_leader') return;
      resetAddTeamForm();
      openModal('modal-add-team');
    });

    document.getElementById('rpbdd-team-export-pdf')?.addEventListener('click', function () {
      openTeamExportModal();
    });

    document.getElementById('rpbdd-team-print')?.addEventListener('click', function () {
      runTeamPrint();
    });

    document.getElementById('rpbdd-export-apply-filter')?.addEventListener('click', function () {
      renderTeamExportModalTable();
    });

    document.getElementById('rpbdd-export-select-all')?.addEventListener('click', function () {
      document.querySelectorAll('#rpbdd-export-table-body .rpbdd-export-row-check').forEach(function (c) {
        c.checked = true;
      });
      updateTeamExportSelectionCount();
    });

    document.getElementById('rpbdd-export-deselect-all')?.addEventListener('click', function () {
      document.querySelectorAll('#rpbdd-export-table-body .rpbdd-export-row-check').forEach(function (c) {
        c.checked = false;
      });
      updateTeamExportSelectionCount();
    });

    document.getElementById('rpbdd-export-table-body')?.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('rpbdd-export-row-check')) {
        updateTeamExportSelectionCount();
      }
    });

    document.getElementById('rpbdd-team-export-do-pdf')?.addEventListener('click', function () {
      runTeamExportToPdf();
    });

    document.getElementById('team-section-add')?.addEventListener('click', function () {
      var inp = document.getElementById('team-section-new');
      var v = inp && inp.value.trim();
      if (!v) {
        rpbddAlertMessage('Enter a section name to add to the list.');
        return;
      }
      appendDdOnlySection(v);
      inp.value = '';
      populateTeamSectionSelect(v);
    });
    document.getElementById('team-position-add')?.addEventListener('click', function () {
      var inp = document.getElementById('team-position-new');
      var v = inp && inp.value.trim();
      if (!v) {
        rpbddAlertMessage('Enter a position to add to the list.');
        return;
      }
      appendDdOnlyPosition(v);
      inp.value = '';
      populateTeamPositionSelect(v);
    });
    function ddAddOnEnter(e, btnId) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      document.getElementById(btnId)?.click();
    }
    document.getElementById('team-section-new')?.addEventListener('keydown', function (e) {
      ddAddOnEnter(e, 'team-section-add');
    });
    document.getElementById('team-position-new')?.addEventListener('keydown', function (e) {
      ddAddOnEnter(e, 'team-position-add');
    });

    document.getElementById('member-photo')?.addEventListener('change', function () {
      var prev = document.getElementById('member-photo-preview');
      var av = document.getElementById('member-photo-avatar');
      if (!prev) return;
      var f = this.files && this.files[0];
      if (prev.dataset.objectUrl) {
        URL.revokeObjectURL(prev.dataset.objectUrl);
        delete prev.dataset.objectUrl;
      }
      if (!f) {
        if (av) av.classList.remove('has-image');
        prev.removeAttribute('src');
        return;
      }
      if (!/^image\//.test(f.type)) {
        rpbddAlertMessage('Please choose an image file.');
        this.value = '';
        if (av) av.classList.remove('has-image');
        prev.removeAttribute('src');
        return;
      }
      var url = URL.createObjectURL(f);
      prev.dataset.objectUrl = url;
      prev.src = url;
      if (av) av.classList.add('has-image');
    });

    document.getElementById('rpbdd-open-add-member')?.addEventListener('click', function () {
      resetMemberForm();
      openModal('modal-add-member');
      if (typeof window.rpbddSyncPasswordToggles === 'function') {
        window.rpbddSyncPasswordToggles(document.getElementById('modal-add-member'));
      }
    });

    document.getElementById('rpbdd-save-team')?.addEventListener('click', function () {
      var leadIdVal = document.getElementById('team-lead-id').value.trim();
      var em = document.getElementById('team-email').value.trim();
      var pw = document.getElementById('team-password').value;
      var lead = document.getElementById('team-leader').value.trim();
      var sec = document.getElementById('team-section').value.trim();
      var pos = document.getElementById('team-position').value.trim();
      var editingId = state.editingTeamId;
      if (!leadIdVal || !em || !sec || !lead || !pos) {
        openRpbddAlert({
          title: editingId ? 'Edit Team — missing details' : 'Add New Team — missing details',
          message: 'Please fill Lead ID, Email, Section Chief, Section Team, and Position. (Profile photo is optional.)',
          okLabel: 'Back to form',
        });
        return;
      }
      if (!editingId && (!pw || String(pw).trim() === '')) {
        openRpbddAlert({
          title: 'Add New Team — password required',
          message: 'Please enter a password before adding a new team.',
          okLabel: 'Back to password',
        });
        return;
      }
      var fileInput = document.getElementById('team-photo');
      var file = fileInput && fileInput.files && fileInput.files[0];
      var maxBytes = 5 * 1024 * 1024;
      if (file && file.size > maxBytes) {
        rpbddAlertMessage('Image must be 5 MB or smaller.');
        return;
      }

      function finishSave(photoDataUrl) {
        var apiBase = getTeamsApiBase();
        var existing =
          editingId &&
          state.teams.find(function (x) {
            return String(x.id) === String(editingId);
          });
        var photoPayload = photoDataUrl;
        if (photoPayload == null && existing && existing.photo) {
          photoPayload = existing.photo;
        }

        function handleTeamApiError(o, fallbackMsg) {
          var msg = formatRpbddApiError(o.j, fallbackMsg);
          if (!o.j && o.raw) {
            msg +=
              '\n\nHTTP ' +
              o.res.status +
              ' — Server did not return JSON (wrong URL or PHP error). First lines:\n' +
              o.raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 320);
          } else if (o.res && o.res.status) {
            msg += '\nHTTP ' + o.res.status;
          }
          rpbddAlertMessage(msg);
        }

        if (apiBase && editingId) {
          fetch(apiBase + '/' + encodeURIComponent(editingId) + '/update', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: leadIdVal,
              email: em,
              password: pw,
              teamLeader: lead,
              sectionTeam: sec,
              position: pos,
              photo: photoPayload != null ? photoPayload : null,
            }),
          })
            .then(function (res) {
              return res.text().then(function (text) {
                var j = null;
                try {
                  j = text ? JSON.parse(text) : null;
                } catch (e) {
                  j = null;
                }
                return { res: res, j: j, raw: text || '' };
              });
            })
            .then(function (o) {
              if (!o.res.ok || !o.j || !o.j.ok || !o.j.team) {
                handleTeamApiError(o, 'Could not update team');
                return;
              }
              closeModal('modal-add-team');
              refreshTeamsFromApi().then(function (ok) {
                if (!ok) {
                  var mapped = mapApiTeamToState(o.j.team);
                  if (mapped) {
                    var ix = state.teams.findIndex(function (x) {
                      return String(x.id) === String(mapped.id);
                    });
                    if (ix >= 0) state.teams[ix] = mapped;
                  }
                }
                renderTeamPanel();
                createProfileUpdateNotification('updated profile information');
                showTeamEditSuccessToast();
              });
            })
            .catch(function () {
              rpbddAlertMessage('Network error while saving team');
            });
          return;
        }

        if (apiBase) {
          fetch(apiBase, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leadId: leadIdVal,
              email: em,
              password: pw,
              teamLeader: lead,
              sectionTeam: sec,
              position: pos,
              photo: photoDataUrl || null,
            }),
          })
            .then(function (res) {
              return res.text().then(function (text) {
                var j = null;
                try {
                  j = text ? JSON.parse(text) : null;
                } catch (e) {
                  j = null;
                }
                return { res: res, j: j, raw: text || '' };
              });
            })
            .then(function (o) {
              if (!o.res.ok || !o.j || !o.j.ok || !o.j.team) {
                handleTeamApiError(o, 'Could not save team');
                return;
              }
              var mapped = mapApiTeamToState(o.j.team);
              closeModal('modal-add-team');
              refreshTeamsFromApi().then(function (ok) {
                if (!ok && mapped) {
                  state.teams = state.teams.filter(function (x) {
                    return String(x.id) !== String(mapped.id);
                  });
                  state.teams.unshift(mapped);
                }
                renderTeamPanel();
              });
            })
            .catch(function () {
              rpbddAlertMessage('Network error while saving team');
            });
          return;
        }

        if (editingId && existing) {
          var keepPw =
            pw === '' || pw === '••••••••' || (typeof existing.passwordPlain === 'string' && pw === existing.passwordPlain);
          var newPlain = keepPw && typeof existing.passwordPlain === 'string' ? existing.passwordPlain : pw;
          var ix = state.teams.findIndex(function (x) {
            return String(x.id) === String(editingId);
          });
          if (ix >= 0) {
            state.teams[ix] = Object.assign({}, state.teams[ix], {
              leadId: leadIdVal,
              idNumber: leadIdVal,
              email: em,
              password: newPlain !== '' ? '••••••••' : '',
              passwordPlain: newPlain,
              hasPassword: newPlain !== '',
              sectionTeam: sec,
              teamLeader: lead,
              position: pos,
              photo: photoPayload != null ? photoPayload : state.teams[ix].photo,
              updatedAt: teamLocalTimestampNow(),
            });
          }
          saveTeams();
          closeModal('modal-add-team');
          renderTeamPanel();
          createProfileUpdateNotification('updated profile information');
          showTeamEditSuccessToast();
          return;
        }

        state.teams.push({
          id: Date.now(),
          leadId: leadIdVal,
          idNumber: leadIdVal,
          email: em,
          password: '••••••••',
          passwordPlain: pw,
          hasPassword: pw !== '',
          sectionTeam: sec,
          teamLeader: lead,
          position: pos,
          photo: photoDataUrl || null,
          memberNames: [],
          memberCount: 0,
          createdAt: teamLocalTimestampNow(),
          updatedAt: null,
        });
        saveTeams();
        closeModal('modal-add-team');
        renderTeamPanel();
      }

      if (file) {
        var reader = new FileReader();
        reader.onload = function () {
          finishSave(typeof reader.result === 'string' ? reader.result : null);
        };
        reader.onerror = function () {
          rpbddAlertMessage('Could not read the image. Try another file.');
        };
        reader.readAsDataURL(file);
      } else {
        finishSave(null);
      }
    });

    document.getElementById('rpbdd-edit-account-profile')?.addEventListener('click', function () {
      var team = state.accountLeaderTeam;
      if (!team || currentUserRole() !== 'team_leader') return;
      var mapped = mapApiTeamToState(team);
      if (!mapped) {
        rpbddAlertMessage('Could not open Edit Team modal.');
        return;
      }
      closeModal('modal-account');
      openTeamEditModal(mapped);
    });

    document.getElementById('rpbdd-edit-account-member-profile')?.addEventListener('click', function () {
      var mem = state.accountMemberMember;
      if (!mem || currentUserRole() !== 'member') return;
      var mapped = mapApiMemberToState(mem);
      if (!mapped) {
        rpbddAlertMessage('Could not open Edit Member modal.');
        return;
      }
      closeModal('modal-account');
      openMemberEditModal(mapped);
    });

    document.getElementById('rpbdd-edit-account-admin-profile')?.addEventListener('click', function () {
      if (currentUserRole() !== 'admin') return;
      fillEditAdminAccountModalFromView();
      openModal('modal-edit-admin-account');
      if (typeof window.rpbddSyncPasswordToggles === 'function') {
        window.rpbddSyncPasswordToggles(document.getElementById('modal-edit-admin-account'));
      }
    });

    document.getElementById('rpbdd-save-admin-account')?.addEventListener('click', function () {
      if (currentUserRole() !== 'admin') return;
      var email = (document.getElementById('edit-admin-email')?.value || '').trim().toLowerCase();
      var role = (document.getElementById('edit-admin-role')?.value || 'Admin').trim() || 'Admin';
      var password = String(document.getElementById('edit-admin-password')?.value || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rpbddAlertMessage('Please enter a valid email.');
        return;
      }
      var editModalEl = document.getElementById('modal-edit-admin-account');
      var initialEm = editModalEl ? String(editModalEl.dataset.initialAdminEmail || '').trim().toLowerCase() : '';
      if (initialEm && email.trim().toLowerCase() !== initialEm && !String(password).trim()) {
        rpbddAlertMessage(
          'You changed the email. Enter your new password in the field and save so Supabase login matches (same password you will use on the portal).',
        );
        return;
      }
      var apiBase = getAdminAccountApiBase();
      if (!apiBase) {
        rpbddAlertMessage('Admin account API is not configured.');
        return;
      }
      fetch(apiBase + '/update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          role: role,
          password: password,
        }),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var j = null;
            try {
              j = text ? JSON.parse(text) : null;
            } catch (e) {
              j = null;
            }
            return { res: res, j: j, raw: text || '' };
          });
        })
        .then(function (o) {
          if (!o.res.ok || !o.j || !o.j.ok || !o.j.admin) {
            var msg = formatRpbddApiError(o.j, 'Could not update admin account');
            if (o.res && o.res.status) msg += '\nHTTP ' + o.res.status;
            rpbddAlertMessage(msg);
            return;
          }
          fillAccountAdminForm(o.j.admin);
          applyAdminAccountToSidebar(o.j.admin);
          closeModal('modal-edit-admin-account');
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'rpbdd-portal-refresh-session' }, window.location.origin);
            }
          } catch (eRefresh) {
            /* ignore */
          }
          if (o.j.warning) {
            openRpbddAlert({
              title: 'Admin account saved',
              message: String(o.j.warning),
              okLabel: 'OK',
            });
          } else {
            showTeamEditSuccessToast('Admin account updated successfully.');
          }
        })
        .catch(function () {
          rpbddAlertMessage('Network error while updating admin account.');
        });
    });

    document.getElementById('rpbdd-save-member')?.addEventListener('click', function () {
      var editingMemberId = state.editingMemberId;
      var email = document.getElementById('member-email').value.trim();
      var pw = document.getElementById('member-password').value;
      var tid = document.getElementById('member-team').value.trim();

      if (editingMemberId) {
        if (!email) {
          openRpbddAlert({
            title: 'Edit Member — missing details',
            message: 'Please enter Email and assign a Team.',
            okLabel: 'Back to form',
          });
          return;
        }
        if (!state.teams || state.teams.length === 0) {
          openRpbddAlert({
            title: 'Edit Member — no teams',
            message: 'No teams in the list. Refresh the page or contact an administrator.',
            okLabel: 'OK',
          });
          return;
        }
        if (!tid) {
          openRpbddAlert({
            title: 'Edit Member — team required',
            message: 'Please select a Team.',
            okLabel: 'Select team',
          });
          return;
        }
        var teamEdit = state.teams.find(function (t) {
          return String(t.id) === String(tid);
        });
        if (!teamEdit) {
          openRpbddAlert({
            title: 'Edit Member — team required',
            message: 'Please select a valid Team from the list.',
            okLabel: 'Select team',
          });
          return;
        }
        var fileInputEdit = document.getElementById('member-photo');
        var fileEdit = fileInputEdit && fileInputEdit.files && fileInputEdit.files[0];
        var maxBytesEdit = 5 * 1024 * 1024;
        if (fileEdit && fileEdit.size > maxBytesEdit) {
          rpbddAlertMessage('Image must be 5 MB or smaller.');
          return;
        }
        var apiBaseEdit = getMembersApiBase();
        if (!apiBaseEdit) {
          rpbddAlertMessage('Members API is not configured.');
          return;
        }
        var existingMem = state.teamMembers.find(function (x) {
          return String(x.id) === String(editingMemberId);
        });
        function finishMemberEdit(photoDataUrl) {
          var photoPayload = photoDataUrl;
          if (photoPayload == null && existingMem && existingMem.photo) {
            photoPayload = existingMem.photo;
          }
          var bodyObj = {
            email: email,
            password: pw,
            team: teamEdit
              ? String((teamEdit.sectionTeam || '').trim() || (teamEdit.teamLeader || '').trim())
              : '',
          };
          if (photoPayload != null) {
            bodyObj.photo = photoPayload;
          }
          fetch(apiBaseEdit + '/' + encodeURIComponent(editingMemberId) + '/update', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyObj),
          })
            .then(function (res) {
              return res.text().then(function (text) {
                var j = null;
                try {
                  j = text ? JSON.parse(text) : null;
                } catch (e) {
                  j = null;
                }
                return { res: res, j: j, raw: text || '' };
              });
            })
            .then(function (o) {
              if (!o.res.ok || !o.j || !o.j.ok || !o.j.member) {
                rpbddAlertMessage(formatRpbddApiError(o.j, 'Could not save member'));
                return;
              }
              closeModal('modal-add-member');
              resetMemberForm();
              refreshMembersFromApi().then(function () {
                if (currentUserRole() === 'member') {
                  applyMemberSidebarFromApiMember(o.j.member);
                }
                renderTeamPanel();
              });
              if (!(getMembersApiBase() && currentUserRole() === 'member')) {
                createProfileUpdateNotification('updated profile information');
              }
              showTeamEditSuccessToast('Member updated successfully.');
            })
            .catch(function () {
              rpbddAlertMessage('Network error while saving member');
            });
        }
        if (fileEdit) {
          var readerE = new FileReader();
          readerE.onload = function () {
            finishMemberEdit(typeof readerE.result === 'string' ? readerE.result : null);
          };
          readerE.onerror = function () {
            rpbddAlertMessage('Could not read the image. Try another file.');
          };
          readerE.readAsDataURL(fileEdit);
        } else {
          finishMemberEdit(null);
        }
        return;
      }

      if (!email || !pw || String(pw).trim() === '') {
        openRpbddAlert({
          title: 'Add New Member — missing details',
          message: 'Please fill Email and Password.',
          okLabel: 'Back to form',
        });
        return;
      }
      if (!state.teams || state.teams.length === 0) {
        openRpbddAlert({
          title: 'Add New Member — no teams yet',
          message: 'No teams found in Total Teams. Please add/save a team first, then assign the member to that team.',
          okLabel: 'OK',
        });
        return;
      }
      if (!tid) {
        openRpbddAlert({
          title: 'Add New Member — team required',
          message: 'Please select a Team before adding the member.',
          okLabel: 'Select team',
        });
        return;
      }
      var team = state.teams.find(function (t) {
        return String(t.id) === String(tid);
      });
      var fileInput = document.getElementById('member-photo');
      var file = fileInput && fileInput.files && fileInput.files[0];
      var maxBytes = 5 * 1024 * 1024;
      if (file && file.size > maxBytes) {
        rpbddAlertMessage('Image must be 5 MB or smaller.');
        return;
      }
      var apiBase = getMembersApiBase();

      function pushLocalMemberAndClose(photoDataUrl) {
        state.teamMembers.push({
          id: Date.now(),
          employeeId: '',
          name: displayNameFromEmail(email),
          email: email,
          password: '••••••••',
          passwordPlain: pw,
          hasPassword: pw !== '',
          photo: photoDataUrl != null ? photoDataUrl : null,
          teamId: parseInt(tid, 10),
          team: team
            ? String((team.sectionTeam || '').trim() || (team.teamLeader || '').trim())
            : '',
          role: '',
          online: true,
        });
        saveMembers();
        closeModal('modal-add-member');
        renderTeamPanel();
      }

      function runMembersApiThenRefresh(photoDataUrl) {
        fetch(apiBase, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            password: pw,
            team: team ? String((team.sectionTeam || '').trim() || (team.teamLeader || '').trim()) : '',
            photo: photoDataUrl != null ? photoDataUrl : null,
          }),
        })
          .then(function (res) {
            return res.text().then(function (text) {
              var j = null;
              try {
                j = text ? JSON.parse(text) : null;
              } catch (e) {
                j = null;
              }
              return { res: res, j: j };
            });
          })
          .then(function (o) {
            if (!o.res.ok || !o.j || !o.j.ok || !o.j.member) {
              rpbddAlertMessage(formatRpbddApiError(o.j, 'Could not save member'));
              return;
            }
            refreshMembersFromApi().then(function () {
              refreshTeamsFromApi().then(function () {
                closeModal('modal-add-member');
                renderTeamPanel();
              });
            });
          })
          .catch(function () {
            rpbddAlertMessage('Network error while saving member');
          });
      }

      if (apiBase) {
        if (file) {
          var readerA = new FileReader();
          readerA.onload = function () {
            runMembersApiThenRefresh(typeof readerA.result === 'string' ? readerA.result : null);
          };
          readerA.onerror = function () {
            rpbddAlertMessage('Could not read the image. Try another file.');
          };
          readerA.readAsDataURL(file);
        } else {
          runMembersApiThenRefresh(null);
        }
        return;
      }

      if (file) {
        var reader = new FileReader();
        reader.onload = function () {
          pushLocalMemberAndClose(typeof reader.result === 'string' ? reader.result : null);
        };
        reader.onerror = function () {
          rpbddAlertMessage('Could not read the image. Try another file.');
        };
        reader.readAsDataURL(file);
      } else {
        pushLocalMemberAndClose(null);
      }
    });

    document.querySelectorAll('.rpbdd-modal-overlay').forEach(function (ov) {
      ov.addEventListener('click', function (e) {
        if (e.target !== ov) return;
        if (ov.id === 'modal-rpbdd-confirm') {
          finishRpbddConfirm(false);
        } else if (ov.id === 'modal-rpbdd-alert') {
          ov.setAttribute('aria-hidden', 'true');
          ov.classList.remove('is-open');
        } else {
          if (ov.id === 'modal-add-team') resetAddTeamForm();
          else if (ov.id === 'modal-add-member') resetMemberForm();
          else if (ov.id === 'modal-account') setAccountModalDefaultLayout();
          ov.classList.remove('is-open');
        }
      });
    });

    (function bindRpbddConfirmModal() {
      var c = document.getElementById('modal-rpbdd-confirm');
      if (!c) return;
      c.querySelector('[data-confirm-ok]')?.addEventListener('click', function () {
        finishRpbddConfirm(true);
      });
      c.querySelector('[data-confirm-cancel]')?.addEventListener('click', function () {
        finishRpbddConfirm(false);
      });
    })();

    (function bindRpbddAlertModal() {
      var a = document.getElementById('modal-rpbdd-alert');
      if (!a) return;
      a.querySelector('[data-alert-ok]')?.addEventListener('click', function () {
        a.setAttribute('aria-hidden', 'true');
        closeModal('modal-rpbdd-alert');
      });
    })();

    (function bindTasksShell() {
      var shell = document.getElementById('rpbdd-tasks-shell');
      if (!shell || shell.dataset.rpbddTasksBound === '1') return;
      shell.dataset.rpbddTasksBound = '1';
      shell.addEventListener('click', function (e) {
        if (e.target.closest('#rpbdd-open-add-task')) {
          e.preventDefault();
          openModal('modal-add-task');
          return;
        }
        var tasksViewBtn = e.target.closest('[data-tasks-view]');
        if (tasksViewBtn) {
          e.preventDefault();
          var nextView = String(tasksViewBtn.getAttribute('data-tasks-view') || 'new').trim().toLowerCase();
          state.tasksView =
            nextView === 'done'
              ? 'done'
              : nextView === 'pending'
                ? 'pending'
                : nextView === 'review'
                  ? 'review'
                  : nextView === 'sent'
                    ? 'sent'
                    : 'new';
          renderTasksPanel();
          return;
        }
        var taskPag = e.target.closest('[data-tasks-panel-page]');
        if (taskPag) {
          e.preventDefault();
          var pn = parseInt(taskPag.getAttribute('data-tasks-panel-page'), 10) || 1;
          var v = String(state.tasksView || 'new').toLowerCase();
          if (v === 'done') state.tasksPageDone = pn;
          else if (v === 'pending') state.tasksPagePending = pn;
          else if (v === 'review') state.tasksPageReview = pn;
          else if (v === 'sent') state.tasksPageSent = pn;
          else state.tasksPageNew = pn;
          renderTasksPanel();
          return;
        }
        var openTaskEdit = e.target.closest('[data-task-open-edit]');
        if (openTaskEdit) {
          e.preventDefault();
          var editLid = parseInt(openTaskEdit.getAttribute('data-task-open-edit'), 10) || 0;
          if (editLid) {
            var listRow = tasksFindListById(editLid);
            if (listRow) tasksOpenEditTaskModal(listRow);
          }
          return;
        }
        var delListBtn = e.target.closest('[data-task-delete-list]');
        if (delListBtn) {
          e.preventDefault();
          e.stopPropagation();
          var delLid = parseInt(delListBtn.getAttribute('data-task-delete-list'), 10) || 0;
          var baseDel = getTasksApiBase();
          if (!delLid || !baseDel) return;
          var delSubmitted = String(delListBtn.getAttribute('data-task-delete-submitted') || '') === '1';
          openRpbddConfirm({
            variant: 'delete',
            title: 'Delete this task?',
            message: delSubmitted
              ? 'This task was already submitted. Deleting it permanently removes the checklist, all progress, and attachments for everyone.'
              : 'Permanently delete this task? Checklist lines, progress, and attachments will be removed for everyone.',
            confirmLabel: 'Delete task',
            cancelLabel: 'Cancel',
            danger: true,
          }).then(function (okDel) {
            if (!okDel) return;
            fetch(baseDel + '/delete-list', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: JSON.stringify({ listId: delLid }),
            })
              .then(function (r) {
                return r.text().then(function (t) {
                  var j = null;
                  try {
                    j = t ? JSON.parse(t) : null;
                  } catch (eDel) {
                    j = null;
                  }
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (oDel) {
                if (!oDel.ok || !oDel.j || !oDel.j.ok) {
                  rpbddAlertMessage((oDel.j && oDel.j.error) || 'Could not delete task.');
                  return;
                }
                if (state.expandedTaskListId === delLid) {
                  state.expandedTaskListId = null;
                }
                var editOv = document.getElementById('modal-edit-task');
                if (editOv && editOv.getAttribute('aria-hidden') === 'false') {
                  closeModal('modal-edit-task');
                }
                fetchTaskListsFromApi().then(function () {
                  renderTasksPanel();
                });
              })
              .catch(function () {
                rpbddAlertMessage('Network error while deleting task.');
              });
          });
          return;
        }
        if (e.target.closest('#rpbdd-tasks-edit-save')) {
          e.preventDefault();
          tasksSubmitEditTask();
          return;
        }
        if (e.target.closest('#rpbdd-tasks-edit-add-line')) {
          e.preventDefault();
          tasksAddDraftLine('rpbdd-tasks-edit-lines');
          return;
        }
        var closeTaskModalBtn = e.target.closest('[data-close-modal="modal-add-task"]');
        if (closeTaskModalBtn) {
          e.preventDefault();
          closeModal('modal-add-task');
          return;
        }
        if (e.target && e.target.id === 'modal-add-task') {
          e.preventDefault();
          closeModal('modal-add-task');
          return;
        }
        var closeEditModalBtn = e.target.closest('[data-close-modal="modal-edit-task"]');
        if (closeEditModalBtn) {
          e.preventDefault();
          closeModal('modal-edit-task');
          return;
        }
        if (e.target && e.target.id === 'modal-edit-task') {
          e.preventDefault();
          closeModal('modal-edit-task');
          return;
        }
        var closeNotesModalBtn = e.target.closest('[data-close-modal="modal-task-creator-notes"]');
        if (closeNotesModalBtn) {
          e.preventDefault();
          closeModal('modal-task-creator-notes');
          return;
        }
        if (e.target && e.target.id === 'modal-task-creator-notes') {
          e.preventDefault();
          closeModal('modal-task-creator-notes');
          return;
        }
        var editNotesTrg = e.target.closest('[data-task-edit-creator-notes]');
        if (editNotesTrg) {
          e.preventDefault();
          e.stopPropagation();
          var notesLid = parseInt(editNotesTrg.getAttribute('data-task-edit-creator-notes'), 10) || 0;
          if (notesLid) {
            var Lnotes = tasksFindListById(notesLid);
            if (Lnotes) tasksOpenCreatorNotesModal(Lnotes);
          }
          return;
        }
        if (e.target.closest('#rpbdd-tasks-notes-modal-save')) {
          e.preventDefault();
          tasksSubmitCreatorNotesModal();
          return;
        }
        var closeAttPrev = e.target.closest('[data-close-modal="modal-task-attachment-preview"]');
        if (closeAttPrev) {
          e.preventDefault();
          closeModal('modal-task-attachment-preview');
          return;
        }
        if (e.target && e.target.id === 'modal-task-attachment-preview') {
          e.preventDefault();
          closeModal('modal-task-attachment-preview');
          return;
        }
        var prevTrg = e.target.closest('.rpbdd-tasks-card-preview-trigger');
        if (prevTrg) {
          e.preventDefault();
          var plid = parseInt(prevTrg.getAttribute('data-task-preview-list'), 10) || 0;
          var pk = String(prevTrg.getAttribute('data-task-preview-kind') || 'other');
          var ptitle = prevTrg.getAttribute('data-task-preview-title') || '';
          var purl = prevTrg.getAttribute('data-task-preview-view-url') || '';
          var paid = parseInt(prevTrg.getAttribute('data-task-attachment-id'), 10) || 0;
          if (purl) {
            tasksOpenAttachmentPreviewModal(plid, pk, ptitle, purl, paid);
          }
          return;
        }
        var rmAllAtt = e.target.closest('[data-task-remove-all-attachments]');
        if (rmAllAtt) {
          e.preventDefault();
          var rawIds = String(rmAllAtt.getAttribute('data-task-remove-all-attachments') || '');
          var idList = rawIds
            .split(',')
            .map(function (s) {
              return parseInt(String(s).trim(), 10) || 0;
            })
            .filter(function (n) {
              return n > 0;
            });
          var baseRmAll = getTasksApiBase();
          if (!idList.length || !baseRmAll) return;
          openRpbddConfirm({
            variant: 'remove',
            title: 'Remove all attachments?',
            message:
              'All ' +
              idList.length +
              ' file(s) you attached on this checklist line will be permanently removed.',
            confirmLabel: 'Remove all',
            cancelLabel: 'Cancel',
            danger: true,
          }).then(function (okAll) {
            if (!okAll) return;
            var iDel = 0;
            var hadErr = false;
            function deleteNext() {
              if (iDel >= idList.length) {
                if (!hadErr) {
                  var prevAll = document.getElementById('modal-task-attachment-preview');
                  if (prevAll && prevAll.getAttribute('aria-hidden') === 'false') {
                    closeModal('modal-task-attachment-preview');
                  }
                }
                fetchTaskListsFromApi().then(function () {
                  renderTasksPanel();
                });
                return;
              }
              var oneId = idList[iDel];
              fetch(tasksAttachmentDeleteUrl(baseRmAll, oneId), {
                method: 'DELETE',
                credentials: 'same-origin',
              })
                .then(function (r) {
                  return r.text().then(function (text) {
                    var j = null;
                    try {
                      j = text ? JSON.parse(text) : null;
                    } catch (errA) {
                      j = null;
                    }
                    return { ok: r.ok, j: j };
                  });
                })
                .then(function (oRm) {
                  if (!oRm.ok || !oRm.j || !oRm.j.ok) {
                    hadErr = true;
                    rpbddAlertMessage((oRm.j && oRm.j.error) || 'Could not remove one or more attachments.');
                    fetchTaskListsFromApi().then(function () {
                      renderTasksPanel();
                    });
                    return;
                  }
                  iDel += 1;
                  deleteNext();
                })
                .catch(function () {
                  hadErr = true;
                  rpbddAlertMessage('Network error while removing attachments.');
                  fetchTaskListsFromApi().then(function () {
                    renderTasksPanel();
                  });
                });
            }
            deleteNext();
          });
          return;
        }
        var rmAtt = e.target.closest('[data-task-remove-attachment]');
        if (rmAtt) {
          e.preventDefault();
          var rmId = parseInt(rmAtt.getAttribute('data-task-remove-attachment'), 10) || 0;
          var baseRm = getTasksApiBase();
          if (!rmId || !baseRm) return;
          openRpbddConfirm({
            variant: 'remove',
            title: 'Remove attachment?',
            message: 'This file will be permanently removed from this checklist line.',
            confirmLabel: 'Remove',
            cancelLabel: 'Cancel',
            danger: true,
          }).then(function (okRm) {
            if (!okRm) return;
            fetch(tasksAttachmentDeleteUrl(baseRm, rmId), {
              method: 'DELETE',
              credentials: 'same-origin',
            })
              .then(function (r) {
                return r.text().then(function (text) {
                  var j = null;
                  try {
                    j = text ? JSON.parse(text) : null;
                  } catch (errRm) {
                    j = null;
                  }
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (oRm) {
                if (!oRm.ok || !oRm.j || !oRm.j.ok) {
                  rpbddAlertMessage((oRm.j && oRm.j.error) || 'Could not remove attachment.');
                  return;
                }
                var prevOv = document.getElementById('modal-task-attachment-preview');
                if (prevOv && prevOv.getAttribute('aria-hidden') === 'false') {
                  closeModal('modal-task-attachment-preview');
                }
                fetchTaskListsFromApi().then(function () {
                  renderTasksPanel();
                });
              })
              .catch(function () {
                rpbddAlertMessage('Network error while removing attachment.');
              });
          });
          return;
        }
        if (e.target.closest('#rpbdd-tasks-add-line')) {
          e.preventDefault();
          tasksAddDraftLine();
          return;
        }
        var rmDraft = e.target.closest('.rpbdd-tasks-line-remove');
        if (rmDraft) {
          e.preventDefault();
          var row = rmDraft.closest('.rpbdd-tasks-line-row');
          var wrap = row && row.closest('#rpbdd-tasks-lines, #rpbdd-tasks-edit-lines');
          if (!row || !wrap) return;
          var rows = wrap.querySelectorAll('.rpbdd-tasks-line-row');
          if (rows.length <= 1) {
            var onlyInput = row.querySelector('.rpbdd-tasks-line-input');
            if (onlyInput) {
              onlyInput.value = '';
              onlyInput.focus();
            }
            return;
          }
          var nextInput =
            (row.nextElementSibling && row.nextElementSibling.querySelector('.rpbdd-tasks-line-input')) ||
            (row.previousElementSibling && row.previousElementSibling.querySelector('.rpbdd-tasks-line-input'));
          row.remove();
          if (nextInput) nextInput.focus();
          return;
        }
        if (e.target.closest('#rpbdd-tasks-submit')) {
          e.preventDefault();
          tasksSubmitNewList();
          return;
        }
        var submitListBtn = e.target.closest('[data-task-submit-list]');
        if (submitListBtn) {
          e.preventDefault();
          var submitListId = parseInt(submitListBtn.getAttribute('data-task-submit-list'), 10) || 0;
          var allDoneAttr = String(submitListBtn.getAttribute('data-task-all-done') || '0');
          if (allDoneAttr !== '1') {
            tasksShowSubmitNotice();
            return;
          }
          if (submitListId > 0) tasksSubmitList(submitListId);
          return;
        }
        var expandTaskCard = e.target.closest('[data-expand-task-list]');
        if (expandTaskCard) {
          e.preventDefault();
          var listCardId = parseInt(expandTaskCard.getAttribute('data-expand-task-list'), 10) || 0;
          if (listCardId > 0) {
            var willCollapse = state.expandedTaskListId === listCardId;
            state.expandedTaskListId = willCollapse ? null : listCardId;
            if (!willCollapse) {
              var rowOpen = tasksFindListById(listCardId);
              var alreadyOpened =
                rowOpen &&
                rowOpen.assigneeOpenedAt != null &&
                String(rowOpen.assigneeOpenedAt).trim() !== '';
              if (
                rowOpen &&
                rowOpen.canToggle &&
                tasksMarkViewedApplies(rowOpen) &&
                !alreadyOpened
              ) {
                tasksMarkListViewed(listCardId);
              }
              markTaskNotificationsReadByListId(listCardId);
            }
            renderTasksPanel();
          }
          return;
        }
        var apprBtn = e.target.closest('[data-task-approve-list]');
        if (apprBtn) {
          e.preventDefault();
          var al = parseInt(apprBtn.getAttribute('data-task-approve-list'), 10) || 0;
          if (al) tasksApproveList(al);
          return;
        }
        var revBtn = e.target.closest('[data-task-request-revision-list]');
        if (revBtn) {
          e.preventDefault();
          var rl = parseInt(revBtn.getAttribute('data-task-request-revision-list'), 10) || 0;
          if (!rl) return;
          openRpbddConfirm({
            variant: 'neutral',
            title: 'Send back for revisions?',
            message:
              'The assignee will return to the Task tab, can update their work, and must submit again for your review.',
            confirmLabel: 'Send back',
            cancelLabel: 'Cancel',
            danger: false,
          }).then(function (confirmed) {
            if (confirmed) tasksRequestRevision(rl);
          });
          return;
        }
        var ed = e.target.closest('[data-task-edit-deadline]');
        if (ed) {
          e.preventDefault();
          var eid = parseInt(ed.getAttribute('data-task-edit-deadline'), 10);
          if (eid) tasksOpenDeadlineForm(eid);
          return;
        }
        var sv = e.target.closest('[data-task-save-deadline]');
        if (sv) {
          e.preventDefault();
          var sid = parseInt(sv.getAttribute('data-task-save-deadline'), 10);
          if (sid) tasksSaveListDeadline(sid);
          return;
        }
        var cx = e.target.closest('[data-task-cancel-deadline]');
        if (cx) {
          e.preventDefault();
          var cid = parseInt(cx.getAttribute('data-task-cancel-deadline'), 10);
          if (cid) tasksCloseDeadlineForm(cid);
        }
      });
      shell.addEventListener('change', function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('rpbdd-tasks-attach-input')) {
          var files = t.files ? Array.prototype.slice.call(t.files, 0) : [];
          var attachItemId = parseInt(t.getAttribute('data-task-attach-item'), 10) || 0;
          var rem = parseInt(t.getAttribute('data-task-attach-remaining'), 10);
          var baseA = getTasksApiBase();
          t.value = '';
          if (!files.length || !attachItemId || !baseA) {
            return;
          }
          if (!isNaN(rem) && rem >= 0 && files.length > rem) {
            if (rem === 0) {
              return;
            }
            rpbddAlertMessage(
              'Only the first ' + rem + ' file(s) will be uploaded (maximum per checklist line).'
            );
            files = files.slice(0, rem);
          }
          var idx = 0;
          var hadOk = false;
          function uploadNext() {
            if (idx >= files.length) {
              if (hadOk) {
                fetchTaskListsFromApi().then(function () {
                  renderTasksPanel();
                });
              }
              return;
            }
            var fd = new FormData();
            fd.append('itemId', String(attachItemId));
            fd.append('file', files[idx]);
            fetch(baseA + '/item-attachment', {
              method: 'POST',
              credentials: 'same-origin',
              body: fd,
            })
              .then(function (r) {
                return r.text().then(function (text) {
                  var j = null;
                  try {
                    j = text ? JSON.parse(text) : null;
                  } catch (err) {
                    j = null;
                  }
                  return { ok: r.ok, j: j };
                });
              })
              .then(function (o) {
                if (!o.ok || !o.j || !o.j.ok) {
                  rpbddAlertMessage((o.j && o.j.error) || 'Upload failed.');
                  if (hadOk) {
                    fetchTaskListsFromApi().then(function () {
                      renderTasksPanel();
                    });
                  }
                  return;
                }
                hadOk = true;
                idx += 1;
                uploadNext();
              })
              .catch(function () {
                rpbddAlertMessage('Network error while uploading.');
                if (hadOk) {
                  fetchTaskListsFromApi().then(function () {
                    renderTasksPanel();
                  });
                }
              });
          }
          uploadNext();
          return;
        }
        if (t && t.id === 'rpbdd-tasks-no-deadline') {
          tasksSyncDeadlineWrap();
          return;
        }
        if (t && t.id === 'rpbdd-tasks-edit-no-deadline') {
          tasksSyncEditDeadlineWrap();
          return;
        }
        if (t && t.classList && t.classList.contains('rpbdd-tasks-edit-no-deadline')) {
          var lid = parseInt(String(t.getAttribute('data-list-id') || ''), 10) || 0;
          if (lid) tasksSyncCardDeadlineInput(lid);
          return;
        }
        if (t && t.name === 'rpbdd-tasks-role') {
          tasksRefreshRecipientSelect();
          return;
        }
        if (t && t.name === 'rpbdd-tasks-edit-role') {
          tasksRefreshEditRecipientSelect();
          return;
        }
        var cb = e.target && e.target.closest ? e.target.closest('input.rpbdd-tasks-check[data-task-item]') : null;
        if (!cb || cb.disabled) return;
        var itemId = parseInt(cb.getAttribute('data-task-item'), 10);
        var done = !!cb.checked;
        var base = getTasksApiBase();
        if (!base || !itemId) return;
        fetch(base + '/toggle-item', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: itemId, done: done }),
        })
          .then(function (r) {
            return r.text().then(function (text) {
              var j = null;
              try {
                j = text ? JSON.parse(text) : null;
              } catch (err) {
                j = null;
              }
              return { ok: r.ok, j: j };
            });
          })
          .then(function (o) {
            if (!o.ok || !o.j || !o.j.ok) {
              cb.checked = !done;
              return;
            }
            var li = cb.closest('li');
            var sp = li && li.querySelector('.rpbdd-tasks-item-label');
            if (sp) sp.classList.toggle('is-done', done);
          })
          .catch(function () {
            cb.checked = !done;
          });
      });
    })();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (state.activeNav === 'events') {
        syncPastUserEventsToDone();
        renderEventsPanel();
      }
      if (state.activeNav === 'tasks' && getTasksApiBase()) {
        var beforeSnap = tasksSnapshotTaskListsForPoll(state.taskLists);
        fetchTaskListsFromApi().then(function (ok) {
          if (!ok || state.activeNav !== 'tasks') return;
          if (tasksSnapshotTaskListsForPoll(state.taskLists) !== beforeSnap) {
            renderTasksPanel();
          }
        });
      }
    });
  }

  function renderDateRows() {
    var wrap = document.getElementById('rpbdd-date-rows');
    if (!wrap) return;
    wrap.innerHTML = '';
    state.eventDates.forEach(function (d, index) {
      var row = document.createElement('div');
      row.className = 'rpbdd-date-row';
      var inp = document.createElement('input');
      inp.type = 'date';
      inp.className = 'rpbdd-input';
      inp.style.paddingLeft = '0.5rem';
      inp.id = 'add-event-date-' + index;
      inp.name = 'event_date[' + index + ']';
      inp.setAttribute('aria-labelledby', 'rpbdd-add-dates-label');
      inp.setAttribute('aria-label', 'Event date ' + (index + 1));
      inp.value = d;
      inp.addEventListener('change', function () {
        state.eventDates[index] = inp.value;
      });
      inp.addEventListener('input', function () {
        state.eventDates[index] = inp.value;
      });
      row.appendChild(inp);
      if (state.eventDates.length > 1) {
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.className = 'rpbdd-btn-sm';
        rm.style.background = '#fef2f2';
        rm.style.color = '#dc2626';
        rm.addEventListener('click', function () {
          state.eventDates.splice(index, 1);
          renderDateRows();
        });
        row.appendChild(rm);
      }
      wrap.appendChild(row);
    });
  }

  function renderEditEventDateRows() {
    var wrap = document.getElementById('rpbdd-edit-date-rows');
    if (!wrap) return;
    wrap.innerHTML = '';
    state.editEventDates.forEach(function (d, index) {
      var row = document.createElement('div');
      row.className = 'rpbdd-date-row';
      var inp = document.createElement('input');
      inp.type = 'date';
      inp.className = 'rpbdd-input';
      inp.style.paddingLeft = '0.5rem';
      inp.id = 'edit-event-date-' + index;
      inp.name = 'edit_event_date[' + index + ']';
      inp.setAttribute('aria-labelledby', 'rpbdd-edit-dates-label');
      inp.setAttribute('aria-label', 'Event date ' + (index + 1));
      inp.value = d;
      inp.addEventListener('change', function () {
        state.editEventDates[index] = inp.value;
      });
      inp.addEventListener('input', function () {
        state.editEventDates[index] = inp.value;
      });
      row.appendChild(inp);
      if (state.editEventDates.length > 1) {
        var rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.className = 'rpbdd-btn-sm';
        rm.style.background = '#fef2f2';
        rm.style.color = '#dc2626';
        rm.addEventListener('click', function () {
          state.editEventDates.splice(index, 1);
          renderEditEventDateRows();
        });
        row.appendChild(rm);
      }
      wrap.appendChild(row);
    });
  }

  function buildRecycleBinCardFromSnapshot(snap, recycleId, showRecycleActions, expandKey) {
    if (showRecycleActions === undefined) showRecycleActions = true;
    expandKey = expandKey || 'A' + String(recycleId);
    var expanded = state.expandedEventRecycleId === expandKey;
    var title = snap.title || '';
    var cat = snap.category || snap.Category || '';
    var col = categoryColor(cat);
    var datesArr = snap.dates;
    if (!datesArr && snap.dates_json) {
      try {
        datesArr = JSON.parse(snap.dates_json);
      } catch (e) {
        datesArr = [];
      }
    }
    if (!Array.isArray(datesArr)) datesArr = [];
    var dateLine = formatEventCardDatesLine(datesArr);
    var timeStr = String(snap.time_display || snap.time_raw || '').trim();
    var desc = String(snap.description || '').trim();
    var loc = String(snap.location || '').trim();
    var by = String(snap.input_by || '').trim();
    var h =
      '<div class="rpbdd-event-card rpbdd-event-card--recycle" style="--rpbdd-ev-accent:' +
      col +
      ';border-left:3px solid ' +
      col +
      ';">' +
      '<div class="rpbdd-event-card-head" data-expand-event-recycle-id="' +
      encodeURIComponent(expandKey) +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">' +
      '<div><div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem">' +
      '<span style="width:1rem;height:1rem;border-radius:50%;background:' +
      col +
      '"></span>' +
      '<strong>' +
      escapeHtml(title) +
      '</strong></div>' +
      '<div class="rpbdd-event-card-meta">';
    if (dateLine) h += escapeHtml(dateLine);
    if (timeStr) h += (dateLine ? ' · ' : '') + escapeHtml(timeStr);
    h +=
      '</div></div>' +
      '<span class="rpbdd-event-card-cat">' +
      escapeHtml(categoryLabelForDisplay(cat)) +
      '</span></div></div>';
    if (expanded) h += '<div class="rpbdd-event-card-body">';
    if (expanded && desc) {
      h +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Description</strong><br>' + escapeHtml(desc) + '</p>';
    }
    if (expanded && loc) {
      h += '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Location</strong><br>' + escapeHtml(loc) + '</p>';
    }
    if (expanded && by) {
      h += '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Input By</strong><br>' + escapeHtml(by) + '</p>';
    }
    var recAtEv = String(snap.recycled_at || '').trim();
    if (expanded && recAtEv) {
      h +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Removed</strong><br>' +
        escapeHtml(formatPhilippineRemovedDisplay(recAtEv)) +
        '</p>';
    }
    if (expanded) {
      h += '<p class="rpbdd-recycle-source-badge">rpbdd_monitoring_system · event_recycle</p>';
    }
    if (expanded && showRecycleActions) {
      h +=
        '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--restore" data-restore-recycle-id="' +
        recycleId +
        '">' +
        svgIconRestore +
        '<span>Restore</span></button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete" data-delete-recycle-id="' +
        recycleId +
        '">' +
        svgIconRemove +
        '<span>Delete</span></button>' +
        '</div>';
    }
    if (expanded) h += '</div>';
    h += '</div>';
    return h;
  }

  function buildRecycleBinCardFromLocal(ev, index, showRecycleActions, expandKey) {
    if (showRecycleActions === undefined) showRecycleActions = true;
    expandKey = expandKey || 'L' + String(index);
    var expanded = state.expandedEventRecycleId === expandKey;
    var title = ev.title || '';
    var cat = ev.category || '';
    var col = categoryColor(cat);
    var dateLine = formatEventCardDatesLine([ev.date]);
    var timeStr = String(ev.time || '').trim();
    var desc = String(ev.description || '').trim();
    var loc = String(ev.location || '').trim();
    var by = String(ev.createdBy || '').trim();
    var h =
      '<div class="rpbdd-event-card rpbdd-event-card--recycle" style="--rpbdd-ev-accent:' +
      col +
      ';border-left:3px solid ' +
      col +
      ';">' +
      '<div class="rpbdd-event-card-head" data-expand-event-recycle-id="' +
      encodeURIComponent(expandKey) +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem">' +
      '<div><div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem">' +
      '<span style="width:1rem;height:1rem;border-radius:50%;background:' +
      col +
      '"></span>' +
      '<strong>' +
      escapeHtml(title) +
      '</strong></div>' +
      '<div class="rpbdd-event-card-meta">';
    if (dateLine) h += escapeHtml(dateLine);
    if (timeStr) h += (dateLine ? ' · ' : '') + escapeHtml(timeStr);
    h +=
      '</div></div>' +
      '<span class="rpbdd-event-card-cat">' +
      escapeHtml(categoryLabelForDisplay(cat)) +
      '</span></div></div>';
    if (expanded) h += '<div class="rpbdd-event-card-body">';
    if (expanded && desc) {
      h +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Description</strong><br>' + escapeHtml(desc) + '</p>';
    }
    if (expanded && loc) {
      h += '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Location</strong><br>' + escapeHtml(loc) + '</p>';
    }
    if (expanded && by) {
      h += '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Input By</strong><br>' + escapeHtml(by) + '</p>';
    }
    if (expanded && showRecycleActions) {
      h +=
        '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--restore" data-restore-local-idx="' +
        index +
        '">' +
        svgIconRestore +
        '<span>Restore</span></button>' +
        '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete" data-delete-local-idx="' +
        index +
        '">' +
        svgIconRemove +
        '<span>Delete</span></button>' +
        '</div>';
    }
    if (expanded) h += '</div>';
    h += '</div>';
    return h;
  }

  function recycleCardTitleFromButton(btn) {
    var card = btn.closest('.rpbdd-event-card--recycle');
    var titleEl = card ? card.querySelector('strong') : null;
    return titleEl ? String(titleEl.textContent || '').trim() : 'This event';
  }

  /** add_new_event primary key for /recycle/:id routes (UUID string; not parseInt). */
  function canonicalEventRecycleApiId(row) {
    if (!row) return '';
    if (row.event_id != null && String(row.event_id).trim() !== '') return String(row.event_id).trim();
    if (row.id != null && String(row.id).trim() !== '') return String(row.id).trim();
    if (row.recycle_id != null && String(row.recycle_id).trim() !== '') return String(row.recycle_id).trim();
    return '';
  }

  function bindEventsRecycleBinExpandHandlers(el) {
    if (!el) return;
    el.querySelectorAll('[data-expand-event-recycle-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        var raw = node.getAttribute('data-expand-event-recycle-id') || '';
        var key = decodeURIComponent(raw);
        state.expandedEventRecycleId = state.expandedEventRecycleId === key ? null : key;
        renderRecycle();
      });
      node.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        node.click();
      });
    });
  }

  function attachRecycleBinHandlers(el, base) {
    el.querySelectorAll('[data-restore-recycle-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rid = String(btn.getAttribute('data-restore-recycle-id') || '').trim();
        if (!rid || !base) return;
        var titleLabel = recycleCardTitleFromButton(btn);
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore this event?',
          message: '“' + titleLabel + '” returns to your live events and calendar.',
          confirmLabel: 'Restore',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          fetch(base + '/recycle/' + encodeURIComponent(rid) + '/restore', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: '{}',
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (!res.ok || !res.row) {
                rpbddAlertMessage(formatRpbddApiError(res, 'Restore failed'));
                return;
              }
              state.events = state.events.concat(expandDbRow(res.row));
              saveEvents();
              renderRecycle();
              render();
              broadcastEventsChanged();
            })
            .catch(function () {
              rpbddAlertMessage('Network error');
            });
        });
      });
    });

    el.querySelectorAll('[data-delete-recycle-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rid = String(btn.getAttribute('data-delete-recycle-id') || '').trim();
        if (!rid || !base) return;
        var titleLabel = recycleCardTitleFromButton(btn);
        openRpbddConfirm({
          variant: 'delete',
          title: 'Delete permanently?',
          message: '“' + titleLabel + '” will be removed for good — not recoverable.',
          confirmLabel: 'Delete forever',
          cancelLabel: 'Cancel',
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          fetch(base + '/recycle/' + encodeURIComponent(rid), {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (!res.ok) {
                rpbddAlertMessage(formatRpbddApiError(res, 'Delete failed'));
                return;
              }
              renderRecycle();
              broadcastEventsChanged();
            })
            .catch(function () {
              rpbddAlertMessage('Network error');
            });
        });
      });
    });

    el.querySelectorAll('[data-restore-local-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-restore-local-idx'), 10);
        var ev = state.deletedEvents[i];
        if (!ev || ev.fromDb || ev.kind === 'dbRecycle') return;
        var titleLabel = String(ev.title || 'This event');
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore this event?',
          message: '“' + titleLabel + '” back to your list (saved on this device only).',
          confirmLabel: 'Restore',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          var restored = state.deletedEvents.splice(i, 1)[0];
          if (restored) state.events.push(restored);
          saveEvents();
          saveDeleted();
          renderRecycle();
          render();
        });
      });
    });

    el.querySelectorAll('[data-delete-local-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = parseInt(btn.getAttribute('data-delete-local-idx'), 10);
        var ev = state.deletedEvents[i];
        if (!ev || ev.fromDb || ev.kind === 'dbRecycle') return;
        var titleLabel = String(ev.title || 'This item');
        openRpbddConfirm({
          variant: 'delete',
          title: 'Delete permanently?',
          message: '“' + titleLabel + '” removed from this device’s bin — can’t undo.',
          confirmLabel: 'Delete forever',
          cancelLabel: 'Cancel',
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          state.deletedEvents.splice(i, 1);
          saveDeleted();
          renderRecycle();
        });
      });
    });
  }

  function clearLocalRecycleOnlyEntries() {
    state.deletedEvents = state.deletedEvents.filter(function (e) {
      return e.fromDb || e.kind === 'dbRecycle';
    });
    saveDeleted();
  }

  /** Move every device-only recycle entry back into live events. */
  function restoreAllLocalRecycleEntries() {
    var toRestore = [];
    state.deletedEvents.forEach(function (ev) {
      if (!ev.fromDb && ev.kind !== 'dbRecycle') {
        toRestore.push(ev);
      }
    });
    state.deletedEvents = state.deletedEvents.filter(function (e) {
      return e.fromDb || e.kind === 'dbRecycle';
    });
    toRestore.forEach(function (ev) {
      state.events.push(ev);
    });
    saveEvents();
    saveDeleted();
  }

  /** POST restore for each event_recycle row (sequential). */
  function restoreAllDbRecycleRows(base) {
    return fetch(base + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        if (!j || !j.ok || !Array.isArray(j.data) || j.data.length === 0) {
          return;
        }
        var ids = [];
        j.data.forEach(function (row) {
          var rid = canonicalEventRecycleApiId(row);
          if (rid) ids.push(rid);
        });
        return ids.reduce(function (p, id) {
          return p.then(function () {
            return fetch(base + '/recycle/' + encodeURIComponent(id) + '/restore', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: '{}',
            })
              .then(function (r) {
                return r.json();
              })
              .then(function (res) {
                if (res.ok && res.row) {
                  state.events = state.events.concat(expandDbRow(res.row));
                }
              });
          });
        }, Promise.resolve());
      })
      .then(function () {
        saveEvents();
        broadcastEventsChanged();
      });
  }

  /** DELETE each row in event_recycle via API (sequential). */
  function purgeAllDbRecycleRows(base) {
    return fetch(base + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        if (!j || !j.ok || !Array.isArray(j.data) || j.data.length === 0) {
          return;
        }
        var ids = [];
        j.data.forEach(function (row) {
          var rid = canonicalEventRecycleApiId(row);
          if (rid) ids.push(rid);
        });
        return ids.reduce(function (p, id) {
          return p.then(function () {
            return fetch(base + '/recycle/' + encodeURIComponent(id), {
              method: 'DELETE',
              credentials: 'same-origin',
              headers: { Accept: 'application/json' },
            }).then(function (r) {
              return r.json().catch(function () {
                return {};
              });
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        broadcastEventsChanged();
      });
  }

  function recycleBinPaintCurrentPage() {
    var el = document.getElementById('rpbdd-recycle-list');
    var pagEl = document.getElementById('rpbdd-recycle-pagination');
    if (!el) return;
    var parts = state.recycleBinRenderedParts;
    var hintPrefix = state.recycleBinHintPrefix || '';
    var base = state.recycleBinHandlersBase != null ? state.recycleBinHandlersBase : '';

    if (!parts || parts.length === 0) {
      el.innerHTML = hintPrefix + '<div class="rpbdd-placeholder">Recycle Bin is empty</div>';
      if (pagEl) {
        pagEl.hidden = true;
        pagEl.innerHTML = '';
      }
      syncEventsRecycleBinChrome();
      return;
    }

    var totalPages = Math.max(1, Math.ceil(parts.length / EVENTS_CARDS_PER_PAGE));
    if (state.recycleEventsPage > totalPages) state.recycleEventsPage = totalPages;
    if (state.recycleEventsPage < 1) state.recycleEventsPage = 1;

    var pageStart = (state.recycleEventsPage - 1) * EVENTS_CARDS_PER_PAGE;
    var pageParts = parts.slice(pageStart, pageStart + EVENTS_CARDS_PER_PAGE);

    el.innerHTML = hintPrefix + pageParts.join('');
    bindEventsRecycleBinExpandHandlers(el);
    attachRecycleBinHandlers(el, base);

    if (pagEl) {
      if (parts.length <= EVENTS_CARDS_PER_PAGE) {
        pagEl.hidden = true;
        pagEl.innerHTML = '';
      } else {
        pagEl.hidden = false;
        pagEl.innerHTML = '';
        for (var p = 1; p <= totalPages; p++) {
          var pb = document.createElement('button');
          pb.type = 'button';
          pb.textContent = String(p);
          pb.className = 'rpbdd-pill' + (p === state.recycleEventsPage ? ' is-active' : '');
          pb.setAttribute('aria-label', 'Page ' + p + ' of ' + totalPages);
          pb.addEventListener(
            'click',
            (function (pn) {
              return function () {
                state.recycleEventsPage = pn;
                recycleBinPaintCurrentPage();
              };
            })(p),
          );
          pagEl.appendChild(pb);
        }
      }
    }
    syncEventsRecycleBinChrome();
  }

  function renderRecycle() {
    var el = document.getElementById('rpbdd-recycle-list');
    var pagEl = document.getElementById('rpbdd-recycle-pagination');
    if (!el) return Promise.resolve();
    var base = getEventsApiBase();
    var canAct = roleCanManageEventsRecycle();
    var recycleReadonlyHint =
      '<div class="rpbdd-modal-muted" style="margin:0 0 1rem;font-size:0.85rem;line-height:1.45">' +
      'Removed events are listed below. Only an administrator can restore them or delete them permanently.' +
      '</div>';
    state.recycleBinHintPrefix = canAct ? '' : recycleReadonlyHint;

    function collectLocalRecycleParts() {
      var parts = [];
      state.deletedEvents.forEach(function (ev, index) {
        if (ev.fromDb || ev.kind === 'dbRecycle') return;
        parts.push(buildRecycleBinCardFromLocal(ev, index, canAct));
      });
      return parts;
    }

    el.innerHTML = '<div class="rpbdd-placeholder">Loading…</div>';
    if (pagEl) {
      pagEl.hidden = true;
      pagEl.innerHTML = '';
    }

    if (!base) {
      state.recycleBinRenderedParts = collectLocalRecycleParts();
      state.recycleBinHandlersBase = '';
      recycleBinPaintCurrentPage();
      return Promise.resolve();
    }

    return fetch(base + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(parseEventsApiResponse)
      .then(function (parsed) {
        var j = parsed.data;
        var apiRows = j && j.ok && Array.isArray(j.data) ? j.data : [];
        var parts = [];
        apiRows.forEach(function (row) {
          var rid = canonicalEventRecycleApiId(row);
          if (rid) parts.push(buildRecycleBinCardFromSnapshot(row, rid, canAct));
        });
        collectLocalRecycleParts().forEach(function (html) {
          parts.push(html);
        });
        state.recycleBinRenderedParts = parts;
        state.recycleBinHandlersBase = base;
        recycleBinPaintCurrentPage();
      })
      .catch(function () {
        var fallback = collectLocalRecycleParts();
        if (fallback.length > 0) {
          state.recycleBinRenderedParts = fallback;
          state.recycleBinHandlersBase = base;
          recycleBinPaintCurrentPage();
        } else {
          state.recycleBinRenderedParts = null;
        el.innerHTML =
            state.recycleBinHintPrefix + '<div class="rpbdd-placeholder">Could not load recycle list</div>';
          if (pagEl) {
            pagEl.hidden = true;
            pagEl.innerHTML = '';
          }
        syncEventsRecycleBinChrome();
        }
      });
  }

  function teamRecycleCardTitleFromButton(btn) {
    var card = btn.closest('.rpbdd-team-card--recycle');
    var titleEl = card ? card.querySelector('.rpbdd-team-card-head-title') : null;
    if (!titleEl) titleEl = card ? card.querySelector('strong') : null;
    return titleEl ? String(titleEl.textContent || '').trim() : 'This team';
  }

  /**
   * Teams Recycle Bin card — same shell / expand behavior as Total Teams cards; actions only when expanded.
   * @param {object} t Team row (same shape as state.teams)
   * @param {string} expandKey Key for state.expandedTeamRecycleId
   * @param {{ apiRecycleId?: number|null, localIndex?: number|null, recycledAt?: string }} opts
   */
  function renderRecycleTeamCardHtml(t, expandKey, opts) {
    opts = opts || {};
    var expanded = state.expandedTeamRecycleId === expandKey;
    var tid = String(t.id != null ? t.id : expandKey);
    var col = '#3b82f6';
    var cardGrad = 'rgba(59, 130, 246, 0.22)';
    var leadLine = (t.teamLeader || '').trim();
    var lead = leadLine ? escapeHtml(leadLine) : '—';
    var secRaw = (t.sectionTeam || '').trim();
    var posRaw = (t.position || '').trim();
    var sec = escapeHtml(secRaw);
    var pos = escapeHtml(posRaw);
    var headSectionLine = secRaw ? sec : '—';

    var pwPlain = typeof t.passwordPlain === 'string' ? t.passwordPlain : '';
    if (!pwPlain && t.password && String(t.password) !== '••••••••') {
      pwPlain = String(t.password);
    }
    var hasPw = (t.hasPassword && pwPlain !== '') || pwPlain !== '';
    var pwInputId = 'rpbdd-team-recycle-pw-' + String(expandKey).replace(/[^a-zA-Z0-9_-]/g, '_');

    var html = '';
    html +=
      '<div class="rpbdd-event-card rpbdd-team-card rpbdd-team-card--recycle" style="border-left:3px solid ' +
      col +
      ';background:linear-gradient(90deg,' +
      cardGrad +
      ',#e8ecf1 88%);">';
    html +=
      '<div class="rpbdd-event-card-head" data-expand-team-recycle-id="' +
      encodeURIComponent(expandKey) +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">';
    html += '<div class="rpbdd-team-card-head-row-inner" style="display:flex;align-items:center;gap:0.65rem;width:100%">';
    html += teamCardHeadPhotoHtml(t);
    html += '<div class="rpbdd-team-card-head-text" style="min-width:0;flex:1">';
    html +=
      '<strong class="rpbdd-team-card-head-title" style="display:block;margin-bottom:0.25rem">' + lead + '</strong>';
    html +=
      '<div class="rpbdd-team-card-head-sub" style="font-size:0.8rem;color:#475569">' +
      headSectionLine +
      '</div>';
    html += '</div>';
    html += '<span class="rpbdd-pill" style="margin-left:auto;white-space:nowrap">Section Chief</span>';
    html += '</div>';
    html += '</div>';

    if (expanded) {
      html += '<div class="rpbdd-event-card-body">';
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Lead ID</strong><br>' +
        escapeHtml(formatTeamCardField(teamLeadId(t))) +
        '</p>';
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Section Chief</strong><br>' +
        lead +
        '</p>';
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Email</strong><br>' +
        escapeHtml(formatTeamCardField(t.email)) +
        '</p>';
      html += '<p style="font-size:0.75rem;margin:0 0 0.35rem"><strong>Password</strong></p>';
      if (hasPw) {
        html += '<div class="rpbdd-input-wrap rpbdd-input-wrap--modal-pw rpbdd-input-wrap--card-pw" style="margin:0 0 0.5rem">';
        html +=
          '<svg class="rpbdd-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        html +=
          '<input class="rpbdd-input rpbdd-input--simple rpbdd-input--pr" type="password" readonly id="' +
          pwInputId +
          '" value="' +
          escapeHtml(pwPlain) +
          '">';
        html +=
          '<button type="button" class="rpbdd-toggle-pw" data-toggle-password="' +
          pwInputId +
          '" aria-label="Show password" aria-pressed="false">';
        html +=
          '<span class="rpbdd-toggle-pw__icon rpbdd-toggle-pw__icon--masked" aria-hidden="true">' +
          svgPwToggleMasked +
          '</span>';
        html +=
          '<span class="rpbdd-toggle-pw__icon rpbdd-toggle-pw__icon--visible" aria-hidden="true" hidden>' +
          svgPwToggleVisible +
          '</span>';
        html += '</button></div>';
      } else {
        html += '<p style="font-size:0.75rem;margin:0 0 0.5rem;color:#64748b">—</p>';
      }
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Section Team</strong><br>' +
        sec +
        '</p>';
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Position</strong><br>' +
        pos +
        '</p>';
      var memMain = formatTeamMembersListHtml(t);
      var memExtra = '';
      var mc = t.memberCount;
      if (mc != null && mc !== '' && !isNaN(Number(mc))) {
        var mcNum = Number(mc);
        var nameLen = Array.isArray(t.memberNames) ? t.memberNames.length : 0;
        if (nameLen === 0 && mcNum > 0) {
          memExtra =
            '<br><span style="color:#64748b;font-size:0.7rem">Saved member count: ' +
            escapeHtml(String(mcNum)) +
            '</span>';
        } else if (nameLen > 0 && nameLen !== mcNum) {
          memExtra =
            '<br><span style="color:#64748b;font-size:0.7rem">Saved count: ' +
            escapeHtml(String(mcNum)) +
            '</span>';
        }
      }
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Members</strong><br>' +
        memMain +
        memExtra +
        '</p>';
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Status</strong><br>' +
        escapeHtml(t.online ? 'Active' : 'Inactive') +
        '</p>';
      if (opts.recycledAt && String(opts.recycledAt).trim() !== '') {
        html +=
          '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Removed</strong><br>' +
          escapeHtml(formatPhilippineRemovedDisplay(opts.recycledAt)) +
          '</p>';
      }
      html +=
        '<p class="rpbdd-recycle-source-badge" style="margin:0.35rem 0 0.65rem">' +
        (opts.localIndex != null
          ? 'This device only'
          : 'rpbdd_monitoring_system · team_recycle') +
        '</p>';
      html +=
        '<div class="rpbdd-team-card-actions" style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.25rem;flex-wrap:wrap">';
      if (opts.apiRecycleId != null) {
        html +=
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--restore" data-team-restore-recycle-id="' +
          opts.apiRecycleId +
          '">' +
          svgIconRestore +
          '<span>Restore</span></button>' +
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete" data-team-delete-recycle-id="' +
          opts.apiRecycleId +
          '">' +
          svgIconRemove +
          '<span>Delete</span></button>';
      } else if (opts.localIndex != null) {
        html +=
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--restore" data-team-restore-local-idx="' +
          opts.localIndex +
          '">' +
          svgIconRestore +
          '<span>Restore</span></button>' +
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete" data-team-delete-local-idx="' +
          opts.localIndex +
          '">' +
          svgIconRemove +
          '<span>Delete</span></button>';
      }
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildTeamRecycleCardFromApi(row) {
    var rid = parseInt(row.recycle_id || row.id, 10);
    if (!rid) return '';
    var tm = row.team || row;
    var expandKey = String(rid);
    return renderRecycleTeamCardHtml(tm, expandKey, {
      apiRecycleId: rid,
      recycledAt: row.recycled_at || '',
    });
  }

  function buildTeamRecycleCardFromLocal(team, index) {
    var expandKey = 'L' + index;
    return renderRecycleTeamCardHtml(team, expandKey, { localIndex: index });
  }

  function bindTeamsRecycleBinExpandHandlers(el) {
    if (!el) return;
    el.querySelectorAll('[data-expand-team-recycle-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        var raw = node.getAttribute('data-expand-team-recycle-id') || '';
        var key = decodeURIComponent(raw);
        state.expandedTeamRecycleId = state.expandedTeamRecycleId === key ? null : key;
        renderTeamsRecycle();
      });
      node.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        node.click();
      });
    });
  }

  function attachTeamsRecycleBinHandlers(el, base) {
    el.querySelectorAll('[data-team-restore-recycle-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = parseInt(btn.getAttribute('data-team-restore-recycle-id'), 10);
        if (!rid || !base) return;
        var titleLabel = teamRecycleCardTitleFromButton(btn);
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore this team?',
          message: '“' + titleLabel + '” returns to Total Teams.',
          confirmLabel: 'Restore',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          fetch(base + '/recycle/' + rid + '/restore', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: '{}',
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (!res.ok) {
                rpbddAlertMessage(formatRpbddApiError(res, 'Restore failed'));
                return;
              }
              refreshTeamsFromApi().then(function () {
                renderTeamPanel();
                renderTeamsRecycle();
              });
            })
            .catch(function () {
              rpbddAlertMessage('Network error');
            });
        });
      });
    });

    el.querySelectorAll('[data-team-delete-recycle-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = parseInt(btn.getAttribute('data-team-delete-recycle-id'), 10);
        if (!rid || !base) return;
        var titleLabel = teamRecycleCardTitleFromButton(btn);
        openRpbddConfirm({
          variant: 'delete',
          title: 'Delete permanently?',
          message: '“' + titleLabel + '” will be removed for good — not recoverable.',
          confirmLabel: 'Delete forever',
          cancelLabel: 'Cancel',
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          fetch(base + '/recycle/' + rid, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (!res.ok) {
                rpbddAlertMessage(formatRpbddApiError(res, 'Delete failed'));
                return;
              }
              renderTeamsRecycle();
            })
            .catch(function () {
              rpbddAlertMessage('Network error');
            });
        });
      });
    });

    el.querySelectorAll('[data-team-restore-local-idx]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var i = parseInt(btn.getAttribute('data-team-restore-local-idx'), 10);
        var tm = state.deletedTeams[i];
        if (!tm) return;
        var titleLabel = String(tm.teamLeader || tm.email || 'This team');
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore this team?',
          message: '“' + titleLabel + '” back to Total Teams (saved on this device only).',
          confirmLabel: 'Restore',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          var restored = state.deletedTeams.splice(i, 1)[0];
          if (restored) state.teams.push(restored);
          saveTeams();
          saveDeletedTeams();
          renderTeamsRecycle();
          renderTeamPanel();
        });
      });
    });

    el.querySelectorAll('[data-team-delete-local-idx]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var i = parseInt(btn.getAttribute('data-team-delete-local-idx'), 10);
        var tm = state.deletedTeams[i];
        if (!tm) return;
        var titleLabel = String(tm.teamLeader || tm.email || 'This item');
        openRpbddConfirm({
          variant: 'delete',
          title: 'Delete permanently?',
          message: '“' + titleLabel + '” removed from this device’s bin — can’t undo.',
          confirmLabel: 'Delete forever',
          cancelLabel: 'Cancel',
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          state.deletedTeams.splice(i, 1);
          saveDeletedTeams();
          renderTeamsRecycle();
        });
      });
    });

    bindTeamsRecycleBinExpandHandlers(el);
    if (typeof window.rpbddSyncPasswordToggles === 'function') {
      window.rpbddSyncPasswordToggles(el);
    }
  }

  function clearTeamsLocalRecycleOnly() {
    state.deletedTeams = [];
    saveDeletedTeams();
  }

  function restoreAllTeamsLocalRecycleEntries() {
    var toRestore = state.deletedTeams.slice();
    state.deletedTeams = [];
    toRestore.forEach(function (t) {
      state.teams.push(t);
    });
    saveTeams();
    saveDeletedTeams();
  }

  function restoreAllTeamsDbRecycleRows(apiBase) {
    return fetch(apiBase + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.data) || j.data.length === 0) {
          return;
        }
        var ids = [];
        j.data.forEach(function (row) {
          var rid = parseInt(row.recycle_id || row.id, 10);
          if (rid) ids.push(rid);
        });
        return ids.reduce(function (p, id) {
          return p.then(function () {
            return fetch(apiBase + '/recycle/' + id + '/restore', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: '{}',
            }).then(function (r) {
              return r.json();
            });
          });
        }, Promise.resolve());
      });
  }

  function purgeAllTeamsDbRecycleRows(apiBase) {
    return fetch(apiBase + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.data) || j.data.length === 0) {
          return;
        }
        var ids = [];
        j.data.forEach(function (row) {
          var rid = parseInt(row.recycle_id || row.id, 10);
          if (rid) ids.push(rid);
        });
        return ids.reduce(function (p, id) {
          return p.then(function () {
            return fetch(apiBase + '/recycle/' + id, {
              method: 'DELETE',
              credentials: 'same-origin',
              headers: { Accept: 'application/json' },
            }).then(function (r) {
              return r.json().catch(function () {
                return {};
              });
            });
          });
        }, Promise.resolve());
      });
  }

  function renderTeamsRecycle() {
    var el = document.getElementById('rpbdd-teams-recycle-list');
    if (!el) return Promise.resolve();

    function collectLocalTeamRecycleParts() {
      var parts = [];
      state.deletedTeams.forEach(function (t, index) {
        parts.push(buildTeamRecycleCardFromLocal(t, index));
      });
      return parts;
    }

    el.innerHTML = '<div class="rpbdd-placeholder">Loading…</div>';
    var base = getTeamsApiBase();

    if (!base) {
      var localOnly = collectLocalTeamRecycleParts();
      if (localOnly.length === 0) {
        el.innerHTML = '<div class="rpbdd-placeholder">Recycle Bin is empty</div>';
        return Promise.resolve();
      }
      el.innerHTML = '<div class="rpbdd-recycle-bin-list">' + localOnly.join('') + '</div>';
      attachTeamsRecycleBinHandlers(el, '');
      return Promise.resolve();
    }

    return fetch(base + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        var apiRows = j && j.ok && Array.isArray(j.data) ? j.data : [];
        var parts = [];
        apiRows.forEach(function (row) {
          var card = buildTeamRecycleCardFromApi(row);
          if (card) parts.push(card);
        });
        collectLocalTeamRecycleParts().forEach(function (html) {
          parts.push(html);
        });
        if (parts.length === 0) {
          el.innerHTML = '<div class="rpbdd-placeholder">Recycle Bin is empty</div>';
          return;
        }
        el.innerHTML = '<div class="rpbdd-recycle-bin-list">' + parts.join('') + '</div>';
        attachTeamsRecycleBinHandlers(el, base);
      })
      .catch(function () {
        var fallback = collectLocalTeamRecycleParts();
        el.innerHTML =
          fallback.length > 0
            ? '<div class="rpbdd-recycle-bin-list">' + fallback.join('') + '</div>'
            : '<div class="rpbdd-placeholder">Could not load recycle list</div>';
        attachTeamsRecycleBinHandlers(el, base);
      });
  }

  function memberRecycleCardTitleFromButton(btn) {
    var card = btn.closest('.rpbdd-member-recycle-card');
    var titleEl = card ? card.querySelector('.rpbdd-team-card-head-title') : null;
    if (!titleEl) titleEl = card ? card.querySelector('strong') : null;
    return titleEl ? String(titleEl.textContent || '').trim() : 'This member';
  }

  /**
   * Members Recycle Bin card — same shell / expand behavior as Total Members cards.
   * @param {object} m Member row (same shape as state.teamMembers)
   * @param {string} expandKey Key for state.expandedMemberRecycleId
   * @param {{ apiRecycleId?: number|null, localIndex?: number|null, recycledAt?: string }} opts
   */
  function renderRecycleMemberCardHtml(m, expandKey, opts) {
    opts = opts || {};
    var expanded = state.expandedMemberRecycleId === expandKey;
    var mid = String(m.id != null ? m.id : expandKey);
    var isLeaderRow = mid.indexOf('leader-') === 0;
    var col = isLeaderRow ? '#3b82f6' : 'var(--rp-green)';
    var cardGrad = isLeaderRow ? 'rgba(59, 130, 246, 0.22)' : 'rgba(46, 125, 50, 0.22)';
    var nameLine = memberDisplayLabel(m).trim();
    var nameDisp = nameLine ? escapeHtml(nameLine) : '—';
    var teamRaw = String(m.team || '').trim();
    var teamDisp = teamRaw ? escapeHtml(teamRaw) : '—';
    var headSub = teamRaw ? teamDisp : '—';
    var statusLabel = m.online ? 'Active' : 'Inactive';
    var pwPlain = typeof m.passwordPlain === 'string' ? m.passwordPlain : '';
    if (!pwPlain && m.password && String(m.password) !== '••••••••') {
      pwPlain = String(m.password);
    }
    var hasPw = (m.hasPassword && pwPlain !== '') || pwPlain !== '';
    var pwInputId = 'rpbdd-member-recycle-pw-' + String(expandKey).replace(/[^a-zA-Z0-9_-]/g, '_');
    var teamRec = resolveTeamRecordForMember(m);
    var leadIdLine = isLeaderRow && teamRec ? teamLeadId(teamRec) : '';
    var leaderFieldLine = '—';
    if (teamRec && String(teamRec.teamLeader || '').trim()) {
      leaderFieldLine = escapeHtml(String(teamRec.teamLeader).trim());
    } else if (isLeaderRow) {
      leaderFieldLine = nameDisp;
    }
    var secExpanded =
      teamRec != null
        ? escapeHtml(formatTeamCardField(teamRec.sectionTeam))
        : teamRaw
          ? teamDisp
          : '—';
    var pillLabel = isLeaderRow ? 'Section Chief' : 'Member';

    var html = '';
    var memberCardClass =
      'rpbdd-event-card rpbdd-team-card rpbdd-member-card rpbdd-member-recycle-card' +
      (isLeaderRow ? ' rpbdd-member-card--active-leader' : '');
    html +=
      '<div class="' +
      memberCardClass +
      '" style="border-left:3px solid ' +
      col +
      ';background:linear-gradient(90deg,' +
      cardGrad +
      ',#e8ecf1 88%);">';
    html +=
      '<div class="rpbdd-event-card-head" data-expand-member-recycle-id="' +
      encodeURIComponent(expandKey) +
      '" role="button" tabindex="0" aria-expanded="' +
      (expanded ? 'true' : 'false') +
      '">';
    html += '<div class="rpbdd-team-card-head-row-inner" style="display:flex;align-items:center;gap:0.65rem;width:100%">';
    html += memberCardHeadPhotoHtml(m);
    html += '<div class="rpbdd-team-card-head-text" style="min-width:0;flex:1">';
    html +=
      '<strong class="rpbdd-team-card-head-title" style="display:block;margin-bottom:0.25rem">' + nameDisp + '</strong>';
    html +=
      '<div class="rpbdd-team-card-head-sub" style="font-size:0.8rem;color:#475569">' +
      headSub +
      '</div>';
    html += '</div>';
    html +=
      '<span class="rpbdd-pill" style="margin-left:auto;white-space:nowrap">' + pillLabel + '</span>';
    html += '</div>';
    html += '</div>';

    if (expanded) {
      html += '<div class="rpbdd-event-card-body">';
      if (isLeaderRow) {
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Lead ID</strong><br>' +
        escapeHtml(leadIdLine || '—') +
        '</p>';
      }
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Section Chief</strong><br>' +
        leaderFieldLine +
        '</p>';
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Email</strong><br>' +
        escapeHtml(String(m.email || '').trim() || '—') +
        '</p>';
      html += '<p style="font-size:0.75rem;margin:0 0 0.35rem"><strong>Password</strong></p>';
      if (hasPw) {
        html += '<div class="rpbdd-input-wrap rpbdd-input-wrap--modal-pw rpbdd-input-wrap--card-pw" style="margin:0 0 0.5rem">';
        html +=
          '<svg class="rpbdd-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        html +=
          '<input class="rpbdd-input rpbdd-input--simple rpbdd-input--pr" type="password" readonly id="' +
          pwInputId +
          '" value="' +
          escapeHtml(pwPlain) +
          '">';
        html +=
          '<button type="button" class="rpbdd-toggle-pw" data-toggle-password="' +
          pwInputId +
          '" aria-label="Show password" aria-pressed="false">';
        html +=
          '<span class="rpbdd-toggle-pw__icon rpbdd-toggle-pw__icon--masked" aria-hidden="true">' +
          svgPwToggleMasked +
          '</span>';
        html +=
          '<span class="rpbdd-toggle-pw__icon rpbdd-toggle-pw__icon--visible" aria-hidden="true" hidden>' +
          svgPwToggleVisible +
          '</span>';
        html += '</button></div>';
      } else {
        html += '<p style="font-size:0.75rem;margin:0 0 0.5rem;color:#64748b">—</p>';
      }
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Section Team</strong><br>' +
        secExpanded +
        '</p>';
      var memMain = formatTeamMembersListHtml(teamRec);
      var memExtra = '';
      if (teamRec) {
        var mc = teamRec.memberCount;
        if (mc != null && mc !== '' && !isNaN(Number(mc))) {
          var mcNum = Number(mc);
          var nameLen = Array.isArray(teamRec.memberNames) ? teamRec.memberNames.length : 0;
          if (nameLen === 0 && mcNum > 0) {
            memExtra =
              '<br><span style="color:#64748b;font-size:0.7rem">Saved member count: ' +
              escapeHtml(String(mcNum)) +
              '</span>';
          } else if (nameLen > 0 && nameLen !== mcNum) {
            memExtra =
              '<br><span style="color:#64748b;font-size:0.7rem">Saved count: ' +
              escapeHtml(String(mcNum)) +
              '</span>';
          }
        }
      }
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Members</strong><br>' +
        memMain +
        memExtra +
        '</p>';
      html +=
        '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Status</strong><br>' +
        escapeHtml(statusLabel) +
        '</p>';
      if (opts.recycledAt && String(opts.recycledAt).trim() !== '') {
        html +=
          '<p style="font-size:0.75rem;margin:0 0 0.5rem"><strong>Removed</strong><br>' +
          escapeHtml(formatPhilippineRemovedDisplay(opts.recycledAt)) +
          '</p>';
      }
      html +=
        '<p class="rpbdd-recycle-source-badge" style="margin:0.35rem 0 0.65rem">' +
        (opts.localIndex != null
          ? 'This device only'
          : 'rpbdd_monitoring_system · member_recycle') +
        '</p>';
      html +=
        '<div class="rpbdd-team-card-actions" style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.25rem;flex-wrap:wrap">';
      if (opts.apiRecycleId != null) {
        html +=
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--restore" data-member-restore-recycle-id="' +
          opts.apiRecycleId +
          '">' +
          svgIconRestore +
          '<span>Restore</span></button>' +
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete" data-member-delete-recycle-id="' +
          opts.apiRecycleId +
          '">' +
          svgIconRemove +
          '<span>Delete</span></button>';
      } else if (opts.localIndex != null) {
        html +=
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--restore" data-member-restore-local-idx="' +
          opts.localIndex +
          '">' +
          svgIconRestore +
          '<span>Restore</span></button>' +
          '<button type="button" class="rpbdd-btn-sm rpbdd-btn-action--delete" data-member-delete-local-idx="' +
          opts.localIndex +
          '">' +
          svgIconRemove +
          '<span>Delete</span></button>';
      }
      html += '</div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildMemberRecycleCardFromApi(row) {
    var rid = parseInt(row.recycle_id || row.id, 10);
    if (!rid) return '';
    var tm = row.member || row;
    var expandKey = String(rid);
    return renderRecycleMemberCardHtml(tm, expandKey, {
      apiRecycleId: rid,
      recycledAt: row.recycled_at || '',
    });
  }

  function buildMemberRecycleCardFromLocal(member, index) {
    var expandKey = 'L' + index;
    return renderRecycleMemberCardHtml(member, expandKey, { localIndex: index });
  }

  function bindMembersRecycleBinExpandHandlers(el) {
    if (!el) return;
    el.querySelectorAll('[data-expand-member-recycle-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        var raw = node.getAttribute('data-expand-member-recycle-id') || '';
        var key = decodeURIComponent(raw);
        state.expandedMemberRecycleId = state.expandedMemberRecycleId === key ? null : key;
        renderMembersRecycle();
      });
      node.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        node.click();
      });
    });
  }

  function attachMembersRecycleBinHandlers(el, base) {
    el.querySelectorAll('[data-member-restore-recycle-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = parseInt(btn.getAttribute('data-member-restore-recycle-id'), 10);
        if (!rid || !base) return;
        var titleLabel = memberRecycleCardTitleFromButton(btn);
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore this member?',
          message: '“' + titleLabel + '” returns to Total Members.',
          confirmLabel: 'Restore',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          fetch(base + '/recycle/' + rid + '/restore', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: '{}',
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (!res.ok) {
                rpbddAlertMessage(formatRpbddApiError(res, 'Restore failed'));
                return;
              }
              refreshMembersFromApi().then(function () {
                renderTeamPanel();
                renderMembersRecycle();
              });
            })
            .catch(function () {
              rpbddAlertMessage('Network error');
            });
        });
      });
    });

    el.querySelectorAll('[data-member-delete-recycle-id]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var rid = parseInt(btn.getAttribute('data-member-delete-recycle-id'), 10);
        if (!rid || !base) return;
        var titleLabel = memberRecycleCardTitleFromButton(btn);
        openRpbddConfirm({
          variant: 'delete',
          title: 'Delete permanently?',
          message: '“' + titleLabel + '” will be removed for good — not recoverable.',
          confirmLabel: 'Delete forever',
          cancelLabel: 'Cancel',
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          fetch(base + '/recycle/' + rid, {
            method: 'DELETE',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
          })
            .then(function (r) {
              return r.json();
            })
            .then(function (res) {
              if (!res.ok) {
                rpbddAlertMessage(formatRpbddApiError(res, 'Delete failed'));
                return;
              }
              renderMembersRecycle();
            })
            .catch(function () {
              rpbddAlertMessage('Network error');
            });
        });
      });
    });

    el.querySelectorAll('[data-member-restore-local-idx]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var i = parseInt(btn.getAttribute('data-member-restore-local-idx'), 10);
        var mem = state.deletedMembers[i];
        if (!mem) return;
        var titleLabel = String(memberDisplayLabel(mem) || mem.email || 'This member');
        openRpbddConfirm({
          variant: 'restore',
          title: 'Restore this member?',
          message: '“' + titleLabel + '” back to Total Members (saved on this device only).',
          confirmLabel: 'Restore',
          cancelLabel: 'Cancel',
          danger: false,
        }).then(function (ok) {
          if (!ok) return;
          var restored = state.deletedMembers.splice(i, 1)[0];
          if (restored) state.teamMembers.push(restored);
          saveMembers();
          saveDeletedMembers();
          renderMembersRecycle();
          renderTeamPanel();
        });
      });
    });

    el.querySelectorAll('[data-member-delete-local-idx]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var i = parseInt(btn.getAttribute('data-member-delete-local-idx'), 10);
        var mem = state.deletedMembers[i];
        if (!mem) return;
        var titleLabel = String(memberDisplayLabel(mem) || mem.email || 'This item');
        openRpbddConfirm({
          variant: 'delete',
          title: 'Delete permanently?',
          message: '“' + titleLabel + '” removed from this device’s bin — can’t undo.',
          confirmLabel: 'Delete forever',
          cancelLabel: 'Cancel',
          danger: true,
        }).then(function (ok) {
          if (!ok) return;
          state.deletedMembers.splice(i, 1);
          saveDeletedMembers();
          renderMembersRecycle();
        });
      });
    });

    bindMembersRecycleBinExpandHandlers(el);
    if (typeof window.rpbddSyncPasswordToggles === 'function') {
      window.rpbddSyncPasswordToggles(el);
    }
  }

  function clearMembersLocalRecycleOnly() {
    state.deletedMembers = [];
    saveDeletedMembers();
  }

  function restoreAllMembersLocalRecycleEntries() {
    var toRestore = state.deletedMembers.slice();
    state.deletedMembers = [];
    toRestore.forEach(function (m) {
      state.teamMembers.push(m);
    });
    saveMembers();
    saveDeletedMembers();
  }

  function restoreAllMembersDbRecycleRows(apiBase) {
    return fetch(apiBase + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.data) || j.data.length === 0) {
          return;
        }
        var ids = [];
        j.data.forEach(function (row) {
          var rid = parseInt(row.recycle_id || row.id, 10);
          if (rid) ids.push(rid);
        });
        return ids.reduce(function (p, id) {
          return p.then(function () {
            return fetch(apiBase + '/recycle/' + id + '/restore', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
              body: '{}',
            }).then(function (r) {
              return r.json();
            });
          });
        }, Promise.resolve());
      });
  }

  function purgeAllMembersDbRecycleRows(apiBase) {
    return fetch(apiBase + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok || !Array.isArray(j.data) || j.data.length === 0) {
          return;
        }
        var ids = [];
        j.data.forEach(function (row) {
          var rid = parseInt(row.recycle_id || row.id, 10);
          if (rid) ids.push(rid);
        });
        return ids.reduce(function (p, id) {
          return p.then(function () {
            return fetch(apiBase + '/recycle/' + id, {
              method: 'DELETE',
              credentials: 'same-origin',
              headers: { Accept: 'application/json' },
            }).then(function (r) {
              return r.json().catch(function () {
                return {};
              });
            });
          });
        }, Promise.resolve());
      });
  }

  function renderMembersRecycle() {
    var el = document.getElementById('rpbdd-members-recycle-list');
    if (!el) return Promise.resolve();

    function collectLocalMemberRecycleParts() {
      var parts = [];
      state.deletedMembers.forEach(function (m, index) {
        parts.push(buildMemberRecycleCardFromLocal(m, index));
      });
      return parts;
    }

    el.innerHTML = '<div class="rpbdd-placeholder">Loading…</div>';
    var base = getMembersApiBase();

    if (!base) {
      var localOnlyM = collectLocalMemberRecycleParts();
      if (localOnlyM.length === 0) {
        el.innerHTML = '<div class="rpbdd-placeholder">Recycle Bin is empty</div>';
        return Promise.resolve();
      }
      el.innerHTML = '<div class="rpbdd-recycle-bin-list">' + localOnlyM.join('') + '</div>';
      attachMembersRecycleBinHandlers(el, '');
      return Promise.resolve();
    }

    return fetch(base + '/recycled', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        var apiRows = j && j.ok && Array.isArray(j.data) ? j.data : [];
        var partsM = [];
        apiRows.forEach(function (row) {
          var cardM = buildMemberRecycleCardFromApi(row);
          if (cardM) partsM.push(cardM);
        });
        collectLocalMemberRecycleParts().forEach(function (html) {
          partsM.push(html);
        });
        if (partsM.length === 0) {
          el.innerHTML = '<div class="rpbdd-placeholder">Recycle Bin is empty</div>';
          return;
        }
        el.innerHTML = '<div class="rpbdd-recycle-bin-list">' + partsM.join('') + '</div>';
        attachMembersRecycleBinHandlers(el, base);
      })
      .catch(function () {
        var fallbackM = collectLocalMemberRecycleParts();
        el.innerHTML =
          fallbackM.length > 0
            ? '<div class="rpbdd-recycle-bin-list">' + fallbackM.join('') + '</div>'
            : '<div class="rpbdd-placeholder">Could not load recycle list</div>';
        attachMembersRecycleBinHandlers(el, base);
      });
  }

  function init() {
    readAppConfig();
    var jsonEl = document.getElementById('rpbdd-user-json');
    if (jsonEl) {
      try {
        state.currentUser = JSON.parse(jsonEl.textContent || '{}');
      } catch (e) {
        state.currentUser = {};
      }
    }
    try {
      var q = new URLSearchParams(window.location.search || '');
      if (!state.currentUser) state.currentUser = {};
      var qEmail = String(q.get('email') || '').trim();
      var qName = String(q.get('name') || '').trim();
      var qRole = String(q.get('role') || '').trim();
      var qTeam = String(q.get('team') || '').trim();
      if (qEmail) state.currentUser.email = qEmail;
      if (qName) state.currentUser.name = qName;
      if (qRole) state.currentUser.role = qRole;
      if (qTeam) {
        state.currentUser.team = qTeam;
        if (!state.currentUser.sectionTeam) state.currentUser.sectionTeam = qTeam;
      }
    } catch (e) {
      /* ignore malformed query */
    }
    try {
      var rawCurrent = localStorage.getItem('rpbdd_current_user');
      if (rawCurrent) {
        var parsedCurrent = JSON.parse(rawCurrent);
        if (!state.currentUser) state.currentUser = {};
        var lsEmail = String((parsedCurrent && parsedCurrent.email) || '').trim();
        var lsName = String((parsedCurrent && parsedCurrent.name) || '').trim();
        var lsRole = String((parsedCurrent && parsedCurrent.role) || '').trim();
        var lsTeam = String((parsedCurrent && parsedCurrent.team) || '').trim();
        var lsPhoto = String((parsedCurrent && parsedCurrent.photo) || '').trim();
        if (lsEmail) state.currentUser.email = lsEmail;
        if (lsName) state.currentUser.name = lsName;
        if (lsRole) state.currentUser.role = lsRole;
        if (lsTeam) {
          state.currentUser.team = lsTeam;
          if (!state.currentUser.sectionTeam) state.currentUser.sectionTeam = lsTeam;
        }
        if (lsPhoto) state.currentUser.photo = normalizeProfilePhotoSrc(lsPhoto);
      }
    } catch (e) {
      /* ignore storage parse errors */
    }
    loadStorage();
    if (getEventsApiBase()) {
      refreshEventCategoriesFromApi()
        .catch(function () {
    renderCategoryDropdowns('', '');
          renderCategoryLegend();
        })
        .finally(function () {
    syncPastUserEventsToDone();
        });
    } else {
      renderCategoryDropdowns('', '');
      renderCategoryLegend();
      syncPastUserEventsToDone();
    }
    Promise.all([refreshTeamsFromApi(), refreshMembersFromApi()]).then(function (arr) {
      if (arr && (arr[0] || arr[1])) renderTeamPanel();
    });

    var initialsEl = document.getElementById('rpbdd-user-initials');
    var av = document.getElementById('rpbdd-avatar-img');
    if (state.currentUser && state.currentUser.name && initialsEl) {
      initialsEl.textContent = state.currentUser.name
        .split(' ')
        .map(function (n) { return n[0]; })
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (state.currentUser && state.currentUser.photo && av) {
      av.src = state.currentUser.photo;
      av.style.display = 'block';
      if (initialsEl) initialsEl.style.display = 'none';
    }

    if (state.currentUser) {
      var sn = document.getElementById('rpbdd-sidebar-name');
      if (sn) sn.textContent = state.currentUser.name || 'User';
      var se = document.getElementById('rpbdd-sidebar-email');
      if (se) se.textContent = state.currentUser.email || '';
    }
    applyRoleBasedUi();
    refreshAdminSidebarFromSupabase();
    refreshBirthdaysFromApi();

    if (currentUserRole() === 'team_leader' && getTeamsApiBase()) {
      var bootTeamEmail =
        state.currentUser && state.currentUser.email != null ? String(state.currentUser.email).trim() : '';
      var bootTeamUrl =
        getTeamsApiBase() + '/my-team' + (bootTeamEmail ? '?email=' + encodeURIComponent(bootTeamEmail) : '');
      fetch(bootTeamUrl, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var j = null;
            try {
              j = text ? JSON.parse(text) : null;
            } catch (e) {
              j = null;
            }
            return { res: res, j: j };
          });
        })
        .then(function (o) {
          if (o.res.ok && o.j && o.j.ok && o.j.team) {
            applyTeamLeaderSidebarFromApiTeam(o.j.team);
          }
        })
        .catch(function () {
          /* ignore */
        });
    }

    if ((currentUserRole() === 'member' || currentUserRole() === 'user') && getMembersApiBase()) {
      var bootMemberEmail =
        state.currentUser && state.currentUser.email != null ? String(state.currentUser.email).trim() : '';
      var bootMemberUrl =
        getMembersApiBase() + '/my-member' + (bootMemberEmail ? '?email=' + encodeURIComponent(bootMemberEmail) : '');
      fetch(bootMemberUrl, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var j = null;
            try {
              j = text ? JSON.parse(text) : null;
            } catch (e) {
              j = null;
            }
            return { res: res, j: j };
          });
        })
        .then(function (o) {
          if (o.res.ok && o.j && o.j.ok && o.j.member) {
            applyMemberSidebarFromApiMember(o.j.member);
          }
        })
        .catch(function () {
          /* ignore */
        });
    }

    if (document.getElementById('rpbdd-sidebar')) {
      try {
        if (localStorage.getItem(LS_SIDEBAR_COLLAPSED) === '1') {
          state.sidebarCollapsed = true;
        }
      } catch (e) {
        /* ignore */
      }
    }

    bind();
    syncThemePickerUi();
    refreshSharedDashboardSettingsFromApi().catch(function () {});
    applyDensityCompact();
    refreshProfileNotificationsFromApi().finally(function () {
      updateFooterSummary();
    });
    if (getProfileNotificationsApiBase() && profileNotifPollId == null) {
      var roleN = currentUserRole();
      if (roleN === 'admin' || roleN === 'team_leader' || roleN === 'member' || roleN === 'user') {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            refreshProfileNotificationsFromApi();
          }
        });
        profileNotifPollId = window.setInterval(function () {
          if (document.visibilityState === 'visible') {
            refreshProfileNotificationsFromApi();
          }
        }, 45000);
      }
    }
    bindLogsTableFormatClicks();
    initSessionAutoLogout();
    applySidebarCollapsedFromState();
    populateTeamSectionSelect('');
    populateTeamPositionSelect('');
    renderDateRows();
    syncAddEventInputByField();
    setNav('dashboard');
    syncSharedModulesFromApi();
    var anySharedDataApi =
      getEventsApiBase() ||
      getTeamsApiBase() ||
      getMembersApiBase() ||
      getTasksApiBase() ||
      !!birthdaysApiBase;
    if (anySharedDataApi && eventsApiBackgroundPollId == null) {
      initEventsCrossTabSync();
      window.addEventListener('rpbdd-events-remote-change', scheduleDebouncedSharedModulesSync);
      window.addEventListener('rpbdd-event-categories-change', scheduleDebouncedSharedModulesSync);
      window.addEventListener('rpbdd-shared-data-change', scheduleDebouncedSharedModulesSync);
      window.addEventListener('rpbdd-shared-dashboard-settings-change', applySharedThemeFromRealtimeEvent);
      window.addEventListener('focus', function () {
        if (document.visibilityState === 'visible') syncSharedModulesFromApi();
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') syncSharedModulesFromApi();
      });
      eventsApiBackgroundPollId = window.setInterval(function () {
        syncSharedModulesFromApi();
      }, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
