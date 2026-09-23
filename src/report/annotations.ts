import * as core from '@actions/core';
import type { ScanResult } from '../types.js';

/** Emits workflow annotations; blocking findings first. Returns how many were emitted. */
export function annotate(result: ScanResult, max: number): number {
  let emitted = 0;
  for (const finding of result.findings) {
    if (emitted >= max) break;
    const props: core.AnnotationProperties = {
      title: `${finding.ruleId} (${finding.impact})`,
      file: finding.file,
      startLine: finding.line,
      startColumn: finding.column,
      endLine: finding.endLine,
      // GitHub rejects column ranges that span lines.
      ...(finding.endLine === finding.line ? { endColumn: finding.endColumn } : {}),
    };
    if (finding.blocking) core.error(finding.message, props);
    else if (finding.impact === 'minor') core.notice(finding.message, props);
    else core.warning(finding.message, props);
    emitted += 1;
  }
  if (result.findings.length > emitted) {
    core.warning(
      `Showing ${emitted} of ${result.findings.length} findings as annotations. See the SARIF file or PR comment for the rest.`,
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
