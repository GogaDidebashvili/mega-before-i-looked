import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: '' };

let runsDir: string;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  // beta is written first; the digest sorts by job, so alpha must come first on the page and in JSON.
  writeFileSync(
    join(runsDir, '2026-10-27.jsonl'),
    [
      '{"at":"2026-10-27T02:00:00+01:00","job":"beta","status":"fail","owner":"ops","error":"timeout"}',
      '{"at":"2026-10-27T01:00:00+01:00","job":"alpha","status":"ok"}',
      '{"at":"2026-10-27T01:30:00+01:00","job":"beta","status":"retry","owner":"ops"}',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, '2026-10-26.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-10-25.jsonl'),
    [
      '{"at":"2026-10-25T01:00:00+01:00","job":"alpha","status":"ok"}',
      'not json at all',
      '{"at":"2026-10-25T01:10:00+01:00","job":"beta","status":"ok"}',
    ].join('\n'),
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

// Job names in the order the page shows them: first cell of each table row.
function pageJobs(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*><td>([^<]+)<\/td>/g)].map((m) => m[1]);
}

describe('GET /digest/:night', () => {
  it('shows every job of a normal night', async () => {
    const res = await createApp({ ...config, runsDir }).request('/digest/2026-10-27');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(pageJobs(html)).toEqual(['alpha', 'beta']);
  });

  it('404s for a night with no file', async () => {
    const res = await createApp({ ...config, runsDir }).request('/digest/2026-10-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for that night');
  });

  it('says nothing ran for an empty night', async () => {
    const res = await createApp({ ...config, runsDir }).request('/digest/2026-10-26');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('reports the bad line of a night', async () => {
    const res = await createApp({ ...config, runsDir }).request('/digest/2026-10-25');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
    expect(pageJobs(html)).toEqual(['alpha', 'beta']);
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the rows of a normal night in page order', async () => {
    const res = await createApp({ ...config, runsDir }).request('/api/digest/2026-10-27');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta']);
    expect(body.badLines).toBe(0);
  });

  it('404s for a night with no file', async () => {
    const res = await createApp({ ...config, runsDir }).request('/api/digest/2026-10-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for 2026-10-01' });
  });

  it('returns no rows for an empty night', async () => {
    const res = await createApp({ ...config, runsDir }).request('/api/digest/2026-10-26');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
  });

  it('counts the bad line of a night', async () => {
    const res = await createApp({ ...config, runsDir }).request('/api/digest/2026-10-25');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'beta']);
  });
});
