import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { WebsiteConfig, RecruitmentNotice } from '../types';
import { scrapeCgVyapam } from '../scrapers/cgVyapamScraper';

/**
 * Generates a stable unique ID based on the URL and title.
 */
export function generateStableId(url: string, title: string): string {
  const data = `${url.trim().toLowerCase()}_${title.trim()}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Resolves a relative URL against a base URL.
 */
export function resolveUrl(link: string, baseUrl: string): string {
  try {
    return new URL(link.trim(), baseUrl).toString();
  } catch {
    return link;
  }
}

/**
 * Clean whitespace and sanitize output text.
 */
export function sanitizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fetches HTML from website configuration. 
 */
async function fetchHtml(config: WebsiteConfig): Promise<string> {
  const response = await axios.get(config.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (JobRecruitmentMonitor/2.0; public monitoring template)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    timeout: 10000 // 10 second timeout limit
  });

  if (typeof response.data !== 'string') {
    throw new Error('Response data is not a valid HTML string.');
  }

  return response.data;
}

/**
 * Crawls a single WebsiteConfig. Delegates to site-specific scraper for CG Vyapam,
 * or runs a generic parser for custom website configs.
 */
export async function crawlWebsite(config: WebsiteConfig): Promise<RecruitmentNotice[]> {
  // Delegate CG Vyapam to site-specific scraper
  if (config.id === 'cg-vyapam' || config.url.includes('vyapamcg.cgstate.gov.in')) {
    return scrapeCgVyapam(config);
  }

  // Generic fallback scraper for other custom user-added websites
  const html = await fetchHtml(config);
  const $ = cheerio.load(html);
  const notices: RecruitmentNotice[] = [];
  const seenUrls = new Set<string>();

  // Select recruitment containers
  const items = $(config.itemSelector);
  if (items.length === 0) {
    throw new Error(`No items found matching selector: "${config.itemSelector}"`);
  }

  items.each((_, element) => {
    const item = $(element);
    
    // Find Title
    const titleEl = config.titleSelector ? item.find(config.titleSelector) : item;
    const rawTitle = titleEl.first().text();
    const title = sanitizeText(rawTitle);

    // Find Link/URL
    const linkEl = config.linkSelector ? item.find(config.linkSelector) : item;
    const rawHref = linkEl.first().attr('href');
    
    if (!rawHref) {
      return; // Skip if no link found
    }

    const absoluteUrl = resolveUrl(rawHref, config.baseUrl);
    
    // Find Date (optional)
    let date: string | undefined = undefined;
    if (config.dateSelector) {
      const dateEl = item.find(config.dateSelector);
      if (dateEl.length > 0) {
        date = sanitizeText(dateEl.first().text());
      }
    }

    if (title && absoluteUrl) {
      if (!seenUrls.has(absoluteUrl)) {
        seenUrls.add(absoluteUrl);
        const noticeId = generateStableId(absoluteUrl, title);
        notices.push({
          id: noticeId,
          title,
          url: absoluteUrl,
          date,
          websiteId: config.id,
          websiteName: config.name,
          discoveredAt: new Date().toISOString()
        });
      }
    }
  });

  return notices;
}
