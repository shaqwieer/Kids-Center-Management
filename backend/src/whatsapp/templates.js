/**
 * Template rendering + phone normalisation shared by every WhatsApp provider.
 * Templates may use English `{name}` or Arabic `{الاسم}` style placeholders.
 */

const ALIASES = {
  name: ['{name}', '{الاسم}'],
  child: ['{child}', '{الطفل}'],
  minutes: ['{minutes}', '{الدقائق}'],
  code: ['{code}', '{الرمز}'],
  link: ['{link}', '{الرابط}'],
  center: ['{center}', '{المركز}'],
};

/** Replace every placeholder for each provided var. Missing vars are left blank. */
export function renderTemplate(template, vars = {}) {
  let out = String(template || '');
  for (const [key, tokens] of Object.entries(ALIASES)) {
    const value = vars[key] === undefined || vars[key] === null ? '' : String(vars[key]);
    for (const token of tokens) out = out.split(token).join(value);
  }
  return out;
}

/**
 * Drop any LINE that references one of `keys`, before rendering.
 *
 * Used when a variable has nothing to put in it: a warn_5 template reading
 * "تبين تمديد ساعة إضافية؟ اضغطي هنا: {الرابط}" must not be sent with a dangling
 * "اضغطي هنا:" when self-extension is off or the session predates guest tokens.
 * Removing the whole sentence is right; leaving a blank placeholder is not.
 */
export function stripPlaceholderLines(template, keys = []) {
  const tokens = keys.flatMap((k) => ALIASES[k] || []);
  if (!tokens.length) return String(template || '');
  return String(template || '')
    .split('\n')
    .filter((line) => !tokens.some((tok) => line.includes(tok)))
    .join('\n')
    .trim();
}

/** Ordered variables Meta template "body" components expect, per template type. */
export function orderedVars(templateType, vars = {}) {
  switch (templateType) {
    case 'welcome':
      return [vars.name ?? '', vars.code ?? ''];
    case 'warn_5':
      return [vars.child ?? '', vars.link ?? ''];
    case 'time_up':
      return [vars.child ?? '', String(vars.minutes ?? '')];
    case 'review':
      return [vars.name ?? '', vars.link ?? ''];
    default:
      return Object.values(vars).map((v) => String(v ?? ''));
  }
}

/**
 * Normalise a local Saudi number to E.164 digits for the API (no '+').
 * 05XXXXXXXX -> 9665XXXXXXXX ; already-international numbers pass through.
 */
export function normalizePhone(to, defaultCountry = '966') {
  let n = String(to || '').replace(/[^\d]/g, '');
  if (!n) return n;
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0')) n = defaultCountry + n.slice(1);
  else if (!n.startsWith(defaultCountry) && n.length <= 9) n = defaultCountry + n;
  return n;
}
