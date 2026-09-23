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

/**
 * Files added or modified by the pull request, repo-relative.
 * Returns null when they can't be determined, so the caller can fall back to a full scan.
 */
export async function changedFiles(
  octokit: Octokit | null,
  context: Context,
  pr: PullRequestRef,
  cwd: string,
): Promise<string[] | null> {
  if (octokit) {
    try {
      const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
        ...context.repo,
        pull_number: pr.number,
        per_page: 100,
      });
      return files.filter((f) => f.status !== 'removed').map((f) => f.filename);
    } catch (error) {
      core.info(`Could not list PR files through the API (${(error as Error).message}); trying git.`);
    }
  }
  try {
    const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=d', `${pr.baseSha}...${pr.headSha}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.split('\n').filter(Boolean);
  } catch (error) {
    core.warning(
      `Could not diff ${pr.baseSha}...${pr.headSha} (${(error as Error).message.split('\n')[0]}). ` +
        'Use actions/checkout with fetch-depth: 0, or pass github-token. Falling back to a full scan.',
    );
    return null;
  }
}
