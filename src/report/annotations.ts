import * as core from '@actions/core';
import type { ScanResult } from '../types.js';
import { describe } from '../wcag.js';

/** Emits workflow annotations; blocking findings first. Returns how many were emitted. */
export function annotate(result: ScanResult, max: number): number {
  let emitted = 0;
  for (const finding of result.findings) {
    if (emitted >= max) break;
    if (!finding.file) continue; // nothing in the diff to attach it to
    const wcag = finding.wcag ?? [];
    const props: core.AnnotationProperties = {
      title: `${finding.ruleId} (${finding.impact})${wcag.length ? ` · WCAG ${wcag.join(', ')}` : ''}`,
      file: finding.file,
      startLine: finding.line,
      startColumn: finding.column,
      endLine: finding.endLine,
      // GitHub rejects column ranges that span lines.
      ...(finding.endLine === finding.line ? { endColumn: finding.endColumn } : {}),
    };
    const message = wcag.length ? `${finding.message}\nWCAG: ${wcag.map(describe).join('; ')}` : finding.message;
    if (finding.blocking) core.error(message, props);
    else if (finding.impact === 'minor') core.notice(message, props);
    else core.warning(message, props);
    emitted += 1;
  }
  const annotatable = result.findings.filter((f) => f.file).length;
  if (annotatable > emitted) {
    core.warning(
      `Showing ${emitted} of ${annotatable} findings as annotations. See the SARIF file or PR comment for the rest.`,
    );
  }
  for (const error of result.parseErrors) {
    core.warning(`Could not parse file, so it was not checked: ${error.message}`, {
      title: 'antd-a11y: parse error',
      file: error.file,
      startLine: error.line,
    });
  }
  return emitted;
}
