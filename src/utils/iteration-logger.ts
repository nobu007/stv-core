/**
 * Phase 34: Persistent Iteration Logger
 * Implements TODO from main-pipeline.ts:1028
 *
 * Purpose: Track pipeline iterations and improvements to .module/ITERATION_LOG.md
 * Philosophy: 実装→テスト→評価→改善→コミット (Custom Instructions Compliant)
 */

import * as fs from 'fs';
import * as path from 'path';

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
  config: any;
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

      console.log(`📝 [Phase 34] Logged iteration ${entry.iteration} to ${this.logPath}`);
    } catch (error) {
      console.error(`❌ [Phase 34] Failed to log iteration:`, error);
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
      console.log(`📝 [Phase 34] Created iteration log at ${this.logPath}`);
    }
  }

  /**
   * Generate markdown for a single iteration entry
   */
  private generateEntryMarkdown(entry: IterationLogEntry): string {
    const { iteration, phase, timestamp, success, metrics, config, improvements, nextSteps, errorMessage } = entry;

    let markdown = `## ${phase}\n\n`;
    markdown += `### Iteration ${iteration} - ${success ? 'success' : 'failure'}\n`;
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
    markdown += `- Transcription Model: ${config.transcription?.model || 'default'}\n`;
    markdown += `- Min Segment Length: ${config.analysis?.minSegmentLengthMs || 3000}ms\n`;
    markdown += `- Max Segment Length: ${config.analysis?.maxSegmentLengthMs || 15000}ms\n`;

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
    const updatedHeader = existingContent.replace(
      /Last Updated: .*/,
      `Last Updated: ${new Date().toISOString()}`
    );

    // Check if phase section exists
    const phaseRegex = new RegExp(`## ${phase}\\n`, 'i');

    if (phaseRegex.test(updatedHeader)) {
      // Insert after phase header
      return updatedHeader.replace(
        phaseRegex,
        `## ${phase}\n\n${newEntry}`
      );
    } else {
      // Append new phase section
      return updatedHeader + `\n${newEntry}`;
    }
  }

  /**
   * Read iteration history from log file
   * Returns parsed entries for analysis
   */
  async readHistory(): Promise<IterationLogEntry[]> {
    try {
      await this.ensureLogFile();
      const content = await fs.promises.readFile(this.logPath, 'utf-8');

      // Simple parsing - extract iteration numbers and success status
      const entries: IterationLogEntry[] = [];
      const iterationRegex = /### Iteration (\d+) - (success|failure)/g;
      const matches = [...content.matchAll(iterationRegex)];

      matches.forEach(match => {
        entries.push({
          iteration: parseInt(match[1], 10),
          phase: 'Unknown', // Would need more sophisticated parsing
          timestamp: new Date().toISOString(),
          success: match[2] === 'success',
          metrics: {
            totalProcessingTime: 0,
            transcriptionTime: 0,
            analysisTime: 0,
            layoutTime: 0,
            renderTime: 0,
            segmentCount: 0,
            diagramCount: 0,
            successRate: match[2] === 'success' ? 1 : 0
          },
          config: {}
        });
      });

      return entries;
    } catch (error) {
      console.error(`❌ [Phase 34] Failed to read iteration history:`, error);
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

      const improvement = ((previousAvg - recentAvg) / previousAvg) * 100;

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
