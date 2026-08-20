import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginPage),
    title: 'Sign in — Portfolio Intelligence',
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Overview — Portfolio Intelligence',
      },
      {
        path: 'portfolio',
        loadComponent: () => import('./features/portfolio/portfolio').then((m) => m.PortfolioPage),
        title: 'Portfolio — Portfolio Intelligence',
      },
      {
        path: 'transactions',
        loadComponent: () => import('./features/transactions/transactions').then((m) => m.TransactionsPage),
        title: 'Transactions — Portfolio Intelligence',
      },
      {
        path: 'markets',
        loadComponent: () => import('./features/markets/markets').then((m) => m.MarketsPage),
        title: 'Markets — Portfolio Intelligence',
      },
      {
        path: 'watchlist',
        loadComponent: () => import('./features/watchlist/watchlist').then((m) => m.WatchlistPage),
        title: 'Watchlist — Portfolio Intelligence',
      },
      {
        path: 'stocks/:symbol',
        loadComponent: () => import('./features/stock-detail/stock-detail').then((m) => m.StockDetailPage),
        title: 'Stock Research — Portfolio Intelligence',
      },
      {
        path: 'risk',
        loadComponent: () => import('./features/risk/risk').then((m) => m.RiskPage),
        title: 'Risk — Portfolio Intelligence',
      },
      {
        path: 'predictions',
        loadComponent: () => import('./features/predictions/predictions').then((m) => m.PredictionsPage),
        title: 'Predictions — Portfolio Intelligence',
      },
      {
        path: 'scenarios',
        loadComponent: () => import('./features/scenarios/scenarios').then((m) => m.ScenariosPage),
        title: 'Scenarios — Portfolio Intelligence',
      },
      {
        path: 'alerts',
        loadComponent: () => import('./features/alerts/alerts').then((m) => m.AlertsPage),
        title: 'Alerts — Portfolio Intelligence',
      },
      {
        path: 'research',
        loadComponent: () => import('./features/research/research').then((m) => m.ResearchPage),
        title: 'Research — Portfolio Intelligence',
      },
      {
        path: 'ai-analyst',
        loadComponent: () => import('./features/ai-analyst/ai-analyst').then((m) => m.AiAnalystPage),
        title: 'AI Analyst — Portfolio Intelligence',
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then((m) => m.SettingsPage),
        title: 'Settings — Portfolio Intelligence',
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
