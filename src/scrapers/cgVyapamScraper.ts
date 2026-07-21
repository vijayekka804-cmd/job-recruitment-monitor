import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { WebsiteConfig, RecruitmentNotice } from '../types';

/**
 * Normalizes relative URLs into absolute ones starting with the base domain.
 * Rejects localhost, private IP addresses, and unrelated domains.
 */
export function normalizeUrl(link: string): string | null {
  if (!link) return null;
  let trimmed = link.trim();
  
  // Clean up relative backslashes or leading slashes
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    trimmed = 'https://vyapamcg.cgstate.gov.in' + trimmed.replace(/\\/g, '/');
  } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = 'https://vyapamcg.cgstate.gov.in/' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
      return null;
    }

    // Only allow CG Vyapam or subdomains / official application portals
    if (!hostname.endsWith('cgstate.gov.in') && !hostname.endsWith('vyapamcg.cgstate.gov.in')) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extracts date matching DD/MM/YYYY or DD-MM-YYYY pattern and returns YYYY-MM-DD
 */
export function extractDate(text: string): string | undefined {
  const dateRegex = /(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/;
  const match = text.match(dateRegex);
  if (match) {
    const [_, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

/**
 * Extracts recruitment/exam code from title or URL (e.g. MLVI25, ADEO25, HSSN25)
 */
export function extractCode(title: string, href: string): string | undefined {
  // Try pattern like (MLVI25)
  const parenMatch = title.match(/\(([A-Z0-9\-]{4,12})\)/i);
  if (parenMatch) return parenMatch[1].toUpperCase();

  // Try boundary pattern like MLVI25
  const textMatch = title.match(/\b([A-Z]{3,}\d{2}[A-Z]*)\b/i);
  if (textMatch) return textMatch[1].toUpperCase();

  // Try from URL PostID=HSSN25ONLINE
  const hrefMatch = href.match(/PostID=([A-Z]{3,}\d{2}[A-Z]*)/i);
  if (hrefMatch) return hrefMatch[1].toUpperCase();

  return undefined;
}

/**
 * Filters titles to check if they are actually a job recruitment announcement (not result, model answer, admit card, etc.)
 */
export function isJobRecruitment(title: string): boolean {
  const lowercaseTitle = title.toLowerCase();

  // Strict exclusions
  const exclusions = [
    'result',
    'परीक्षा परिणाम',
    'model answer',
    'मॉडल उत्तर',
    'admit card',
    'प्रवेश पत्र',
    'कैलेंडर',
    'कैलेण्डर',
    'calendar',
    'साक्षात्कार',
    'दावा आपत्ति',
    'परीक्षा आयोजन'
  ];

  for (const excl of exclusions) {
    if (lowercaseTitle.includes(excl)) {
      return false;
    }
  }

  // Handle entrance exams (entrance exams are not job recruitments unless explicitly mentioned as recruitment)
  if (lowercaseTitle.includes('entrance') || lowercaseTitle.includes('प्रवेश परीक्षा')) {
    const hasJobKeyword = lowercaseTitle.includes('भर्ती') || lowercaseTitle.includes('recruitment') || lowercaseTitle.includes('पदों की');
    if (!hasJobKeyword) {
      return false;
    }
  }

  // Inclusion words indicating job announcements
  const inclusions = [
    'online application',
    'recruitment application',
    'recruitment',
    'vacancy',
    'appointment',
    'ONLINE APPLICATION',
    'ऑनलाइन आवेदन',
    'आवेदन के सम्बंध',
    'पदों की भर्ती',
    'भर्ती हेतु',
    'भर्ती',
    'आवेदन',
    'नियुक्ति',
    'रिक्ति'
  ];

  for (const incl of inclusions) {
    if (lowercaseTitle.includes(incl.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Parses CG Vyapam HTML pages (supports both Latest Posts layout and generic listings)
 */
export function parseCgVyapamHtml(html: string, pageUrl: string, websiteId: string, websiteName: string, isHomepage: boolean): RecruitmentNotice[] {
  const $ = cheerio.load(html);
  const notices: RecruitmentNotice[] = [];
  const seenUrls = new Set<string>();

  // Find all links in the main content area (or entire body if not defined)
  const mainContentArea = $('main, .entry-content, article, table, #main, .rt-vc-posts');
  const searchArea = mainContentArea.length > 0 ? mainContentArea : ($('body') as any);

  (searchArea as any).find('a').each((_: number, el: any) => {
    const anchor = $(el);
    const rawHref = anchor.attr('href') || '';
    const rawTitle = anchor.text().replace(/\s+/g, ' ').trim();

    if (!rawTitle || rawTitle.length < 5) {
      return;
    }

    // Exclude footer, header, registration help links
    const hrefLower = rawHref.toLowerCase();
    if (
      hrefLower.includes('profile') || 
      hrefLower.includes('helpdesk') || 
      hrefLower.includes('contact') || 
      hrefLower.includes('aboutus') ||
      hrefLower.includes('mission') ||
      hrefLower.includes('vision') ||
      hrefLower.includes('gazette') ||
      hrefLower.includes('previous') ||
      hrefLower.includes('circular') ||
      rawTitle.includes('HELP LINE') ||
      rawTitle.includes('REGISTRATION') ||
      rawTitle.includes('CIRCULARS') ||
      rawTitle.includes('E-CERTIFICATE')
    ) {
      return;
    }

    const absoluteUrl = normalizeUrl(rawHref);
    if (absoluteUrl) {
      if (isJobRecruitment(rawTitle)) {
        if (!seenUrls.has(absoluteUrl)) {
          seenUrls.add(absoluteUrl);

          // Find date patterns using robust regex
          let dateStr: string | undefined = undefined;
          const dateRegex = /(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/;
          
          // 1. In link title text
          let match = rawTitle.match(dateRegex);
          if (match) {
            dateStr = match[0];
          }

          // 2. In parent text
          if (!dateStr) {
            const parent = anchor.parent();
            const parentText = parent.text();
            match = parentText.match(dateRegex);
            if (match) {
              dateStr = match[0];
            }
          }

          // 3. In siblings or near class
          if (!dateStr) {
            anchor.siblings().each((_, sib) => {
              const sibText = $(sib).text();
              match = sibText.match(dateRegex);
              if (match) {
                dateStr = match[0];
                return false;
              }
            });
          }

          let formattedDate: string | undefined = undefined;
          if (dateStr) {
            const parts = dateStr.match(/(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/);
            if (parts) {
              formattedDate = `${parts[3]}-${parts[2]}-${parts[1]}`;
            }
          }

          const noticeId = `${websiteId}_${crypto.createHash('sha256').update(absoluteUrl).digest('hex').substring(0, 16)}`;
          
          notices.push({
            id: noticeId,
            title: rawTitle,
            url: absoluteUrl,
            date: formattedDate,
            websiteId,
            websiteName,
            discoveredAt: new Date().toISOString(),
            recruitmentCode: extractCode(rawTitle, rawHref)
          } as any);
        }
      }
    }
  });

  return notices;
}

/**
 * Main scraper entry point for CG Vyapam.
 * Performs direct HTTP requests with a descriptive User-Agent, retry logic, timeout, and limited redirects.
 * First queries the homepage Latest Posts, then dynamically discovers current year recruitment page from Recruitment Year Wise page.
 */
export async function scrapeCgVyapam(config: WebsiteConfig): Promise<RecruitmentNotice[]> {
  const timeout = 20000; // Strict 20-second timeout
  const maxRedirects = 5; // Maximum 5 redirects

  // Helper with retry on temporary failures
  const fetchWithRetry = async (
    url: string,
    phase: 'homepage' | 'year-wise page' | 'current-year page'
  ): Promise<string> => {
    let lastError: any = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'hi-IN,hi;q=0.9,en-IN;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1'
          },
          timeout,
          maxRedirects
        });
        if (typeof response.data !== 'string') {
          throw new Error('Response data is not a string HTML.');
        }
        return response.data;
      } catch (err: any) {
        lastError = err;
        if (attempt < 2) {
          // Polite backoff before retry
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }
      }
    }
    
    // Throw error with rich attributes for UI reporting
    const errMsg = lastError.message || 'Unknown network error';
    const crawlErr = new Error(errMsg);
    (crawlErr as any).failedUrl = url;
    (crawlErr as any).phase = phase;
    if (lastError.response) {
      (crawlErr as any).statusCode = lastError.response.status;
    }
    if (lastError.code) {
      (crawlErr as any).errorCode = lastError.code;
    } else if (lastError.message && lastError.message.toLowerCase().includes('certificate')) {
      (crawlErr as any).errorCode = 'CERT_ERROR';
    }
    
    throw crawlErr;
  };

  const notices: RecruitmentNotice[] = [];

  // A. Scrape Latest Posts on Homepage
  console.log('Scraping CG Vyapam homepage...');
  const homepageHtml = await fetchWithRetry(config.url, 'homepage');
  const homepageNotices = parseCgVyapamHtml(homepageHtml, config.url, config.id, config.name, true);
  notices.push(...homepageNotices);
  console.log(`Successfully scraped homepage. Found ${homepageNotices.length} notices.`);

  // B. Scrape Current Year Recruitment page
  const currentYearStr = new Date().getFullYear().toString(); // E.g. "2026"
  const lastTwoDigits = currentYearStr.slice(-2); // E.g. "26"
  const yearWiseUrl = 'https://vyapamcg.cgstate.gov.in/Post?PostID=Recruitment+Year+Wise';
  console.log(`Scraping Recruitment Year Wise page to find links for year ${currentYearStr}...`);

  let yearWiseHtml = '';
  let currentYearUrl = '';

  try {
    yearWiseHtml = await fetchWithRetry(yearWiseUrl, 'year-wise page');
    const $ = cheerio.load(yearWiseHtml);
    
    // Find current year anchor link
    $('a').each((_, el) => {
      const anchor = $(el);
      const text = anchor.text().replace(/\s+/g, ' ').trim();
      const href = anchor.attr('href') || '';
      
      if (text === currentYearStr || text.includes(currentYearStr) || href.toLowerCase().includes(`recexam${lastTwoDigits}`)) {
        const absolute = normalizeUrl(href);
        if (absolute) {
          currentYearUrl = absolute;
          return false; // Break
        }
      }
    });

    if (currentYearUrl) {
      console.log(`Discovered current year URL for ${currentYearStr}: ${currentYearUrl}`);
    } else {
      // Build dynamic fallback
      currentYearUrl = `https://vyapamcg.cgstate.gov.in/Posts?tag=RECEXAM${lastTwoDigits}`;
      console.log(`Could not find current year link in page. Falling back to built URL: ${currentYearUrl}`);
    }
  } catch (err: any) {
    console.error('Error fetching Recruitment Year Wise page:', err.message);
    // Rethrow to fail cleanly with correct metadata
    const crawlErr = new Error(`Year-wise page crawl failed: ${err.message}`);
    (crawlErr as any).failedUrl = yearWiseUrl;
    (crawlErr as any).phase = 'year-wise page';
    if (err.statusCode) (crawlErr as any).statusCode = err.statusCode;
    if (err.errorCode) (crawlErr as any).errorCode = err.errorCode;
    throw crawlErr;
  }

  // C. Scrape the discovered current year listing page
  if (currentYearUrl) {
    console.log(`Scraping current-year listing page: ${currentYearUrl}...`);
    const currentYearHtml = await fetchWithRetry(currentYearUrl, 'current-year page');
    const yearNotices = parseCgVyapamHtml(currentYearHtml, currentYearUrl, config.id, config.name, false);
    notices.push(...yearNotices);
    console.log(`Successfully scraped current-year page. Found ${yearNotices.length} notices.`);
  }

  // Merge and deduplicate by absolute URL
  const uniqueNoticesMap = new Map<string, RecruitmentNotice>();
  notices.forEach(notice => {
    const stableId = `${config.id}_${crypto.createHash('sha256').update(notice.url).digest('hex').substring(0, 16)}`;
    notice.id = stableId;
    
    const existing = uniqueNoticesMap.get(notice.url);
    if (!existing) {
      uniqueNoticesMap.set(notice.url, notice);
    } else {
      // Prefer notice with date if existing doesn't have one
      if (notice.date && !existing.date) {
        uniqueNoticesMap.set(notice.url, notice);
      }
    }
  });

  return Array.from(uniqueNoticesMap.values());
}
