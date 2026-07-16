// English. Copy ported verbatim from the Farfasha design DICT.
export default {
  brand: 'Farfasha', tagline: 'Where the fun begins',
  nav_home: 'Home', nav_customers: 'Customers', nav_finance: 'Finance', nav_settings: 'Settings',
  nav_team: 'Team',
  register_cta: 'Register', lang_switch: 'عربي', logout: 'Log out',

  // Login
  login_title: 'Staff sign in', login_sub: 'Farfasha Play Center',
  login_email: 'Email', login_password: 'Password',
  login_submit: 'Sign in', login_error: 'Invalid credentials', login_demo: 'Demo accounts',
  login_welcome: 'Welcome back',
  login_blurb: 'Track who is playing, start sessions, and settle checkout — all from one place.',
  login_show_pw: 'Show password', login_hide_pw: 'Hide password',
  login_demo_hint: 'Tap an account to fill the form',

  // Team (staff accounts)
  tm_title: 'Team', tm_sub: 'Sign-in accounts for center staff',
  tm_add: 'Add account', tm_name: 'Name', tm_email: 'Email', tm_password: 'Password',
  tm_password_hint: 'At least 6 characters', tm_password_keep: 'Leave blank to keep the current password',
  tm_role: 'Role', tm_role_manager: 'Manager', tm_role_staff: 'Staff',
  tm_role_manager_hint: 'Full access, including settings, finance, and the team',
  tm_role_staff_hint: 'Day-to-day work: sessions, customers, and registration',
  tm_you: 'You', tm_joined: 'Added',
  tm_managers: 'Managers', tm_staff_group: 'Staff',
  tm_new_title: 'New account', tm_edit_title: 'Edit account',
  tm_create: 'Create account', tm_save: 'Save changes',
  tm_created: 'Account created', tm_updated: 'Account updated', tm_deleted: 'Account deleted',
  tm_delete_q: 'Delete {name}’s account?',
  tm_delete_note: 'They will no longer be able to sign in. Sessions they recorded stay as they are.',
  tm_delete_confirm: 'Delete account',
  tm_empty: 'No accounts yet', tm_empty_sub: 'Add an account so a colleague can sign in',
  tm_only_manager: 'Only managers can manage accounts',
  tm_err_email: 'That email is already used by another account',
  tm_err_last_manager: 'This is the only manager. Promote someone else to manager first.',
  tm_err_self_delete: 'You cannot delete the account you are signed in with',
  tm_err_invalid: 'Check the details you entered',

  // Dashboard
  dash_title: "Who's Playing Now", children_playing: 'children playing now',
  filter_all: 'All', filter_soon: 'Ending soon', filter_over: 'Overtime',
  start_new: 'Start New Session', add_time: 'Add Time', end_session: 'End Session',
  mother: 'Mother', duration: 'Duration', started: 'Started', timeleft: 'Time left', late: 'Overtime',
  st_playing: 'Playing', st_warning: 'Ending soon', st_overtime: 'Overtime',
  mins: 'min', dur30: '30 min', dur60: '1 hour', dur120: '2 hours',
  empty_title: 'No children playing right now', empty_sub: 'Tap Start New Session to begin',
  boy: 'Boy', girl: 'Girl', yrs: 'yrs',
  toast_added: 'Added minutes', toast_ended: 'Session ended', toast_started: 'Session started',

  // Start session wizard
  ss_title: 'Start New Play Session', ss_s1: 'Customer', ss_s2: 'Child & duration', ss_s3: 'Confirm',
  ss_scan: 'Scan customer QR', ss_scan_hint: 'Point the camera at the customer QR card for quick check-in', ss_scan_btn: 'Open camera',
  ss_or: 'or', ss_search_ph: 'Search by phone or name…', ss_no_match: 'No matching results', ss_register_link: 'Register a new customer',
  ss_matched: 'Customer found', ss_reg_children: 'Registered children', ss_change_customer: 'Change customer',
  ss_pick_child: 'Who is entering?', ss_pick_child_hint: 'Select one or more', ss_pick_duration: 'Choose play duration',
  ss_most_popular: 'Most popular', ss_quick: 'Quick play', ss_halfday: 'Extended fun',
  ss_back: 'Back', ss_next: 'Next', ss_start_play: 'Start Play',
  ss_summary: 'Session summary', ss_children: 'Children', ss_duration: 'Duration', ss_total: 'Total',
  ss_confirm_hint: 'The timer starts the moment you tap Start Play',

  // Register (public)
  rg_welcome: 'Welcome to Farfasha', rg_sub: 'Register once, then enjoy quick check-in on every visit',
  rg_mother_info: 'Guardian details', rg_full_name: 'Full name', rg_full_name_ph: 'e.g. Noura Al-Otaibi',
  rg_phone: 'Mobile number', rg_phone_ph: '05xxxxxxxx', rg_natid: 'National ID', rg_optional: 'optional', rg_natid_ph: '10 digits',
  rg_children: 'Children', rg_child: 'Child', rg_child_name_ph: 'Child name', rg_age: 'Age', rg_age_ph: 'Years',
  rg_add_child: 'Add another child', rg_remove: 'Remove', rg_consent: "I agree to Farfasha center's terms of use and privacy policy",
  rg_submit: 'Create account', rg_done_title: 'Registered successfully!', rg_done_sub: 'This is your personal card — keep it',
  rg_your_code: 'Customer code', rg_scan_next: 'Show this QR on your next visit to check in instantly without re-entering your details.',
  rg_done_home: 'Back to home', rg_save: 'Save card', rg_exists: "You're already registered — here is your card",

  // Checkout
  co_title: 'Complete Session', co_summary: 'Checkout summary', co_chosen: 'Chosen duration', co_actual: 'Actual time played',
  co_window: 'Check-in & out', co_base_fee: 'Session fee', co_late_fee: 'Late fee', co_future: 'Future-ready',
  co_late_hint: 'Auto-calculated once payments go live', co_total: 'Total due', co_complete: 'Complete & end session',
  co_ontime: 'Ended on time', co_over_by: 'Over by', co_rate_note: 'Rate', co_done: 'Checked out & session ended',

  // Profile
  pr_title: 'Customer profile', pr_customers: 'Customers', pr_children: 'Children', pr_history: 'Visit history', pr_card: 'Personal card',
  pr_visits: 'visits', pr_print: 'Print card', pr_start: 'Start session', pr_no_visits: 'No visits yet',
  pr_played_of: 'played', pr_of: 'of', pr_natid: 'National ID', pr_phone_l: 'Phone', pr_edit: 'Edit data',
  pr_search_ph: 'Search customer…', pr_save: 'Save', pr_cancel: 'Cancel', pr_updated: 'Customer updated',

  // Settings
  se_title: 'Settings', se_durations: 'Play durations & prices', se_durations_hint: 'These options appear when starting a new session',
  se_price: 'Price', se_riyal: 'SAR', se_late_rate: 'Overtime rate', se_per_min: 'per extra minute',
  se_whatsapp: 'WhatsApp message templates', se_wa_hint: 'Sent automatically to the guardian',
  se_wa_welcome: 'Welcome & registration', se_wa_warning: 'Time-almost-up alert', se_wa_overtime: 'Overtime alert', se_vars: 'Variables:',
  se_branding: 'Center branding', se_center_name: 'Center name', se_tagline: 'Tagline', se_color: 'Primary color',
  se_logo: 'Center logo', se_logo_hint: 'PNG or SVG', se_save: 'Save changes', se_saved: 'Settings saved',
  se_only_manager: 'Only managers can edit settings',

  // Registration QR poster
  se_qr_title: 'Registration poster',
  se_qr_hint: 'Print this and put it at the entrance — a parent scans it with her phone camera to open the registration form',
  se_qr_print: 'Print poster',
  se_qr_url: 'Link',
  se_qr_warn: 'This is a local address and will not open on a parent’s phone. Print the poster from a device using the center’s network address.',
  poster_title: 'Register once',
  poster_sub: 'Scan with your phone camera to register yourself and your children',
  poster_step1: 'Open your phone camera and point it at the code',
  poster_step2: 'Enter your name, mobile number, and your children’s names',
  poster_step3: 'Keep your card — show it on every visit for quick check-in',

  // QR scanner
  qr_starting: 'Starting the camera…',
  qr_looking: 'Point the camera at the QR card',
  qr_use_search: 'You can search by mobile number instead',
  qr_err_denied: 'Camera access was blocked. Allow it in your browser settings and try again.',
  qr_err_nocam: 'No camera is available on this device',
  qr_err_busy: 'The camera is in use by another app',
  qr_err_insecure: 'Scanning needs a secure (HTTPS) connection, or the app running on this device',
  qr_err_unsupported: 'This browser cannot open the camera',
  qr_err_generic: 'The camera could not be started',
  qr_err_unknown_code: 'That code is not a customer card',
  qr_err_notfound: 'Customer not found — the card may be out of date',

  // Finance
  fin_title: 'Finance', fin_sub: 'Revenue & expenses', fin_today: 'Today', fin_week: 'Week', fin_month: 'Month', fin_export: 'Export report',
  fin_revenue: 'Total revenue', fin_expenses: 'Total expenses', fin_net: 'Net profit', fin_sessions: 'Sessions', fin_vs: 'vs previous period',
  fin_weekly: 'Revenue this week', fin_rev_break: 'Revenue sources', fin_exp_break: 'Expenses by category', fin_ledger: 'Recent transactions',
  fin_month_label: 'This month', fin_placeholder: 'Demo data — an expenses module will be added later',
  r_sessions: 'Play sessions', r_late: 'Overtime fees', r_pkg: 'Packages & memberships',
  e_salaries: 'Staff salaries', e_rent: 'Rent', e_supplies: 'Toys & supplies', e_utilities: 'Electricity & water', e_marketing: 'Marketing', e_maint: 'Maintenance & cleaning',

  // Common
  loading: 'Loading…', error_generic: 'Something went wrong', retry: 'Retry', close: 'Close',
  live: 'Live', offline: 'Offline',
};
