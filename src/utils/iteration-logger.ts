/**
 * Phase 34: Persistent Iteration Logger
 * Implements TODO from main-pipeline.ts:1028
 *
 * Purpose: Track pipeline iterations and improvements to .module/ITERATION_LOG.md
 * Philosophy: 実装→テスト→評価→改善→コミット (Custom Instructions Compliant)
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface IterationLogEntry {
  iteration: number;
  phase: string;
  timestamp: string;
  success: boolean;
  metrics: {
    totalProcessingTime: number;
    transcriptionTime: number;
    analysisTime: number;
    layoutTime: number;
    renderTime: number;
    segmentCount: number;
    diagramCount: number;
    successRate: number;
    memoryUsage?: number;
  };
  config: Record<string, unknown>;
  improvements?: string[];
  nextSteps?: string[];
  errorMessage?: string;
}

export class IterationLogger {
  private logPath: string;
  private readonly MAX_LOG_ENTRIES = 100; // Keep last 100 iterations

  constructor(logPath?: string) {
    this.logPath = logPath || path.join(process.cwd(), 'docs', 'architecture', 'ITERATION_LOG.md');
  }

  /**
   * Append iteration entry to log file
   * Phase 34: Implements persistent logging as per custom instructions
   */
  async appendIteration(entry: IterationLogEntry): Promise<void> {
    try {
      // Ensure log file exists
      await this.ensureLogFile();

      // Read existing content
      const existingContent = await fs.promises.readFile(this.logPath, 'utf-8');

      // Generate new entry markdown
      const entryMarkdown = this.generateEntryMarkdown(entry);

      // Parse existing entries to maintain history
      const updatedContent = this.insertEntry(existingContent, entryMarkdown, entry.phase);

      // Write back to file
      await fs.promises.writeFile(this.logPath, updatedContent, 'utf-8');

    } catch (error) {
      logger.error(`[Phase 34] Failed to log iteration:`, error);
      // Non-fatal: don't throw to avoid breaking pipeline
    }
  }

  /**
   * Ensure log file exists with proper structure
   */
  private async ensureLogFile(): Promise<void> {
    try {
      await fs.promises.access(this.logPath);
    } catch {
      // File doesn't exist, create with initial structure
      const initialContent = `# Iteration History

Last Updated: ${new Date().toISOString()}

## Getting Started

This log tracks iterative improvements following the custom instructions philosophy:
**実装→テスト→評価→改善→コミット** (Implement → Test → Evaluate → Improve → Commit)

---

`;
      const dir = path.dirname(this.logPath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(this.logPath, initialContent, 'utf-8');
    }
  }

  /**
   * Generate markdown for a single iteration entry
   */
  private generateEntryMarkdown(entry: IterationLogEntry): string {
    const { iteration, phase, timestamp, success, metrics, config, improvements, nextSteps, errorMessage } = entry;

    let markdown = `### Iteration ${iteration} - ${success ? 'success' : 'failure'}\n`;
    markdown += `**Date**: ${timestamp}\n\n`;

    // Metrics section
    markdown += `**Metrics**:\n`;
    markdown += `- Processing Time: ${(metrics.totalProcessingTime / 1000).toFixed(1)}s\n`;
    markdown += `- Transcription: ${(metrics.transcriptionTime / 1000).toFixed(1)}s\n`;
    markdown += `- Analysis: ${(metrics.analysisTime / 1000).toFixed(1)}s\n`;
    markdown += `- Layout: ${(metrics.layoutTime / 1000).toFixed(1)}s\n`;
    markdown += `- Preparation: ${(metrics.renderTime / 1000).toFixed(1)}s\n`;
    markdown += `- Segments: ${metrics.segmentCount}\n`;
    markdown += `- Diagrams: ${metrics.diagramCount}\n`;
    markdown += `- Success Rate: ${(metrics.successRate * 100).toFixed(1)}%\n`;

    if (metrics.memoryUsage) {
      markdown += `- Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`;
    }

    // Configuration (simplified)
    markdown += `\n**Configuration**:\n`;
    const transcription = config.transcription as Record<string, unknown> | undefined;
    const analysis = config.analysis as Record<string, unknown> | undefined;
    markdown += `- Transcription Model: ${(transcription?.model as string) || 'default'}\n`;
    markdown += `- Min Segment Length: ${(analysis?.minSegmentLengthMs as number) || 3000}ms\n`;
    markdown += `- Max Segment Length: ${(analysis?.maxSegmentLengthMs as number) || 15000}ms\n`;

    // Improvements
    if (improvements && improvements.length > 0) {
      markdown += `\n**Improvements**:\n`;
      improvements.forEach(improvement => {
        markdown += `- ${improvement}\n`;
      });
    }

    // Error message if failed
    if (!success && errorMessage) {
      markdown += `\n**Error**:\n`;
      markdown += `\`\`\`\n${errorMessage}\n\`\`\`\n`;
    }

    // Next steps
    if (nextSteps && nextSteps.length > 0) {
      markdown += `\n**Next Steps**:\n`;
      nextSteps.forEach(step => {
        markdown += `- ${step}\n`;
      });
    }

    markdown += `\n---\n\n`;

    return markdown;
  }

  /**
   * Insert new entry into existing log content
   * Maintains phase organization and limits history
   */
  private insertEntry(existingContent: string, newEntry: string, phase: string): string {
    // Update "Last Updated" timestamp
    let content = existingContent.replace(
      /Last Updated: .*/,
      `Last Updated: ${new Date().toISOString()}`
    );

    // Check if phase section exists (ISS-024: escape regex special chars in phase name)
    const escapedPhase = phase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phaseRegex = new RegExp(`## ${escapedPhase}\\n`, 'i');

    if (phaseRegex.test(content)) {
      // Insert after phase header
      content = content.replace(
        phaseRegex,
        `## ${phase}\n\n${newEntry}`
      );
    } else {
      // Append new phase section with header
      content = content + `\n## ${phase}\n\n${newEntry}`;
    }

    // Enforce max entries to prevent unbounded log growth
    content = this.trimOldEntries(content);

    return content;
  }

  /**
   * Trim oldest entries when total count exceeds MAX_LOG_ENTRIES.
   * Newer entries appear earlier in the file (prepended on insert),
   * so the oldest entries are at the end of the matches array.
   */
  private trimOldEntries(content: string): string {
    const allEntries = [...content.matchAll(/### Iteration \d+ - (success|failure)/g)];
    if (allEntries.length <= this.MAX_LOG_ENTRIES) return content;

    const toRemove = allEntries.length - this.MAX_LOG_ENTRIES;
    // Work backwards from the end (oldest entries) so indices stay valid
    for (let i = 0; i < toRemove; i++) {
      const match = allEntries[allEntries.length - 1 - i];
      const start = match.index!;
      // Find the end of this entry block: next "---" or "### Iteration" or "## " or EOF
      const afterStart = content.substring(start);
      const endMatch = afterStart.match(/\n---\n|\n### Iteration \d+|\n## /);
      const endIdx = endMatch ? endMatch.index! + 1 : afterStart.length; // +1 to include the \n before delimiter
      content = content.substring(0, start) + content.substring(start + endIdx);
    }
    return content;
  }

  /**
   * Read iteration history from log file
   * Returns parsed entries for analysis
   */
  async readHistory(): Promise<IterationLogEntry[]> {
    try {
      await this.ensureLogFile();
      const content = await fs.promises.readFile(this.logPath, 'utf-8');

      const entries: IterationLogEntry[] = [];

      // Split content into phase sections
      const phaseSections = content.split(/^## /m);

      for (const section of phaseSections) {
        // Extract phase name from section header (first line, up to newline)
        const phaseMatch = section.match(/^([^\n]+)/);
        if (!phaseMatch) continue;
        const phaseName = phaseMatch[1].trim();

        // Skip non-phase sections (like "Iteration History", "Getting Started")
        if (phaseName === 'Iteration History' || phaseName === 'Getting Started') continue;

        // Find all iteration entries within this phase section
        const iterRegex = /### Iteration (\d+) - (success|failure)\n\*\*Date\*\*: ([^\n]+)/g;
        const iterMatches = [...section.matchAll(iterRegex)];

        for (const match of iterMatches) {
          const iteration = parseInt(match[1], 10);
          const success = match[2] === 'success';
          const timestamp = match[3];

          // Extract metrics from the section around this match
          const afterEntry = section.substring(match.index! + match[0].length);
          const nextEntryIdx = afterEntry.search(/### Iteration \d+|^---$/m);
          const entryContent = nextEntryIdx > 0 ? afterEntry.substring(0, nextEntryIdx) : afterEntry;

          const processingTimeMatch = entryContent.match(/Processing Time:\s*([\d.]+)s/);
          const transcriptionMatch = entryContent.match(/Transcription:\s*([\d.]+)s/);
          const analysisMatch = entryContent.match(/Analysis:\s*([\d.]+)s/);
          const layoutMatch = entryContent.match(/Layout:\s*([\d.]+)s/);
          const renderMatch = entryContent.match(/Preparation:\s*([\d.]+)s/);
          const segmentsMatch = entryContent.match(/Segments:\s*(\d+)/);
          const diagramsMatch = entryContent.match(/Diagrams:\s*(\d+)/);
          const successRateMatch = entryContent.match(/Success Rate:\s*([\d.]+)%/);

          entries.push({
            iteration,
            phase: phaseName,
            timestamp,
            success,
            metrics: {
              totalProcessingTime: processingTimeMatch ? parseFloat(processingTimeMatch[1]) * 1000 : 0,
              transcriptionTime: transcriptionMatch ? parseFloat(transcriptionMatch[1]) * 1000 : 0,
              analysisTime: analysisMatch ? parseFloat(analysisMatch[1]) * 1000 : 0,
              layoutTime: layoutMatch ? parseFloat(layoutMatch[1]) * 1000 : 0,
              renderTime: renderMatch ? parseFloat(renderMatch[1]) * 1000 : 0,
              segmentCount: segmentsMatch ? parseInt(segmentsMatch[1], 10) : 0,
              diagramCount: diagramsMatch ? parseInt(diagramsMatch[1], 10) : 0,
              successRate: successRateMatch ? parseFloat(successRateMatch[1]) / 100 : (success ? 1 : 0),
            },
            config: {},
          });
        }
      }

      return entries;
    } catch (error) {
      logger.error(`[Phase 34] Failed to read iteration history:`, error);
      return [];
    }
  }

  /**
   * Calculate improvement trends from history
   * Phase 34: Enables data-driven iteration decisions
   */
  async calculateImprovementTrends(): Promise<{
    averageProcessingTime: number;
    successRate: number;
    trendDirection: 'improving' | 'stable' | 'regressing';
    recommendations: string[];
  }> {
    const history = await this.readHistory();

    if (history.length === 0) {
      return {
        averageProcessingTime: 0,
        successRate: 0,
        trendDirection: 'stable',
        recommendations: ['No historical data available']
      };
    }

    // Calculate averages
    const avgTime = history.reduce((sum, entry) => sum + entry.metrics.totalProcessingTime, 0) / history.length;
    const successRate = history.filter(entry => entry.success).length / history.length;

    // Determine trend (compare recent 5 vs previous 5)
    let trendDirection: 'improving' | 'stable' | 'regressing' = 'stable';
    if (history.length >= 10) {
      const recent = history.slice(-5);
      const previous = history.slice(-10, -5);

      const recentAvg = recent.reduce((sum, e) => sum + e.metrics.totalProcessingTime, 0) / recent.length;
      const previousAvg = previous.reduce((sum, e) => sum + e.metrics.totalProcessingTime, 0) / previous.length;

      const improvement = previousAvg !== 0
        ? ((previousAvg - recentAvg) / previousAvg) * 100
        : 0;

      if (improvement > 10) trendDirection = 'improving';
      else if (improvement < -10) trendDirection = 'regressing';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (successRate < 0.8) {
      recommendations.push('Success rate below 80% - investigate error patterns');
    }
    if (avgTime > 60000) {
      recommendations.push('Average processing time > 60s - optimize bottlenecks');
    }
    if (trendDirection === 'regressing') {
      recommendations.push('Performance regressing - review recent changes');
    }

    return {
      averageProcessingTime: avgTime,
      successRate,
      trendDirection,
      recommendations
    };
  }

  /**
   * Generate summary report for current phase
   */
  async generatePhaseSummary(phase: string): Promise<string> {
    const history = await this.readHistory();
    const phaseEntries = history.filter(e => e.phase === phase);

    if (phaseEntries.length === 0) {
      return `# Phase Summary\n\nNo iterations logged for phase: ${phase}`;
    }

    const successCount = phaseEntries.filter(e => e.success).length;
    const successRate = (successCount / phaseEntries.length) * 100;

    let summary = `# Phase Summary: ${phase}\n\n`;
    summary += `**Total Iterations**: ${phaseEntries.length}\n`;
    summary += `**Success Rate**: ${successRate.toFixed(1)}%\n`;
    summary += `**Successful**: ${successCount}\n`;
    summary += `**Failed**: ${phaseEntries.length - successCount}\n\n`;

    summary += `**Trend**: Follow custom instructions philosophy for continuous improvement\n`;

    return summary;
  }
}

// Export singleton instance
export const globalIterationLogger = new IterationLogger();
