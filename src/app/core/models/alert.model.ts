import { Severity } from './common.model';

export type AlertCategory = 'Price' | 'Technical' | 'Portfolio' | 'Market' | 'News' | 'Events' | 'Prediction';

export interface AlertItem {
  id: string;
  severity: Severity;
  category: AlertCategory;
  subject: string;
  message: string;
  timestamp: string;
  symbol?: string;
  read: boolean;
}
