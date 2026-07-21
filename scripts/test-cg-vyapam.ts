import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dns from 'dns';
import * as https from 'https';
import { parseCgVyapamHtml, normalizeUrl } from '../src/scrapers/cgVyapamScraper';
import { RecruitmentNotice } from '../src/types';

async function runDiagnostic() {
  const TIMEOUT = 60000; // 60-second timeout as required for the standalone actions crawler
  
  const urlsToTest = [
    { url: 'https://vyapamcg.cgstate.gov.in/', type: 'homepage' as const },
    { url: 'https://vyapamcg.cgstate.gov.in/Post?PostID=Recruitment+Year+Wise', type: 'year-wise' as const },
    { url: 'https://vyapamcg.cgstate.gov.in/Posts?tag=RECEXAM26', type: 'current-year' as const }
  ];

  const diagnosticResult: {
    timestamp: string;
    durationMs: number;
    overallStatus: 'success' | 'failed';
    tests: Array<{
      url: string;
      pageType: 'homepage' | 'year-wise' | 'current-year';
      connectionMode: 'default' | 'ipv4';
      dnsLookupSuccess: boolean;
      hasIpv4Addresses: boolean;
      httpStatus?: number;
      contentType?: string;
      responseBodySize: number;
      durationMs: number;
      pageTitle: string;
      expectedHeadingDetected: boolean;
      extractedNoticeCount: number;
      errorCode?: string;
      sanitizedErrorMessage?: string;
    }>;
    totalUniqueNotices: number;
    notices: RecruitmentNotice[];
  } = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    overallStatus: 'failed',
    tests: [],
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

  // Ensure output folder exists before starting requests
  try {
    await fs.mkdir('dist', { recursive: true });
  } catch (err: any) {
    console.error(`[DIAGNOSTIC] Failed to create dist/ directory:`, err.message);
  }

  const allParsedNotices: RecruitmentNotice[] = [];

  for (let i = 0; i < urlsToTest.length; i++) {
    const item = urlsToTest[i];
    const { url, type } = item;
    
    const indexStr = `${i + 1}/${urlsToTest.length}`;
    const nameStr = type === 'homepage' ? 'Homepage' : type === 'year-wise' ? 'Recruitment Year-Wise' : 'Current-Year Recruitment Page';
    console.log(`\n======================================================================`);
    console.log(`[TEST ${indexStr}] ${nameStr}: ${url}`);
    console.log(`----------------------------------------------------------------------`);

    // DNS lookup
    const hostname = new URL(url).hostname;
    let dnsLookupSuccess = false;
    let hasIpv4Addresses = false;
    try {
      const addresses = await dns.promises.lookup(hostname, { all: true });
      dnsLookupSuccess = true;
      hasIpv4Addresses = addresses.some(addr => addr.family === 4);
      console.log(`DNS Lookup: SUCCESS (IPv4: ${hasIpv4Addresses ? 'found' : 'not found'})`);
    } catch (dnsErr: any) {
      dnsLookupSuccess = false;
      hasIpv4Addresses = false;
      console.log(`DNS Lookup: FAILED (${dnsErr.message})`);
    }

    let connectionMode: 'default' | 'ipv4' = 'default';
    let response: any = null;
    let testDuration = 0;
    let httpStatus: number | undefined = undefined;
    let contentType: string | undefined = undefined;
    let bodySize = 0;
    let errorMsg: string | undefined = undefined;
    let errorCode: string | undefined = undefined;
    let pageTitle = '';
    let expectedHeadingDetected = false;
    let extractedNoticeCount = 0;
    let html = '';

    const testStartTime = Date.now();
    try {
      console.log(`Default Connection: Fetching...`);
      response = await axios.get(url, { headers, timeout: TIMEOUT });
      testDuration = Date.now() - testStartTime;
      html = response.data;
      httpStatus = response.status;
      contentType = response.headers['content-type'] ? String(response.headers['content-type']) : undefined;
      bodySize = typeof html === 'string' ? Buffer.byteLength(html, 'utf8') : 0;
      console.log(`Default Connection: SUCCESS (HTTP ${httpStatus}, ${bodySize} bytes, ${testDuration}ms)`);
    } catch (err: any) {
      testDuration = Date.now() - testStartTime;
      errorCode = err.code || 'UNKNOWN';
      errorMsg = err.message ? err.message.replace(/[\/\\][a-zA-Z0-9_\-\.\/]+/g, '') : 'Unknown Network Error';
      console.log(`Default Connection: FAILED (${errorMsg})`);

      if (err.response) {
        httpStatus = err.response.status;
        contentType = err.response.headers['content-type'] ? String(err.response.headers['content-type']) : undefined;
        html = err.response.data;
        bodySize = typeof html === 'string' ? Buffer.byteLength(html, 'utf8') : 0;
      }

      // Retry once using IPv4 family: 4
      console.log(`IPv4 Retry Connection: Fetching with family: 4...`);
      const retryStartTime = Date.now();
      try {
        const ipv4Agent = new https.Agent({ family: 4 });
        const retryResponse = await axios.get(url, { headers, timeout: TIMEOUT, httpsAgent: ipv4Agent });
        connectionMode = 'ipv4';
        testDuration = Date.now() - retryStartTime;
        html = retryResponse.data;
        httpStatus = retryResponse.status;
        contentType = retryResponse.headers['content-type'] ? String(retryResponse.headers['content-type']) : undefined;
        bodySize = typeof html === 'string' ? Buffer.byteLength(html, 'utf8') : 0;
        // Clear error as retry succeeded
        errorCode = undefined;
        errorMsg = undefined;
        response = retryResponse;
        console.log(`IPv4 Retry Connection: SUCCESS (HTTP ${httpStatus}, ${bodySize} bytes, ${testDuration}ms)`);
      } catch (retryErr: any) {
        console.log(`IPv4 Retry Connection: FAILED (${retryErr.message})`);
        errorCode = retryErr.code || errorCode || 'UNKNOWN';
        errorMsg = `Default & IPv4 retry both failed. Latest: ${retryErr.message ? retryErr.message.replace(/[\/\\][a-zA-Z0-9_\-\.\/]+/g, '') : 'Unknown'}`;
      }
    }

    if (html) {
      const $ = cheerio.load(html);
      pageTitle = $('title').text().replace(/\s+/g, ' ').trim() || '';
      
      const lowerText = $('body').text().toLowerCase();
      if (type === 'homepage') {
        expectedHeadingDetected = lowerText.includes('vyapam') || lowerText.includes('recruitment') || lowerText.includes('भर्ती');
      } else if (type === 'year-wise') {
        expectedHeadingDetected = lowerText.includes('year wise') || lowerText.includes('recruitment') || lowerText.includes('post');
      } else if (type === 'current-year') {
        expectedHeadingDetected = lowerText.includes('recexam') || lowerText.includes('recruitment') || lowerText.includes('भर्ती') || lowerText.includes('posts');
      }

      // Parse notices if it contains recruitment links
      if (type === 'homepage' || type === 'current-year') {
        try {
          const isHomepage = type === 'homepage';
          const notices = parseCgVyapamHtml(html, url, 'cg-vyapam', 'CG Vyapam Recruitment', isHomepage);
          extractedNoticeCount = notices.length;
          allParsedNotices.push(...notices);
          console.log(`Parsed ${extractedNoticeCount} notices successfully.`);
        } catch (parseErr: any) {
          console.log(`Parser Error: ${parseErr.message}`);
        }
      }
    }

    // Print test outcome summary
    console.log(`Page Title: "${pageTitle || 'N/A'}"`);
    console.log(`Expected Heading Detected: ${expectedHeadingDetected ? 'YES' : 'NO'}`);
    console.log(`Extracted Notice Count: ${extractedNoticeCount}`);
    console.log(`======================================================================`);

    diagnosticResult.tests.push({
      url,
      pageType: type,
      connectionMode,
      dnsLookupSuccess,
      hasIpv4Addresses,
      httpStatus,
      contentType,
      responseBodySize: bodySize,
      durationMs: testDuration,
      pageTitle,
      expectedHeadingDetected,
      extractedNoticeCount,
      errorCode,
      sanitizedErrorMessage: errorMsg
    });
  }

  // Deduplicate notices
  const uniqueMap = new Map<string, RecruitmentNotice>();
  for (const n of allParsedNotices) {
    if (!uniqueMap.has(n.url)) {
      uniqueMap.set(n.url, n);
    }
  }
  const finalNotices = Array.from(uniqueMap.values());
  diagnosticResult.notices = finalNotices;
  diagnosticResult.totalUniqueNotices = finalNotices.length;

  // Evaluate Overall Success: Successful if either homepage or direct current-year page succeeds
  const homepageSuccess = diagnosticResult.tests.find(t => t.pageType === 'homepage')?.httpStatus === 200;
  const currentYearSuccess = diagnosticResult.tests.find(t => t.pageType === 'current-year')?.httpStatus === 200;

  if (homepageSuccess || currentYearSuccess) {
    diagnosticResult.overallStatus = 'success';
    process.exitCode = 0;
  } else {
    diagnosticResult.overallStatus = 'failed';
    process.exitCode = 1;
  }

  // Save diagnostic JSON artifact
  diagnosticResult.durationMs = Date.now() - startTime;
  try {
    const artifactPath = path.join(process.cwd(), 'dist', 'diagnostic-result.json');
    await fs.writeFile(artifactPath, JSON.stringify(diagnosticResult, null, 2), 'utf-8');
    console.log(`\n[DIAGNOSTIC] Saved complete diagnostic artifact to ${artifactPath}`);
  } catch (writeErr: any) {
    console.error(`\n[DIAGNOSTIC] Failed to save diagnostic artifact:`, writeErr.message);
  }

  if (process.exitCode === 1) {
    console.log(`[DIAGNOSTIC] Diagnostic run finished with failure status (Exit Code 1).`);
  } else {
    console.log(`[DIAGNOSTIC] Diagnostic run completed successfully (Exit Code 0).`);
  }
}

runDiagnostic().catch(err => {
  console.error(`[DIAGNOSTIC FATAL] Unhandled error during diagnostic test run:`, err);
  process.exit(1);
});
