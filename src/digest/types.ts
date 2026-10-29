// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night. Times keep the offset from the log (styleguide).
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  first: string;
  last: string;
};

export type Night = {
  night: string;
  rows: DigestRow[]; // sorted by job
  badLines: number;
};

// null = no file for that night (or not a YYYY-MM-DD night). An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
