import { Routes } from '@angular/router';

export const routes: Routes = [
  // Landing page — no auth required
  {
    path: '',
    loadComponent: () => import('./features/landing/landing').then((m) => m.LandingPage),
    title: 'Money — Know When Your Stocks Move',
  },
  // App shell — protected routes
  {
    path: 'money',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Your Money',
      },
      {
        path: 'stocks/:symbol',
        loadComponent: () => import('./features/stock-detail/stock-detail').then((m) => m.StockDetailPage),
        title: 'Stock Detail — Money',
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/notifications/notifications').then((m) => m.NotificationsPage),
        title: 'Notifications — Money',
      },
      {
        path: 'ai-analyst',
        loadComponent: () => import('./features/ai-analyst/ai-analyst').then((m) => m.AiAnalystPage),
        title: 'AI Analyst — Money',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
        title: 'Settings — Money',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
