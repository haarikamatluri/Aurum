import { Routes } from '@angular/router';

export const routes: Routes = [
  // Landing Page
  {
    path: '',
    loadComponent: () => import('./features/landing/landing').then((m) => m.LandingPage),
    title: 'Aurum — Investment Intelligence',
  },
  // App shell — direct public portfolio access
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
        path: 'ai-analyst/:symbol',
        loadComponent: () => import('./features/ai-analyst/ai-analyst').then((m) => m.AiAnalystPage),
        title: 'AI Analyst — Money',
      },
      {
        path: 'ai-analyst/:symbol/:tab',
        loadComponent: () => import('./features/ai-analyst/ai-analyst').then((m) => m.AiAnalystPage),
        title: 'AI Analyst — Money',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
        title: 'Settings — Money',
      },
      {
        path: 'phase4',
        loadComponent: () => import('./features/phase4/phase4').then((m) => m.Phase4Page),
        title: 'Phase 4 Intelligence — Money',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
