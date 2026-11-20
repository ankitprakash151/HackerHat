/**
 * Structured Logger with Secret Masking
 */

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /(sk-[a-zA-Z0-9]{20,})/g,
  /(ghp_[a-zA-Z0-9]{30,})/g,
  /(mongodb(\+srv)?:\/\/[^:]+:)([^@]+)(@)/gi
];

function sanitizeMessage(msg) {
  if (typeof msg !== 'string') {
    try {
      msg = JSON.stringify(msg);
    } catch {
      msg = String(msg);
    }
  }
  let sanitized = msg;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match, p1, p2, p3, p4) => {
      if (p1 && p3 && p4) {
        return `${p1}***${p4}`;
      }
      return '[REDACTED_SECRET]';
    });
  }
  return sanitized;
}

export const logger = {
  info: (message, meta = {}) => {
    console.log(`[${new Date().toISOString()}] [INFO] ${sanitizeMessage(message)}`, Object.keys(meta).length ? meta : '');
  },
  warn: (message, meta = {}) => {
    console.warn(`[${new Date().toISOString()}] [WARN] ${sanitizeMessage(message)}`, Object.keys(meta).length ? meta : '');
  },
  error: (message, meta = {}) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${sanitizeMessage(message)}`, Object.keys(meta).length ? meta : '');
  },
  audit: (action, actor, details = {}) => {
    console.log(`[${new Date().toISOString()}] [AUDIT] [${action}] Actor: ${actor}`, details);
  }
};
