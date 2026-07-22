import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.js';

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
  { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { public: true } },
  { path: '/c/:token', name: 'card', component: () => import('@/views/CardView.vue'), meta: { public: true } },
  // Links a mother receives or scans: book a party, rate a visit, add an hour.
  { path: '/book', name: 'book', component: () => import('@/views/PublicBookingView.vue'), meta: { public: true } },
  { path: '/r/:token', name: 'review', component: () => import('@/views/ReviewView.vue'), meta: { public: true } },
  { path: '/x/:token', name: 'extend', component: () => import('@/views/ExtendView.vue'), meta: { public: true } },

  { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { auth: true } },
  { path: '/start', name: 'start', component: () => import('@/views/StartSessionView.vue'), meta: { auth: true } },
  { path: '/checkout/:id', name: 'checkout', component: () => import('@/views/CheckoutView.vue'), meta: { auth: true } },
  { path: '/customers', name: 'customers', component: () => import('@/views/CustomersView.vue'), meta: { auth: true } },
  { path: '/customers/:id', name: 'customer', component: () => import('@/views/CustomersView.vue'), meta: { auth: true } },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { auth: true } },
  { path: '/bookings', name: 'bookings', component: () => import('@/views/BookingsView.vue'), meta: { auth: true } },
  // Finance, insights and the team are manager-only — the API enforces this too.
  { path: '/finance', name: 'finance', component: () => import('@/views/FinanceView.vue'), meta: { auth: true, role: 'manager' } },
  { path: '/insights', name: 'insights', component: () => import('@/views/InsightsView.vue'), meta: { auth: true, role: 'manager' } },
  { path: '/team', name: 'team', component: () => import('@/views/TeamView.vue'), meta: { auth: true, role: 'manager' } },

  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  // Public pages never care who you are.
  if (to.meta.public) return true;

  // Not signed in (or the session has expired): send them to sign in, and
  // remember where they were headed. Purge a dead token so it can't linger.
  if (to.meta.auth && !auth.isAuthed) {
    if (auth.token) auth.logout();
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // Already signed in: the sign-in page is a dead end, so send them to the
  // dashboard instead. Handing the terminal to the next person goes through the
  // explicit Log out button, which clears the session before landing on /login.
  if (to.meta.guest && auth.isAuthed) {
    return { name: 'dashboard' };
  }

  // Role-gated pages: the API enforces this too, this just avoids a dead end.
  if (to.meta.role && auth.user?.role !== to.meta.role) return { name: 'dashboard' };

  return true;
});

export default router;
