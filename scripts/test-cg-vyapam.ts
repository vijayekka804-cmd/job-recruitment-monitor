import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseCgVyapamHtml, normalizeUrl } from '../src/scrapers/cgVyapamScraper';
import { RecruitmentNotice } from '../src/types';

async function runDiagnostic() {
  const TIMEOUT = 60000; // 60-second timeout as required for the standalone actions crawler
  const homepageUrl = 'https://vyapamcg.cgstate.gov.in/';
  const yearWiseUrl = 'https://vyapamcg.cgstate.gov.in/Post?PostID=Recruitment+Year+Wise';
  
  const diagnosticResult: {
    timestamp: string;
    durationMs: number;
    homepage: {
      status: 'success' | 'failed';
      statusCode?: number;
      errorCode?: string;
      error?: string;
      noticesFound: number;
    };
    yearWise: {
      status: 'success' | 'failed';
      statusCode?: number;
      errorCode?: string;
      error?: string;
      discoveredUrl?: string;
    };
    currentYearListing: {
      status: 'success' | 'failed' | 'skipped';
      statusCode?: number;
      errorCode?: string;
      error?: string;
      noticesFound: number;
    };
    totalUniqueNotices: number;
    notices: RecruitmentNotice[];
  } = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    homepage: { status: 'failed', noticesFound: 0 },
    yearWise: { status: 'failed' },
    currentYearListing: { status: 'skipped', noticesFound: 0 },
    totalUniqueNotices: 0,
    notices: []
  };

  const startTime = Date.now();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'hi-IN,hi;q=0.9,en-IN;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  console.log(`[DIAGNOSTIC] Starting CG Vyapam live crawler test with 60s timeout...`);

  // 1. Crawl Homepage
  let homepageHtml = '';
  try {
    console.log(`[DIAGNOSTIC] Fetching homepage: ${homepageUrl}...`);
    const response = await axios.get(homepageUrl, { headers, timeout: TIMEOUT });
    homepageHtml = response.data;
    diagnosticResult.homepage.status = 'success';
    diagnosticResult.homepage.statusCode = response.status;
  } catch (err: any) {
    console.error(`[DIAGNOSTIC] Homepage fetch failed:`, err.message);
    diagnosticResult.homepage.status = 'failed';
    diagnosticResult.homepage.error = err.message;
    diagnosticResult.homepage.errorCode = err.code || 'UNKNOWN';
    if (err.response) {
      diagnosticResult.homepage.statusCode = err.response.status;
    }
    
    // Save partial diagnostic result before exiting
    diagnosticResult.durationMs = Date.now() - startTime;
    await fs.mkdir('dist', { recursive: true });
    await fs.writeFile(
      path.join(process.cwd(), 'dist', 'diagnostic-result.json'),
      JSON.stringify(diagnosticResult, null, 2),
      'utf-8'
    );
    
    console.error(`[DIAGNOSTIC CRITICAL] Homepage request failed. Exiting with non-zero code as required.`);
    process.exit(1);
  }

  // Parse homepage notices
  let homepageNotices: RecruitmentNotice[] = [];
  try {
    homepageNotices = parseCgVyapamHtml(homepageHtml, homepageUrl, 'cg-vyapam', 'CG Vyapam Recruitment', true);
    diagnosticResult.homepage.noticesFound = homepageNotices.length;
    console.log(`[DIAGNOSTIC] Parsed ${homepageNotices.length} notices from homepage.`);
  } catch (err: any) {
    console.error(`[DIAGNOSTIC] Error parsing homepage HTML:`, err.message);
  }

  // 2. Fetch Year Wise page to locate current year page
  let yearWiseHtml = '';
  let discoveredUrl = '';
  const currentYearStr = new Date().getFullYear().toString();
  const lastTwoDigits = currentYearStr.slice(-2);

  try {
    console.log(`[DIAGNOSTIC] Fetching Year Wise page: ${yearWiseUrl}...`);
    const response = await axios.get(yearWiseUrl, { headers, timeout: TIMEOUT });
    yearWiseHtml = response.data;
    diagnosticResult.yearWise.status = 'success';
    diagnosticResult.yearWise.statusCode = response.status;

    const $ = cheerio.load(yearWiseHtml);
    $('a').each((_, el) => {
      const anchor = $(el);
      const text = anchor.text().replace(/\s+/g, ' ').trim();
      const href = anchor.attr('href') || '';
      
      if (text === currentYearStr || text.includes(currentYearStr) || href.toLowerCase().includes(`recexam${lastTwoDigits}`)) {
        const absolute = normalizeUrl(href);
        if (absolute) {
          discoveredUrl = absolute;
          return false; // break
        }
      }
    });

    if (discoveredUrl) {
      diagnosticResult.yearWise.discoveredUrl = discoveredUrl;
      console.log(`[DIAGNOSTIC] Discovered current year URL: ${discoveredUrl}`);
    } else {
      discoveredUrl = `https://vyapamcg.cgstate.gov.in/Posts?tag=RECEXAM${lastTwoDigits}`;
      diagnosticResult.yearWise.discoveredUrl = discoveredUrl;
      console.log(`[DIAGNOSTIC] Current year link not found in year-wise page, using fallback URL: ${discoveredUrl}`);
    }
  } catch (err: any) {
    console.warn(`[DIAGNOSTIC] Year Wise page fetch failed:`, err.message);
    diagnosticResult.yearWise.status = 'failed';
    diagnosticResult.yearWise.error = err.message;
    diagnosticResult.yearWise.errorCode = err.code || 'UNKNOWN';
    if (err.response) {
      diagnosticResult.yearWise.statusCode = err.response.status;
    }
    // Fallback URL
    discoveredUrl = `https://vyapamcg.cgstate.gov.in/Posts?tag=RECEXAM${lastTwoDigits}`;
    diagnosticResult.yearWise.discoveredUrl = discoveredUrl;
    console.log(`[DIAGNOSTIC] Using fallback current year URL: ${discoveredUrl}`);
  }

  // 3. Fetch discovered current year page
  let currentYearHtml = '';
  let currentYearNotices: RecruitmentNotice[] = [];
  if (discoveredUrl) {
    try {
      console.log(`[DIAGNOSTIC] Fetching current-year listing page: ${discoveredUrl}...`);
      diagnosticResult.currentYearListing.status = 'success';
      const response = await axios.get(discoveredUrl, { headers, timeout: TIMEOUT });
      currentYearHtml = response.data;
      diagnosticResult.currentYearListing.statusCode = response.status;

      currentYearNotices = parseCgVyapamHtml(currentYearHtml, discoveredUrl, 'cg-vyapam', 'CG Vyapam Recruitment', false);
      diagnosticResult.currentYearListing.noticesFound = currentYearNotices.length;
      console.log(`[DIAGNOSTIC] Parsed ${currentYearNotices.length} notices from current-year page.`);
    } catch (err: any) {
      console.error(`[DIAGNOSTIC] Current year listing page fetch failed:`, err.message);
      diagnosticResult.currentYearListing.status = 'failed';
      diagnosticResult.currentYearListing.error = err.message;
      diagnosticResult.currentYearListing.errorCode = err.code || 'UNKNOWN';
      if (err.response) {
        diagnosticResult.currentYearListing.statusCode = err.response.status;
      }
    }
  }

  // 4. Merge and deduplicate
  const allNotices = [...homepageNotices, ...currentYearNotices];
  const uniqueMap = new Map<string, RecruitmentNotice>();
  for (const n of allNotices) {
    if (!uniqueMap.has(n.url)) {
      uniqueMap.set(n.url, n);
    }
  }

  const finalNotices = Array.from(uniqueMap.values());
  diagnosticResult.notices = finalNotices;
  diagnosticResult.totalUniqueNotices = finalNotices.length;
  diagnosticResult.durationMs = Date.now() - startTime;

  // Save diagnostic JSON artifact
  await fs.mkdir('dist', { recursive: true });
  const artifactPath = path.join(process.cwd(), 'dist', 'diagnostic-result.json');
  await fs.writeFile(artifactPath, JSON.stringify(diagnosticResult, null, 2), 'utf-8');

  console.log(`[DIAGNOSTIC] Completed successfully! Saved diagnostic artifact to ${artifactPath}`);
  console.log(`[DIAGNOSTIC] Total unique notices found: ${finalNotices.length}`);
}

runDiagnostic().catch(err => {
  console.error(`[DIAGNOSTIC FATAL] Unhandled error during diagnostic test run:`, err);
  process.exit(1);
});
