import '@angular/compiler';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { News } from './news';
import { AiAnalystService } from '../../core/services/ai-analyst.service';
import { PortfolioService } from '../../core/services/portfolio.service';

describe('News', () => {
  let component: News;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [
        {
          provide: AiAnalystService,
          useValue: {
            fetchStockNews: () => Promise.resolve([])
          }
        },
        {
          provide: PortfolioService,
          useValue: {
            holdings: signal([])
          }
        }
      ]
    });
    component = runInInjectionContext(injector, () => new News());
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
