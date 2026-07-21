import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import dns from 'dns';
import tls from 'tls';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import { trustedWebsites, validateWebsiteConfig } from './src/config/websites';
import { crawlWebsite } from './src/utils/scraper';
import { WebsiteConfig, RecruitmentNotice, MonitoringStatus, MonitorSummary } from './src/types';

const PORT = 3000;
const STATE_FILE_PATH = path.join(process.cwd(), 'data', 'recruitment_state.json');

interface StateSchema {
  isFirstCheck: boolean;
  lastChecked: string | null;
  lastSuccessfulCheck: string | null;
  notices: RecruitmentNotice[];
  knownNoticeIds: string[];
  websites: WebsiteConfig[];
  statuses: MonitoringStatus[];
}

/**
 * Loads state from the local JSON file. 
 * If the file doesn't exist or is invalid, initializes it with default values.
 */
async function loadState(): Promise<StateSchema> {
  try {
    await fs.mkdir(path.dirname(STATE_FILE_PATH), { recursive: true });
    const content = await fs.readFile(STATE_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    
    // Ensure all critical fields exist
    return {
      isFirstCheck: typeof parsed.isFirstCheck === 'boolean' ? parsed.isFirstCheck : true,
      lastChecked: parsed.lastChecked || null,
      lastSuccessfulCheck: parsed.lastSuccessfulCheck || null,
      notices: Array.isArray(parsed.notices) ? parsed.notices : [],
      knownNoticeIds: Array.isArray(parsed.knownNoticeIds) ? parsed.knownNoticeIds : [],
      websites: Array.isArray(parsed.websites) && parsed.websites.length > 0 ? parsed.websites : [...trustedWebsites],
      statuses: Array.isArray(parsed.statuses) ? parsed.statuses : []
    };
  } catch (error) {
    // Return initial default state
    return {
      isFirstCheck: true,
      lastChecked: null,
      lastSuccessfulCheck: null,
      notices: [],
      knownNoticeIds: [],
      websites: [...trustedWebsites],
      statuses: trustedWebsites.map(w => ({
        websiteId: w.id,
        websiteName: w.name,
        status: 'idle',
        noticesFound: 0
      }))
    };
  }
}

/**
 * Writes the state safely using a temporary file and atomic rename.
 */
async function saveState(state: StateSchema): Promise<void> {
  const dir = path.dirname(STATE_FILE_PATH);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = `${STATE_FILE_PATH}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
  await fs.rename(tempPath, STATE_FILE_PATH);
}

/**
 * Generates an executive summary of current metrics.
 */
function generateSummary(state: StateSchema, newNoticesCount: number = 0): MonitorSummary {
  return {
    totalWebsites: state.websites.length,
    enabledWebsites: state.websites.filter(w => w.enabled).length,
    lastChecked: state.lastChecked,
    lastSuccessfulCheck: state.lastSuccessfulCheck,
    totalNotices: state.notices.length,
    newNoticesCount
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // ==================== API ENDPOINTS ====================

  /**
   * GET /api/status - Retrieve current overview, website configurations, and notice log
   */
  app.get('/api/status', async (req, res) => {
    try {
      const state = await loadState();
      res.json({
        success: true,
        summary: generateSummary(state),
        notices: state.notices,
        newNotices: [],
        statuses: state.statuses,
        websites: state.websites
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/websites - Add or Edit a website configuration with strict validation
   */
  app.post('/api/websites', async (req, res) => {
    try {
      const state = await loadState();
      const configInput: Partial<WebsiteConfig> = req.body;

      // Extract and clean values
      const config: WebsiteConfig = {
        id: configInput.id || `site_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(configInput.name || '').trim(),
        url: String(configInput.url || '').trim(),
        baseUrl: String(configInput.baseUrl || '').trim(),
        enabled: typeof configInput.enabled === 'boolean' ? configInput.enabled : true,
        itemSelector: String(configInput.itemSelector || '').trim(),
        titleSelector: String(configInput.titleSelector || '').trim(),
        linkSelector: String(configInput.linkSelector || '').trim(),
        dateSelector: configInput.dateSelector ? String(configInput.dateSelector).trim() : undefined
      };

      // Server-side strict security validation
      const errors = validateWebsiteConfig(config);
      if (errors.length > 0) {
        res.status(400).json({ success: false, errors });
        return;
      }

      // Check for duplicate URLs (except the one we are currently editing)
      const duplicate = state.websites.find(w => w.url.toLowerCase() === config.url.toLowerCase() && w.id !== config.id);
      if (duplicate) {
        res.status(400).json({ success: false, errors: [`Website URL is already monitored under the configuration "${duplicate.name}".`] });
        return;
      }

      const existingIndex = state.websites.findIndex(w => w.id === config.id);
      if (existingIndex > -1) {
        state.websites[existingIndex] = config;
      } else {
        state.websites.push(config);
      }

      // Ensure a monitoring status object exists for this website
      const statusIdx = state.statuses.findIndex(s => s.websiteId === config.id);
      if (statusIdx === -1) {
        state.statuses.push({
          websiteId: config.id,
          websiteName: config.name,
          status: 'idle',
          noticesFound: 0
        });
      } else {
        state.statuses[statusIdx].websiteName = config.name;
      }

      await saveState(state);
      res.json({ success: true, website: config, websites: state.websites });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/websites/:id/toggle - Toggle website active state
   */
  app.post('/api/websites/:id/toggle', async (req, res) => {
    try {
      const state = await loadState();
      const websiteId = req.params.id;
      const website = state.websites.find(w => w.id === websiteId);
      
      if (!website) {
        res.status(404).json({ success: false, error: 'Website configuration not found.' });
        return;
      }

      website.enabled = !website.enabled;
      await saveState(state);
      res.json({ success: true, websites: state.websites });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * DELETE /api/websites/:id - Delete website configuration
   */
  app.delete('/api/websites/:id', async (req, res) => {
    try {
      const state = await loadState();
      const websiteId = req.params.id;
      
      state.websites = state.websites.filter(w => w.id !== websiteId);
      state.statuses = state.statuses.filter(s => s.websiteId !== websiteId);
      
      await saveState(state);
      res.json({ success: true, websites: state.websites });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/check - Trigger the server-side crawl check loop
   */
  app.post('/api/check', async (req, res) => {
    try {
      const state = await loadState();
      const enabledWebsites = state.websites.filter(w => w.enabled);
      
      if (enabledWebsites.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No websites are currently enabled for monitoring. Please enable or configure at least one website.'
        });
        return;
      }

      // Initialize statuses to 'checking' for all active targets
      state.statuses = state.websites.map(w => {
        const existing = state.statuses.find(s => s.websiteId === w.id);
        if (w.enabled) {
          return {
            websiteId: w.id,
            websiteName: w.name,
            status: 'checking' as const,
            lastChecked: new Date().toISOString(),
            noticesFound: existing ? existing.noticesFound : 0,
            failedUrl: existing?.failedUrl,
            statusCode: existing?.statusCode,
            errorCode: existing?.errorCode,
            phase: existing?.phase,
            errorTimestamp: existing?.errorTimestamp,
            error: existing?.error
          };
        }
        return existing || {
          websiteId: w.id,
          websiteName: w.name,
          status: 'idle' as const,
          noticesFound: 0
        };
      });

      const newNoticesThisCheck: RecruitmentNotice[] = [];
      let checkFailed = false;
      
      // Execute crawls staggered with polite request delays
      for (let i = 0; i < enabledWebsites.length; i++) {
        const site = enabledWebsites[i];
        
        // Add a delay of 1.5 seconds between subsequent crawlers to act politely
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        const statusObj = state.statuses.find(s => s.websiteId === site.id);

        try {
          // Perform crawl
          const siteNotices = await crawlWebsite(site);
          
          if (statusObj) {
            statusObj.status = 'success';
            statusObj.noticesFound = siteNotices.length;
            delete statusObj.error;
            delete statusObj.failedUrl;
            delete statusObj.statusCode;
            delete statusObj.errorCode;
            delete statusObj.phase;
            delete statusObj.errorTimestamp;
          }

          // Safe state preservation and baseline merge logic:
          const existingSiteNotices = state.notices.filter(n => n.websiteId === site.id);
          const hasExistingNotices = existingSiteNotices.length > 0;

          if (!hasExistingNotices) {
            // Establish baseline for this site (notices are marked isNew: false)
            siteNotices.forEach(notice => {
              const updated = { ...notice, isNew: false };
              state.notices.push(updated);
              if (!state.knownNoticeIds.includes(notice.id)) {
                state.knownNoticeIds.push(notice.id);
              }
            });
          } else {
            // Subsequent check: identify newly published ones
            siteNotices.forEach(notice => {
              const isKnown = state.knownNoticeIds.includes(notice.id);
              if (!isKnown) {
                const updated = { ...notice, isNew: true };
                newNoticesThisCheck.push(updated);
                state.notices.unshift(updated);
                state.knownNoticeIds.push(notice.id);
              }
            });
          }
        } catch (crawlErr: any) {
          // Complete technical log only on server console (as required)
          console.error(`[CRAWLER ERROR] Technical details for ${site.name}:`, crawlErr);
          
          checkFailed = true;

          if (statusObj) {
            statusObj.status = 'error';
            // Extract and sanitize short message
            const rawMsg = crawlErr.message || 'Unknown network error';
            const shortSanitized = rawMsg.split('\n')[0].replace(/[\/|\\][^\s]*\b(node_modules|server|src)\b[^\s]*/g, '').trim();
            
            statusObj.error = shortSanitized;
            statusObj.noticesFound = existingSiteNoticesCount(state, site.id);
            statusObj.failedUrl = crawlErr.failedUrl || site.url;
            statusObj.statusCode = crawlErr.statusCode;
            statusObj.errorCode = crawlErr.errorCode || crawlErr.code;
            statusObj.phase = crawlErr.phase || 'generic';
            statusObj.errorTimestamp = new Date().toISOString();
          }
        }
      }

      // Helper function to count existing notices
      function existingSiteNoticesCount(stateObj: any, sId: string): number {
        return stateObj.notices.filter((n: any) => n.websiteId === sId).length;
      }

      // Keep only a limited historical log of notices and known IDs to avoid state bloat
      if (state.notices.length > 300) {
        state.notices = state.notices.slice(0, 300);
      }
      if (state.knownNoticeIds.length > 1000) {
        state.knownNoticeIds = state.knownNoticeIds.slice(-1000);
      }

      // Update global lastChecked timestamp
      state.lastChecked = new Date().toISOString();
      if (!checkFailed) {
        state.lastSuccessfulCheck = state.lastChecked;
      }

      state.statuses.forEach(s => {
        if (s.status === 'success' || s.status === 'error') {
          s.lastChecked = state.lastChecked!;
          if (s.status === 'success') {
            s.lastSuccessfulCheck = state.lastChecked!;
          }
        }
      });

      // Update isFirstCheck if we had a successful scan
      if (!checkFailed && state.isFirstCheck) {
        state.isFirstCheck = false;
      }

      await saveState(state);

      res.json({
        success: true,
        summary: generateSummary(state, newNoticesThisCheck.length),
        notices: state.notices,
        newNotices: newNoticesThisCheck,
        statuses: state.statuses,
        websites: state.websites
      });
    } catch (err: any) {
      console.error('Core check error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/diagnose - Perform a live connection diagnostic to CG Vyapam from backend runtime
   */
  app.post('/api/diagnose', async (req, res) => {
    const host = 'vyapamcg.cgstate.gov.in';
    const url = 'https://vyapamcg.cgstate.gov.in/';
    const startTime = Date.now();
    
    let dnsResolution: 'success' | 'failed' = 'failed';
    let dnsDetails = '';
    let httpsConnection: 'success' | 'failed' = 'failed';
    let httpsDetails = '';
    let httpStatus: number | null = null;
    let httpStatusText = 'None';
    let contentType: string | null = null;
    let bodyLength: number | null = null;
    let expectedHeadingDetected = false;
    let error: string | null = null;
    
    // 1. DNS Resolution
    try {
      const ips = await dns.promises.lookup(host);
      dnsResolution = 'success';
      dnsDetails = `Resolved successfully to IP: ${ips.address}`;
    } catch (err: any) {
      dnsResolution = 'failed';
      dnsDetails = err.message || 'Unknown DNS error';
      error = `DNS Lookup failed: ${dnsDetails}`;
    }
    
    // 2. HTTPS Connection (TLS Handshake)
    if (dnsResolution === 'success') {
      try {
        await new Promise<void>((resolve, reject) => {
          const socket = tls.connect(443, host, { servername: host }, () => {
            socket.end();
            resolve();
          });
          socket.setTimeout(6000);
          socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('TLS handshake timeout (6s)'));
          });
          socket.on('error', (err) => {
            reject(err);
          });
        });
        httpsConnection = 'success';
        httpsDetails = 'TLS connection handshake completed successfully';
      } catch (err: any) {
        httpsConnection = 'failed';
        httpsDetails = err.message || 'Unknown TLS error';
        if (!error) error = `TLS Connection failed: ${httpsDetails}`;
      }
    }
    
    // 3. HTTP Request
    if (httpsConnection === 'success') {
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
          timeout: 20000,
          maxRedirects: 5
        });
        
        httpStatus = response.status;
        httpStatusText = response.statusText || 'OK';
        contentType = response.headers['content-type'] ? String(response.headers['content-type']) : null;
        
        const html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        bodyLength = html.length;
        expectedHeadingDetected = html.includes('Latest Posts') || html.includes('vyapam') || html.includes('Vyapam') || html.includes('व्यापम') || html.includes('छत्तीसगढ़');
      } catch (err: any) {
        if (!error) error = `HTTP request failed: ${err.message}`;
        if (err.response) {
          httpStatus = err.response.status;
          httpStatusText = err.response.statusText || 'Error';
          contentType = err.response.headers['content-type'] ? String(err.response.headers['content-type']) : null;
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      dnsResolution,
      dnsDetails,
      httpsConnection,
      httpsDetails,
      httpStatus,
      httpStatusText,
      contentType,
      bodyLength,
      expectedHeadingDetected,
      requestDurationMs: duration,
      timestamp: new Date().toISOString(),
      error
    });
  });

  /**
   * POST /api/reset - Re-initialize database back to pristine template configurations
   */
  app.post('/api/reset', async (req, res) => {
    try {
      const defaultState: StateSchema = {
        isFirstCheck: true,
        lastChecked: null,
        lastSuccessfulCheck: null,
        notices: [],
        knownNoticeIds: [],
        websites: [...trustedWebsites],
        statuses: trustedWebsites.map(w => ({
          websiteId: w.id,
          websiteName: w.name,
          status: 'idle',
          noticesFound: 0
        }))
      };
      await saveState(defaultState);
      res.json({
        success: true,
        summary: generateSummary(defaultState),
        notices: [],
        newNotices: [],
        statuses: defaultState.statuses,
        websites: defaultState.websites
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // ==================== VITE & STATIC SERVING ====================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Job Recruitment Monitor running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
