import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { isIP } from 'node:net';

/**
 * openresult.dev.
 *
 * Serves the built site, and does the two things a static host cannot:
 *
 *   POST /view      render a document another service hands us
 *   GET  /api/fetch pass through a document the browser may not read itself
 *
 * No dependencies, on purpose. A site whose subject is a format with a
 * dependency-free core should not need eighty packages to serve itself, and
 * every package here would be one more thing to patch at 3am.
 *
 * Nothing is stored. A posted document is rendered into the response and
 * forgotten; there is no database, no cache, and no log of document contents.
 */

const ROOT = resolve(process.env['OPENRESULT_ROOT'] ?? join(import.meta.dirname, '..', 'dist'));
const PORT = Number(process.env['PORT'] ?? 8080);
const HOST = process.env['HOST'] ?? '127.0.0.1';

/** Documents are results sheets, not archives. A megabyte is already generous. */
const MAX_BODY = 4 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/**
 * A page that renders a posted document may not also be allowed to run
 * arbitrary script from elsewhere. `'unsafe-inline'` covers the style
 * attributes Lit writes; script stays same-origin only.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

function secureHeaders(extra = {}) {
  return {
    'content-security-policy': CSP,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-frame-options': 'DENY',
    ...extra,
  };
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, secureHeaders(headers));
  response.end(body);
}

// --- static ------------------------------------------------------------

/** Resolve a request path inside ROOT, refusing anything that escapes it. */
function safePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes('\0')) return null;
  const candidate = resolve(join(ROOT, normalize(decoded)));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  return candidate;
}

async function serveStatic(request, response, pathname) {
  let file = safePath(pathname);
  if (file === null) return send(response, 400, 'Bad path');

  let info = await stat(file).catch(() => null);
  if (info?.isDirectory() === true) {
    file = join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }

  if (info === null || !info.isFile()) {
    // A directory-style URL without its trailing slash is the commonest way to
    // arrive here, so try that before giving up.
    const withIndex = safePath(join(pathname, 'index.html'));
    const alternative = withIndex === null ? null : await stat(withIndex).catch(() => null);
    if (alternative?.isFile() === true) {
      file = withIndex;
      info = alternative;
    } else {
      return notFound(response);
    }
  }

  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const immutable = /\/assets\/.+-[A-Za-z0-9_-]{8,}\./.test(file);

  response.writeHead(
    200,
    secureHeaders({
      'content-type': type,
      'content-length': info.size,
      'last-modified': info.mtime.toUTCString(),
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    }),
  );

  if (request.method === 'HEAD') return response.end();
  createReadStream(file).pipe(response);
}

async function notFound(response) {
  const page = await readFile(join(ROOT, '404.html'), 'utf8').catch(() => 'Not found');
  send(response, 404, page, { 'content-type': 'text/html; charset=utf-8' });
}

// --- POST /view --------------------------------------------------------

function readBody(request, limit = MAX_BODY) {
  return new Promise((fulfil, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error(`Body larger than ${Math.round(limit / 1024)} kB.`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => fulfil(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

/**
 * Put the document into the page.
 *
 * It goes inside `<script type="application/json">`, which the browser does not
 * execute, and the page reads it with `textContent`. The one sequence that can
 * break out of such an element is `</script`, so that is escaped — and `<!--`
 * with it, which can otherwise start a comment that swallows the rest.
 *
 * The document is parsed and re-serialised first, so what reaches the page is
 * JSON we produced rather than a string a stranger wrote.
 */
function inject(page, document) {
  const json = JSON.stringify(document)
    .replaceAll('</', '<\\/')
    .replaceAll('<!--', '<\\!--')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');

  const marker = '<script type="application/json" id="posted-document"></script>';
  if (!page.includes(marker)) {
    throw new Error('The viewer page has lost its document island.');
  }
  return page.replace(
    marker,
    `<script type="application/json" id="posted-document">${json}</script>`,
  );
}

async function renderPosted(response, document) {
  const page = await readFile(join(ROOT, 'view', 'index.html'), 'utf8');
  send(response, 200, inject(page, document), {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
}

function problem(response, status, title, detail) {
  send(response, status, JSON.stringify({ error: title, detail }, null, 2) + '\n', {
    'content-type': 'application/problem+json; charset=utf-8',
    'cache-control': 'no-store',
  });
}

async function postView(request, response) {
  const type = (request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();

  let raw;
  try {
    raw = await readBody(request);
  } catch (error) {
    return problem(response, 413, 'Document too large', error.message);
  }

  let text = raw;

  if (type === 'application/x-www-form-urlencoded') {
    const fields = new URLSearchParams(raw);
    const url = fields.get('url');
    const json = fields.get('json');

    if (url !== null && url.trim() !== '') {
      const fetched = await fetchDocument(url.trim());
      if (!fetched.ok) return problem(response, fetched.status, 'Could not fetch', fetched.detail);
      text = fetched.body;
    } else if (json !== null) {
      text = json;
    } else {
      return problem(
        response,
        400,
        'Nothing to render',
        'Send a "json" field holding a document, or a "url" field naming one.',
      );
    }
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    return problem(response, 400, 'Not JSON', error.message);
  }

  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return problem(response, 400, 'Not a document', 'An OpenResult document is a JSON object.');
  }
  if (typeof document['openresult'] !== 'string') {
    return problem(
      response,
      400,
      'Not an OpenResult document',
      'The object declares no "openresult" version member.',
    );
  }

  await renderPosted(response, document);
}

// --- GET /api/fetch ----------------------------------------------------

/**
 * Refuse to fetch anything that is not on the public internet.
 *
 * A server that fetches a URL for you will be asked to fetch 169.254.169.254,
 * or localhost, or something inside the hosting network. Every hop is resolved
 * and checked, because a public hostname can redirect to a private one, and a
 * DNS record can point wherever its owner likes.
 */
function isPrivateAddress(address) {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast and reserved
    return false;
  }
  if (family === 6) {
    const lower = address.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80')) return true; // link-local
    if (/^f[cd]/.test(lower)) return true; // unique local
    // IPv4-mapped: ::ffff:169.254.169.254 must not slip through.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped !== null) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true;
}

async function resolvesToPublicAddress(hostname) {
  if (isIP(hostname) !== 0) return !isPrivateAddress(hostname);
  const addresses = await lookup(hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) return false;
  return addresses.every((entry) => !isPrivateAddress(entry.address));
}

async function fetchDocument(rawUrl, depth = 0) {
  if (depth > MAX_REDIRECTS) {
    return { ok: false, status: 502, detail: 'Too many redirects.' };
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, status: 400, detail: 'That is not a URL.' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, status: 400, detail: 'Only http and https URLs can be fetched.' };
  }
  if (!(await resolvesToPublicAddress(url.hostname))) {
    return {
      ok: false,
      status: 403,
      detail: 'That host is not on the public internet, so it will not be fetched.',
    };
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: abort.signal,
      headers: {
        accept: 'application/json, text/plain;q=0.8, */*;q=0.5',
        'user-agent': 'openresult.dev',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location === null)
        return { ok: false, status: 502, detail: 'Redirect without a target.' };
      // Re-check the new target from scratch: this is the hop that SSRF filters
      // usually forget.
      return fetchDocument(new URL(location, url).href, depth + 1);
    }

    if (!response.ok) {
      return { ok: false, status: 502, detail: `The server answered ${response.status}.` };
    }

    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > MAX_BODY) {
      return { ok: false, status: 413, detail: 'That document is too large.' };
    }

    // Read with a ceiling rather than trusting content-length, which is a claim.
    const reader = response.body?.getReader();
    if (reader === undefined) return { ok: false, status: 502, detail: 'Empty response.' };

    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY) {
        await reader.cancel();
        return { ok: false, status: 413, detail: 'That document is too large.' };
      }
      chunks.push(value);
    }

    return { ok: true, body: Buffer.concat(chunks).toString('utf8') };
  } catch (error) {
    const detail = error.name === 'AbortError' ? 'The request timed out.' : error.message;
    return { ok: false, status: 502, detail };
  } finally {
    clearTimeout(timer);
  }
}

async function apiFetch(request, response, url) {
  const target = url.searchParams.get('url');
  if (target === null || target.trim() === '') {
    return problem(response, 400, 'No URL given', 'Pass ?url=… naming a document to fetch.');
  }

  const fetched = await fetchDocument(target.trim());
  if (!fetched.ok) return problem(response, fetched.status, 'Could not fetch', fetched.detail);

  send(response, 200, fetched.body, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
}

// --- routing -----------------------------------------------------------

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'openresult.dev'}`);
  const pathname = url.pathname;

  const done = (promise) =>
    promise.catch((error) => {
      console.error(`${request.method} ${pathname}: ${error.stack ?? error}`);
      if (!response.headersSent) problem(response, 500, 'Something broke', 'This has been logged.');
      else response.end();
    });

  if (request.method === 'POST') {
    if (pathname === '/view' || pathname === '/view/')
      return void done(postView(request, response));
    return problem(response, 405, 'Method not allowed', 'Only /view accepts POST.');
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return problem(response, 405, 'Method not allowed', 'This server answers GET, HEAD and POST.');
  }

  if (pathname === '/api/fetch') return void done(apiFetch(request, response, url));

  if (pathname === '/healthz') {
    return send(response, 200, 'ok\n', {
      'content-type': 'text/plain',
      'cache-control': 'no-store',
    });
  }

  return void done(serveStatic(request, response, pathname));
});

server.listen(PORT, HOST, () => {
  console.log(`openresult.dev serving ${ROOT} on http://${HOST}:${PORT}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
