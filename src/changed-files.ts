import { execFileSync } from 'node:child_process';
import * as core from '@actions/core';
import type * as github from '@actions/github';

type Octokit = ReturnType<typeof github.getOctokit>;
type Context = typeof github.context;

export interface PullRequestRef {
  number: number;
  baseSha: string;
  headSha: string;
}

export function pullRequestFromContext(context: Context): PullRequestRef | null {
  const pr = context.payload.pull_request;
  if (!pr) return null;
  return { number: pr.number, baseSha: pr.base?.sha, headSha: pr.head?.sha };
}

export interface Changes {
  /** Files added or modified, repo-relative. */
  files: string[];
  /** Old path → new path for renamed or moved files, so a baseline follows them. */
  renames: Map<string, string>;
}

/** Parses `git diff --name-status -M` output. */
export function parseNameStatus(out: string): Changes {
  const changes: Changes = { files: [], renames: new Map() };
  for (const line of out.split('\n').filter(Boolean)) {
    const [status, a, b] = line.split('\t');
    if (status.startsWith('R') && b) {
      changes.renames.set(a, b);
      changes.files.push(b);
    } else if (status !== 'D' && a) {
      changes.files.push(a);
    }
  }
  return changes;
}

/**
 * Files the pull request adds or modifies, and the files it renames. Returns null when they can't be
 * determined, so the caller can fall back to a full scan.
 */
export async function changedFiles(
  octokit: Octokit | null,
  context: Context,
  pr: PullRequestRef,
  cwd: string,
): Promise<Changes | null> {
  if (octokit) {
    try {
      const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
        ...context.repo,
        pull_number: pr.number,
        per_page: 100,
      });
      const renames = new Map<string, string>();
      for (const f of files) if (f.status === 'renamed' && f.previous_filename) renames.set(f.previous_filename, f.filename);
      return { files: files.filter((f) => f.status !== 'removed').map((f) => f.filename), renames };
    } catch (error) {
      core.info(`Could not list PR files through the API (${(error as Error).message}); trying git.`);
    }
  }
  try {
    const out = execFileSync('git', ['diff', '--name-status', '-M', `${pr.baseSha}...${pr.headSha}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseNameStatus(out);
  } catch (error) {
    core.warning(
      `Could not diff ${pr.baseSha}...${pr.headSha} (${(error as Error).message.split('\n')[0]}). ` +
        'Use actions/checkout with fetch-depth: 0, or pass github-token. Falling back to a full scan.',
    );
    return null;
  }
}

/**
 * Renames in the last commit, for push and workflow_dispatch runs, which have no PR file list.
 * Needs the previous commit (actions/checkout with fetch-depth: 2); null without it.
 */
export function lastCommitRenames(cwd: string): Map<string, string> | null {
  try {
    const out = execFileSync('git', ['diff', '--name-status', '-M', 'HEAD~1', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseNameStatus(out).renames;
  } catch {
    return null;
  }
}
