import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The server's two jobs that a static host cannot do.
 *
 * Both take input from strangers: a posted document, and a URL to fetch. These
 * tests are mostly about what happens when that input is hostile — a document
 * that tries to close its own script tag, a URL pointing at the metadata
 * service, a redirect from a public host to a private one.
 */

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8137;
const base = `http://127.0.0.1:${PORT}`;

let server: ChildProcess;

beforeAll(async () => {
  server = spawn('node', [join(here, '..', 'server', 'index.mjs')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    stdio: 'ignore',
  });

  // Wait for it to answer rather than sleeping a fixed amount.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${base}/healthz`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((wake) => setTimeout(wake, 50));
  }
  throw new Error('The server did not start.');
}, 20_000);

afterAll(() => {
  server.kill('SIGTERM');
});

const MINIMAL = {
  openresult: '1.0',
  title: 'Test',
  participants: [{ id: 'a', name: 'A' }],
  results: [{ participant: 'a' }],
};

describe('POST /view', () => {
  it('renders a document posted as JSON', async () => {
    const response = await fetch(`${base}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(MINIMAL),
    });

    expect(response.status).toBe(200);
    const page = await response.text();
    expect(page).toContain('id="posted-document"');
    expect(page).toContain('"openresult":"1.0"');
  });

  it('renders a document posted as a form field', async () => {
    const response = await fetch(`${base}/view`, {
      method: 'POST',
      body: new URLSearchParams({ json: JSON.stringify(MINIMAL) }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('id="posted-document"');
  });

  it('never lets a document close the script element that carries it', async () => {
    // The attack: a title that ends the JSON island and opens a real script.
    const hostile = { ...MINIMAL, title: '</script><script>alert(1)</script>' };
    const response = await fetch(`${base}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(hostile),
    });

    const page = await response.text();
    const island = /<script type="application\/json" id="posted-document">(.*?)<\/script>/s.exec(
      page,
    );

    expect(island).not.toBeNull();
    // The payload survives as data — escaped, so the browser sees one element.
    expect(island?.[1]).toContain('<\\/script>');
    expect(page).not.toContain('<script>alert(1)</script>');
  });

  it('refuses something that is not a document', async () => {
    const response = await fetch(`${base}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Not an OpenResult document');
  });

  it('refuses malformed JSON with a usable message', async () => {
    const response = await fetch(`${base}/view`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{ "openresult": ',
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Not JSON');
  });
});

describe('GET /api/fetch refuses anything off the public internet', () => {
  const forbidden = [
    ['the cloud metadata service', 'http://169.254.169.254/latest/meta-data/'],
    ['loopback by name', 'http://localhost/'],
    ['loopback by address', 'http://127.0.0.1/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['a private range', 'http://10.1.2.3/'],
    ['another private range', 'http://192.168.0.1/'],
    ['carrier-grade NAT', 'http://100.64.0.1/'],
    // A public hostname whose A record points at a private address — the case a
    // scheme-and-literal-address check misses. This one needs the network:
    // nip.io resolves any embedded address, and if it ever stops existing this
    // test stops proving anything, which is worth knowing before believing it.
    ['a public name resolving to loopback', 'http://127.0.0.1.nip.io/'],
  ] as const;

  for (const [what, url] of forbidden) {
    it(`refuses ${what}`, async () => {
      const response = await fetch(`${base}/api/fetch?url=${encodeURIComponent(url)}`);
      expect(response.status).toBe(403);
    }, // The server resolves the name before deciding, so these do real DNS. On
    // a CI runner that can take longer than the 5 s default — which is what
    // broke the build, not the refusal itself.
    20_000);
  }

  it('refuses a scheme that is not http or https', async () => {
    const response = await fetch(
      `${base}/api/fetch?url=${encodeURIComponent('file:///etc/passwd')}`,
    );
    expect(response.status).toBe(400);
  });

  it('asks for a URL when given none', async () => {
    expect((await fetch(`${base}/api/fetch`)).status).toBe(400);
  });
});

describe('static serving', () => {
  it('serves the home page', async () => {
    const response = await fetch(`${base}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('serves the schema at the $id documents declare', async () => {
    const response = await fetch(`${base}/schema/openresult-1.0.schema.json`);
    expect(response.status).toBe(200);
    expect((await response.json())['$id']).toBe(
      'https://openresult.dev/schema/openresult-1.0.schema.json',
    );
  });

  it('refuses to escape the document root', async () => {
    for (const attempt of ['/../package.json', '/..%2Fpackage.json', '/%2e%2e/package.json']) {
      const response = await fetch(`${base}${attempt}`, { redirect: 'manual' });
      expect(response.status).not.toBe(200);
    }
  });

  it('sets a content security policy that forbids foreign script', async () => {
    const policy = (await fetch(`${base}/`)).headers.get('content-security-policy') ?? '';
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("answers 404 with the site's own page", async () => {
    const response = await fetch(`${base}/nothing-here`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('Not found');
  });
});
