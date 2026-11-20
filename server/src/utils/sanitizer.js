import path from 'path';
import { URL } from 'url';

/**
 * Sanitizes and validates a target URL for DAST scanning
 * Strictly verifies HTTP / HTTPS protocol and prevents SSRF
 */
export function validateAndSanitizeUrl(rawUrl, allowPrivate = false) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Target URL is required');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are supported');
  }

  const hostname = parsed.hostname.toLowerCase();

  // SSRF defense: block metadata services and loopback unless explicitly allowed
  const blockedHosts = [
    '169.254.169.254', // AWS/GCP metadata
    'metadata.google.internal',
    'instance-data',
    'localhost',
    '127.0.0.1',
    '::1',
    '0.0.0.0'
  ];

  if (!allowPrivate) {
    if (blockedHosts.includes(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
      throw new Error(`Access to internal/metadata address "${hostname}" is forbidden for security`);
    }

    // Check for private IPv4 ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const b1 = parseInt(ipMatch[1], 10);
      const b2 = parseInt(ipMatch[2], 10);
      if (
        b1 === 10 ||
        b1 === 127 ||
        (b1 === 172 && b2 >= 16 && b2 <= 31) ||
        (b1 === 192 && b2 === 168)
      ) {
        throw new Error(`Access to private IP range "${hostname}" is forbidden`);
      }
    }
  }

  // Return normalized URL string
  return parsed.toString();
}

/**
 * Validates and extracts GitHub owner/repo from URL
 */
export function validateGitHubUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('GitHub repository URL is required');
  }

  const cleaned = rawUrl.trim();
  // Format: https://github.com/owner/repo or github.com/owner/repo
  const githubRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/)?$/;
  const match = cleaned.match(githubRegex);

  if (!match) {
    throw new Error('Invalid GitHub repository URL. Expected format: https://github.com/owner/repo');
  }

  const owner = match[1];
  let repo = match[2];
  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  return {
    normalizedUrl: `https://github.com/${owner}/${repo}`,
    owner,
    repo
  };
}

/**
 * Resolves a safe file path ensuring it does NOT escape base directory (Zip Slip / Path Traversal defense)
 */
export function resolveSafePath(baseDir, relativePath) {
  const safeBase = path.resolve(baseDir);
  // Normalize and prevent null bytes
  const cleanRelative = relativePath.replace(/\0/g, '');
  const resolved = path.resolve(safeBase, cleanRelative);

  if (!resolved.startsWith(safeBase)) {
    throw new Error(`Path traversal attempt detected: "${relativePath}" resolves outside of "${baseDir}"`);
  }

  return resolved;
}

/**
 * Redacts secrets from code snippets, logs, and AI prompts
 */
export function redactSecrets(text) {
  if (!text || typeof text !== 'string') return text;

  return text
    // OpenAI API Keys
    .replace(/(sk-(?:proj-)?[a-zA-Z0-9\-_]{20,})/g, 'sk-proj-****************[REDACTED_SECRET]')
    // GitHub PAT
    .replace(/(ghp_[a-zA-Z0-9]{36})/g, 'ghp_****************[REDACTED_SECRET]')
    // AWS Access Key
    .replace(/(AKIA[0-9A-Z]{16})/g, 'AKIA****************[REDACTED_KEY]')
    // Generic API Key assignments: apiKey = "..." or password = "..."
    .replace(/((?:api[_-]?key|secret|password|token|bearer|auth)\s*[:=]\s*['"])([^'"]{6,})(['"])/gi, 
      (match, prefix, secretVal, suffix) => {
        const masked = secretVal.substring(0, 3) + '********' + secretVal.substring(secretVal.length - 2);
        return `${prefix}${masked}${suffix}`;
      }
    )
    // MongoDB / DB Connection Strings
    .replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1[REDACTED_PASSWORD]$3')
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1[REDACTED_PASSWORD]$3');
}

/**
 * Validates CLI argument array to avoid injection flags
 */
export function sanitizeCliArgs(args = []) {
  if (!Array.isArray(args)) {
    throw new Error('CLI arguments must be an array of strings');
  }

  // Ensure every arg is a string and contains no dangerous null bytes
  return args.map((arg) => {
    const s = String(arg);
    if (s.includes('\0')) {
      throw new Error('Null byte detected in command argument');
    }
    return s;
  });
}
