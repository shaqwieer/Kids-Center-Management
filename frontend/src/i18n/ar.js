// Arabic (default). Copy ported verbatim from the Farfasha design DICT.
export default {
  brand: 'فرفشة', tagline: 'حيث تبدأ المتعة',
  nav_home: 'الرئيسية', nav_customers: 'العملاء', nav_finance: 'المالية', nav_settings: 'الإعدادات',
  nav_team: 'الفريق',
  register_cta: 'تسجيل عميل', lang_switch: 'English', logout: 'تسجيل الخروج',

  // Login
  login_title: 'تسجيل دخول الموظفين', login_sub: 'مركز فرفشة للألعاب',
  login_email: 'البريد الإلكتروني', login_password: 'كلمة المرور',
  login_submit: 'دخول', login_error: 'بيانات الدخول غير صحيحة', login_demo: 'حسابات تجريبية',
  login_welcome: 'أهلاً بعودتك',
  login_blurb: 'تابع من يلعب الآن، وابدأ الجلسات، وأنهِ المحاسبة — كل ذلك من مكان واحد.',
  login_show_pw: 'إظهار كلمة المرور', login_hide_pw: 'إخفاء كلمة المرور',
  login_demo_hint: 'اضغط على أي حساب لتعبئة البيانات',

  // Team (staff accounts)
  tm_title: 'فريق العمل', tm_sub: 'حسابات دخول موظفي المركز',
  tm_add: 'إضافة حساب', tm_name: 'الاسم', tm_email: 'البريد الإلكتروني', tm_password: 'كلمة المرور',
  tm_password_hint: '٦ أحرف على الأقل', tm_password_keep: 'اتركها فارغة للإبقاء على كلمة المرور الحالية',
  tm_role: 'الصلاحية', tm_role_manager: 'مدير', tm_role_staff: 'موظف',
  tm_role_manager_hint: 'صلاحية كاملة، وتشمل الإعدادات والمالية وإدارة الفريق',
  tm_role_staff_hint: 'التشغيل اليومي: الجلسات والعملاء والتسجيل',
  tm_you: 'أنت', tm_joined: 'أُضيف في',
  tm_managers: 'المدراء', tm_staff_group: 'الموظفون',
  tm_new_title: 'حساب جديد', tm_edit_title: 'تعديل الحساب',
  tm_create: 'إنشاء الحساب', tm_save: 'حفظ التغييرات',
  tm_created: 'تم إنشاء الحساب', tm_updated: 'تم تحديث الحساب', tm_deleted: 'تم حذف الحساب',
  tm_delete_q: 'حذف حساب {name}؟',
  tm_delete_note: 'لن يتمكن من الدخول إلى النظام بعد الآن. أما الجلسات التي سجّلها فتبقى كما هي.',
  tm_delete_confirm: 'حذف الحساب',
  tm_empty: 'لا توجد حسابات بعد', tm_empty_sub: 'أضف حساباً ليتمكن الموظف من الدخول',
  tm_only_manager: 'إدارة الحسابات متاحة للمدير فقط',
  tm_err_email: 'هذا البريد مستخدم في حساب آخر',
  tm_err_last_manager: 'هذا هو المدير الوحيد. عيّن مديراً آخر أولاً.',
  tm_err_self_delete: 'لا يمكنك حذف الحساب الذي تستخدمه الآن',
  tm_err_invalid: 'راجع البيانات المدخلة',

  // Dashboard
  dash_title: 'من يلعب الآن', children_playing: 'أطفال يلعبون الآن',
  filter_all: 'الكل', filter_soon: 'أوشك الوقت', filter_over: 'وقت إضافي',
  start_new: 'بدء جلسة جديدة', add_time: 'إضافة وقت', end_session: 'إنهاء الجلسة',
  mother: 'الأم', duration: 'المدة', started: 'بدأت', timeleft: 'الوقت المتبقي', late: 'وقت إضافي',
  st_playing: 'يلعب', st_warning: 'أوشك الوقت', st_overtime: 'وقت إضافي',
  mins: 'دقيقة', dur30: '٣٠ دقيقة', dur60: 'ساعة', dur120: 'ساعتان',
  empty_title: 'لا يوجد أطفال يلعبون الآن', empty_sub: 'اضغط «بدء جلسة جديدة» للبدء',
  boy: 'ولد', girl: 'بنت', yrs: 'سنوات',
  toast_added: 'أُضيفت دقائق', toast_ended: 'انتهت الجلسة', toast_started: 'بدأت الجلسة',

  // Start session wizard
  ss_title: 'بدء جلسة لعب جديدة', ss_s1: 'العميل', ss_s2: 'الطفل والمدة', ss_s3: 'تأكيد',
  ss_scan: 'امسح رمز العميل', ss_scan_hint: 'وجّه الكاميرا نحو بطاقة العميل للدخول السريع', ss_scan_btn: 'فتح الكاميرا',
  ss_or: 'أو', ss_search_ph: 'ابحث برقم الجوال أو الاسم…', ss_no_match: 'لا توجد نتائج مطابقة', ss_register_link: 'تسجيل عميل جديد',
  ss_matched: 'تم العثور على العميل', ss_reg_children: 'الأطفال المسجّلون', ss_change_customer: 'تغيير العميل',
  ss_pick_child: 'من سيدخل اللعب؟', ss_pick_child_hint: 'اختر طفلاً أو أكثر', ss_pick_duration: 'اختر مدة اللعب',
  ss_most_popular: 'الأكثر طلباً', ss_quick: 'لعب سريع', ss_halfday: 'مرح ممتد',
  ss_back: 'رجوع', ss_next: 'التالي', ss_start_play: 'بدء اللعب',
  ss_summary: 'ملخص الجلسة', ss_children: 'الأطفال', ss_duration: 'المدة', ss_total: 'الإجمالي',
  ss_confirm_hint: 'سيبدأ العدّاد فور الضغط على «بدء اللعب»',

  // Register (public)
  rg_welcome: 'أهلاً بك في فرفشة', rg_sub: 'سجّل بياناتك مرة واحدة، واستمتع بدخول سريع في كل زيارة',
  rg_mother_info: 'بيانات ولي الأمر', rg_full_name: 'الاسم الكامل', rg_full_name_ph: 'مثال: نورة العتيبي',
  rg_phone: 'رقم الجوال', rg_phone_ph: '05xxxxxxxx', rg_natid: 'رقم الهوية', rg_optional: 'اختياري', rg_natid_ph: '١٠ أرقام',
  rg_children: 'الأطفال', rg_child: 'الطفل', rg_child_name_ph: 'اسم الطفل', rg_age: 'العمر', rg_age_ph: 'السنوات',
  rg_add_child: 'إضافة طفل آخر', rg_remove: 'حذف', rg_consent: 'أوافق على شروط الاستخدام وسياسة الخصوصية لمركز فرفشة',
  rg_submit: 'إنشاء الحساب', rg_done_title: 'تم التسجيل بنجاح!', rg_done_sub: 'هذه بطاقتك الشخصية — احتفظ بها',
  rg_your_code: 'رمز العميل', rg_scan_next: 'أظهر رمز QR في زيارتك القادمة لتسجيل الدخول فوراً دون إعادة إدخال بياناتك.',
  rg_done_home: 'العودة إلى الرئيسية', rg_save: 'حفظ البطاقة', rg_exists: 'أنت مسجّل بالفعل — هذه بطاقتك',

  // Checkout
  co_title: 'إتمام الجلسة', co_summary: 'ملخص المحاسبة', co_chosen: 'المدة المختارة', co_actual: 'الوقت الفعلي للعب',
  co_window: 'وقت الدخول والخروج', co_base_fee: 'رسوم الجلسة', co_late_fee: 'رسوم الوقت الإضافي', co_future: 'جاهز مستقبلاً',
  co_late_hint: 'يُحتسب آلياً عند تفعيل الدفع', co_total: 'الإجمالي المستحق', co_complete: 'إتمام وإنهاء الجلسة',
  co_ontime: 'انتهت في الوقت', co_over_by: 'تجاوز بمقدار', co_rate_note: 'التعرفة', co_done: 'تمت المحاسبة وإنهاء الجلسة',

  // Profile
  pr_title: 'ملف العميل', pr_customers: 'العملاء', pr_children: 'الأطفال', pr_history: 'سجل الزيارات', pr_card: 'البطاقة الشخصية',
  pr_visits: 'زيارة', pr_print: 'طباعة البطاقة', pr_start: 'بدء جلسة', pr_no_visits: 'لا زيارات بعد',
  pr_played_of: 'لعب', pr_of: 'من', pr_natid: 'رقم الهوية', pr_phone_l: 'الجوال', pr_edit: 'تعديل البيانات',
  pr_search_ph: 'ابحث عن عميل…', pr_save: 'حفظ', pr_cancel: 'إلغاء', pr_updated: 'تم تحديث البيانات',

  // Settings
  se_title: 'الإعدادات', se_durations: 'مدد اللعب والأسعار', se_durations_hint: 'تظهر هذه الخيارات عند بدء جلسة جديدة',
  se_price: 'السعر', se_riyal: 'ر.س', se_late_rate: 'تعرفة الوقت الإضافي', se_per_min: 'لكل دقيقة إضافية',
  se_whatsapp: 'قوالب رسائل واتساب', se_wa_hint: 'تُرسل تلقائياً لولي الأمر',
  se_wa_welcome: 'رسالة الترحيب والتسجيل', se_wa_warning: 'تنبيه قرب انتهاء الوقت', se_wa_overtime: 'تنبيه الوقت الإضافي', se_vars: 'متغيرات:',
  se_branding: 'هوية المركز', se_center_name: 'اسم المركز', se_tagline: 'الشعار النصي', se_color: 'اللون الأساسي',
  se_logo: 'شعار المركز', se_logo_hint: 'PNG أو SVG', se_save: 'حفظ التغييرات', se_saved: 'تم حفظ الإعدادات',
  se_only_manager: 'يمكن للمدير فقط تعديل الإعدادات',

  // Registration QR poster
  se_qr_title: 'ملصق التسجيل',
  se_qr_hint: 'اطبعي هذا الملصق وعلّقيه عند المدخل — تمسحه الأم بكاميرا جوالها لتفتح نموذج التسجيل مباشرة',
  se_qr_print: 'طباعة الملصق',
  se_qr_url: 'الرابط',
  se_qr_warn: 'هذا العنوان محلي ولن يفتح على جوال الأم. اطبعي الملصق من جهاز يستخدم عنوان المركز على الشبكة.',
  poster_title: 'سجّلي مرة واحدة',
  poster_sub: 'امسحي الرمز بكاميرا جوالك لتسجيل بياناتك وأطفالك',
  poster_step1: 'افتحي كاميرا الجوال ووجّهيها إلى الرمز',
  poster_step2: 'أدخلي اسمك ورقم جوالك وأسماء أطفالك',
  poster_step3: 'احتفظي ببطاقتك — أظهريها في كل زيارة لدخول سريع',

  // QR scanner
  qr_starting: 'جارٍ تشغيل الكاميرا…',
  qr_looking: 'وجّه الكاميرا نحو رمز البطاقة',
  qr_use_search: 'يمكنك البحث برقم الجوال بدلاً من ذلك',
  qr_err_denied: 'لم يُسمح باستخدام الكاميرا. اسمحي بالوصول من إعدادات المتصفح ثم أعيدي المحاولة.',
  qr_err_nocam: 'لا توجد كاميرا متاحة على هذا الجهاز',
  qr_err_busy: 'الكاميرا مستخدمة من تطبيق آخر',
  qr_err_insecure: 'المسح يتطلب اتصالاً آمناً (HTTPS) أو تشغيل النظام على الجهاز نفسه',
  qr_err_unsupported: 'هذا المتصفح لا يدعم تشغيل الكاميرا',
  qr_err_generic: 'تعذّر تشغيل الكاميرا',
  qr_err_unknown_code: 'هذا الرمز لا يخص بطاقة عميل',
  qr_err_notfound: 'لم يتم العثور على العميل — قد تكون البطاقة قديمة',

  // Finance
  fin_title: 'المالية', fin_sub: 'الإيرادات والمصروفات', fin_today: 'اليوم', fin_week: 'الأسبوع', fin_month: 'الشهر', fin_export: 'تصدير التقرير',
  fin_revenue: 'إجمالي الإيرادات', fin_expenses: 'إجمالي المصروفات', fin_net: 'صافي الربح', fin_sessions: 'عدد الجلسات', fin_vs: 'مقارنة بالفترة السابقة',
  fin_weekly: 'الإيرادات خلال الأسبوع', fin_rev_break: 'مصادر الإيراد', fin_exp_break: 'المصروفات حسب البند', fin_ledger: 'أحدث الحركات',
  fin_month_label: 'هذا الشهر', fin_placeholder: 'بيانات تجريبية — تُضاف وحدة المصروفات لاحقاً',
  r_sessions: 'جلسات اللعب', r_late: 'رسوم الوقت الإضافي', r_pkg: 'الباقات والاشتراكات',
  e_salaries: 'رواتب الموظفين', e_rent: 'الإيجار', e_supplies: 'مستلزمات وألعاب', e_utilities: 'كهرباء ومياه', e_marketing: 'التسويق', e_maint: 'صيانة ونظافة',

  // Common
  loading: 'جارٍ التحميل…', error_generic: 'حدث خطأ ما', retry: 'إعادة المحاولة', close: 'إغلاق',
  live: 'مباشر', offline: 'غير متصل',
};
