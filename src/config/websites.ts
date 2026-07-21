import { WebsiteConfig } from '../types';

/**
 * Strict URL validator to ensure that only public and safe URL protocols/hosts are requested.
 * Rejects localhost, loopbacks, private IP ranges, link-local, multicast, and unsupported protocols.
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // Check protocol
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // Reject localhost
    if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
      return false;
    }
    
    // Check IP addresses
    // Match IPv4 addresses
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Regex);
    if (ipv4Match) {
      const [, oct1, oct2, oct3, oct4] = ipv4Match.map(Number);
      if (oct1 > 255 || oct2 > 255 || oct3 > 255 || oct4 > 255) return false;
      
      // Localhost/Loopback: 127.0.0.0/8
      if (oct1 === 127) return false;
      // Private range A: 10.0.0.0/8
      if (oct1 === 10) return false;
      // Private range B: 172.16.0.0/12
      if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) return false;
      // Private range C: 192.168.0.0/16
      if (oct1 === 192 && oct2 === 168) return false;
      // Link-local: 169.254.0.0/16
      if (oct1 === 169 && oct2 === 254) return false;
      // Multicast/Reserved
      if (oct1 >= 224) return false;
    }
    
    // Reject IPv6 localhost or private/link-local/multicast
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      const ipv6 = hostname.slice(1, -1);
      if (ipv6 === '::1' || ipv6 === '0:0:0:0:0:0:0:1') return false;
      if (ipv6.startsWith('fe80:') || ipv6.startsWith('fc00:') || ipv6.startsWith('fd00:') || ipv6.startsWith('ff00:')) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates website configuration fields. Returns an array of error messages.
 */
export function validateWebsiteConfig(config: WebsiteConfig): string[] {
  const errors: string[] = [];
  
  if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
    errors.push('Invalid or missing website ID.');
  }
  if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
    errors.push('Invalid or missing website name.');
  }
  if (!config.url || !isValidUrl(config.url)) {
    errors.push(`Invalid or unsafe URL: "${config.url}". Must be http/https and cannot be localhost or a private IP.`);
  }
  if (!config.baseUrl || !isValidUrl(config.baseUrl)) {
    errors.push(`Invalid or unsafe base URL: "${config.baseUrl}".`);
  }
  if (!config.itemSelector || typeof config.itemSelector !== 'string' || config.itemSelector.trim() === '') {
    errors.push('Invalid or missing CSS selector for recruitment items.');
  }
  if (!config.titleSelector || typeof config.titleSelector !== 'string' || config.titleSelector.trim() === '') {
    errors.push('Invalid or missing CSS selector for titles.');
  }
  if (!config.linkSelector || typeof config.linkSelector !== 'string' || config.linkSelector.trim() === '') {
    errors.push('Invalid or missing CSS selector for links.');
  }
  
  return errors;
}

/**
 * Official website configurations for monitoring.
 */
export const trustedWebsites: WebsiteConfig[] = [
  {
    id: 'cg-vyapam',
    name: 'CG Vyapam Recruitment',
    url: 'https://vyapamcg.cgstate.gov.in/',
    baseUrl: 'https://vyapamcg.cgstate.gov.in/',
    enabled: true,
    itemSelector: '.rt-vc-posts .rtin-item',
    titleSelector: 'h3 a',
    linkSelector: 'h3 a',
    dateSelector: '.rtin-date'
  }
];
