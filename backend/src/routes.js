/** API router aggregator (mounted at /api). */
import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import sessionsRoutes from './modules/sessions/sessions.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import financeRoutes from './modules/finance/finance.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';

const api = Router();

api.get('/health', (req, res) => res.json({ ok: true, service: 'farfasha-api', time: new Date().toISOString() }));

api.use('/auth', authRoutes);
api.use('/users', usersRoutes);
api.use('/public', publicRoutes);
api.use('/customers', customersRoutes);
api.use('/sessions', sessionsRoutes);
api.use('/settings', settingsRoutes);
api.use('/finance', financeRoutes);
api.use('/notifications', notificationsRoutes);

export default api;
