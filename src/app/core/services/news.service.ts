import { Injectable } from '@angular/core';
import { Observable, delay, map, of } from 'rxjs';
import { NewsArticle } from '../models/news.model';
import { NEWS_ARTICLES } from '../mock/news.mock';

/** Research / news feed. Backs GET /api/stocks/{symbol}/news and the Research page. */
@Injectable({ providedIn: 'root' })
export class NewsService {
  getLatest(limit = 20): Observable<NewsArticle[]> {
    return of(NEWS_ARTICLES.slice(0, limit)).pipe(delay(280));
  }

  getForSymbol(symbol: string): Observable<NewsArticle[]> {
    return of(null).pipe(delay(280), map(() => NEWS_ARTICLES.filter((a) => a.symbols.includes(symbol))));
  }
}
