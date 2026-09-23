import * as core from '@actions/core';
import type * as github from '@actions/github';
import { COMMENT_MARKER } from './markdown.js';

type Octokit = ReturnType<typeof github.getOctokit>;
type Context = typeof github.context;

/**
 * Creates or updates the single sticky comment. With nothing to report and no
 * earlier comment, it posts nothing, so clean PRs stay quiet.
 */
export async function upsertComment(
  octokit: Octokit,
  context: Context,
  issueNumber: number,
  body: string,
  hasFindings: boolean,
  marker = COMMENT_MARKER,
): Promise<void> {
  try {
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      ...context.repo,
      issue_number: issueNumber,
      per_page: 100,
    });
    const existing = comments.find((c) => c.body?.includes(marker));
    if (existing) {
      await octokit.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
      core.info(`Updated PR comment ${existing.html_url}`);
    } else if (hasFindings) {
      const created = await octokit.rest.issues.createComment({ ...context.repo, issue_number: issueNumber, body });
      core.info(`Posted PR comment ${created.data.html_url}`);
    }
  } catch (error) {
    const status = (error as { status?: number }).status;
    const hint =
      status === 403
        ? ' The token cannot write comments (fork PRs get a read-only token; add `permissions: pull-requests: write` otherwise).'
        : '';
    core.warning(`Could not post the PR comment: ${(error as Error).message}.${hint}`);
  }
}
