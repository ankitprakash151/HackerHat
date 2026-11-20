import { Scan } from '../models/Scan.js';
import { Target } from '../models/Target.js';
import { Finding } from '../models/Finding.js';
import { Report } from '../models/Report.js';
import { SastRunner } from './sastRunner.js';
import { DastRunner } from './dastRunner.js';
import { ScoringEngine } from './scoringEngine.js';
import { PromptGenerator } from './promptGenerator.js';
import { PdfService } from './pdfService.js';
import { logger } from '../utils/logger.js';

export class ScanOrchestrator {
  /**
   * Dispatches a new asynchronous scan job
   */
  static async startScan(scanId) {
    // Run asynchronously without blocking HTTP response
    setImmediate(async () => {
      try {
        await this.executeScanPipeline(scanId);
      } catch (err) {
        logger.error(`Critical error in scan pipeline for ${scanId}: ${err.message}`);
        await Scan.updateById(scanId, {
          status: 'FAILED',
          currentStage: 'failed',
          error: err.message,
          completedAt: new Date()
        });
        await Scan.addLogMessage(scanId, 'orchestrator', `Scan failed: ${err.message}`, 'error');
      }
    });
  }

  /**
   * Master Pipeline Executor
   */
  static async executeScanPipeline(scanId) {
    const scan = await Scan.findById(scanId);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    const target = await Target.findById(scan.targetId);
    if (!target) {
      throw new Error(`Target ${scan.targetId} not found`);
    }

    // MANDATORY GATE: Check ownership verification
    if (!target.verified) {
      const errMessage = 'Ownership verification gate rejected scan: Target has not been verified.';
      logger.warn(`Scan blocked for target ${target._id}: Not verified`);
      await Scan.updateById(scanId, {
        status: 'FAILED',
        error: errMessage,
        completedAt: new Date()
      });
      await Scan.addLogMessage(scanId, 'verification_gate', errMessage, 'error');
      return;
    }

    logger.info(`Starting scanning pipeline for target "${target.name}" (Scan ID: ${scanId})`);
    const startTime = Date.now();
    const collectedFindings = [];

    // Initialize scan state
    await Scan.updateById(scanId, {
      status: 'STAGE_1_SAST',
      currentStage: 'sast',
      progress: 10,
      startedAt: new Date(),
      stageProgress: {
        sast: { status: 'running', progress: 15, message: 'Running Gitleaks & Semgrep SAST scans...' },
        dast: { status: 'pending', progress: 0, message: 'Waiting for SAST to complete' }
      }
    });
    await Scan.addLogMessage(scanId, 'orchestrator', 'Ownership verified. Launching Stage 1: SAST Scan');

    // =========================================================================
    // STAGE 1: Quick Static Scan (SAST)
    // =========================================================================
    if (target.type === 'zip_archive' || target.type === 'github_repo' || target.localPath) {
      try {
        const targetDir = target.localPath || './';
        await Scan.addLogMessage(scanId, 'sast', `Scanning source code directory with Gitleaks & Semgrep...`);

        const sastFindings = await SastRunner.runScan(targetDir, scanId, target._id);
        collectedFindings.push(...sastFindings);

        await Scan.updateById(scanId, {
          progress: 45,
          stageProgress: {
            sast: {
              status: 'completed',
              progress: 100,
              findingsCount: sastFindings.length,
              message: `SAST completed with ${sastFindings.length} findings`
            }
          }
        });
        await Scan.addLogMessage(scanId, 'sast', `Stage 1 SAST complete: Found ${sastFindings.length} items`);
      } catch (sastErr) {
        logger.error(`SAST Stage error: ${sastErr.message}`);
        await Scan.updateById(scanId, {
          stageProgress: {
            sast: { status: 'failed', error: sastErr.message, message: 'SAST encounter an issue' }
          }
        });
        await Scan.addLogMessage(scanId, 'sast', `SAST warning: ${sastErr.message}`, 'warn');
      }
    } else {
      await Scan.updateById(scanId, {
        stageProgress: {
          sast: { status: 'skipped', progress: 100, message: 'Target is a live URL without local source repository' }
        }
      });
      await Scan.addLogMessage(scanId, 'sast', 'Target is Live URL; SAST skipped, proceeding directly to DAST.');
    }

    // =========================================================================
    // STAGE 2: Isolated Dynamic Scan (DAST)
    // =========================================================================
    await Scan.updateById(scanId, {
      status: 'STAGE_2_DAST',
      currentStage: 'dast',
      progress: 55,
      stageProgress: {
        dast: { status: 'running', progress: 20, message: 'Launching isolated DAST sandbox...' }
      }
    });
    await Scan.addLogMessage(scanId, 'dast', 'Launching Stage 2: Sandboxed OWASP ZAP dynamic inspection');

    const targetUrl = target.url || (target.type === 'live_url' ? target.name : null);

    if (targetUrl) {
      try {
        const dastFindings = await DastRunner.runScan(targetUrl, scanId, target._id);
        collectedFindings.push(...dastFindings);

        await Scan.updateById(scanId, {
          progress: 85,
          stageProgress: {
            dast: {
              status: 'completed',
              progress: 100,
              findingsCount: dastFindings.length,
              message: `DAST sandbox completed with ${dastFindings.length} findings`
            }
          }
        });
        await Scan.addLogMessage(scanId, 'dast', `Stage 2 DAST complete: ${dastFindings.length} dynamic findings`);
      } catch (dastErr) {
        logger.error(`DAST Stage error: ${dastErr.message}`);
        await Scan.updateById(scanId, {
          stageProgress: {
            dast: { status: 'failed', error: dastErr.message, message: 'DAST failed' }
          }
        });
        await Scan.addLogMessage(scanId, 'dast', `DAST issue: ${dastErr.message}`, 'warn');
      }
    } else {
      await Scan.updateById(scanId, {
        stageProgress: {
          dast: { status: 'skipped', progress: 100, message: 'No live URL provided for dynamic probe' }
        }
      });
      await Scan.addLogMessage(scanId, 'dast', 'No live URL provided for target; DAST skipped.');
    }

    // =========================================================================
    // STAGE 3: Scoring & AI Prompt Generation
    // =========================================================================
    await Scan.updateById(scanId, {
      status: 'ANALYZING',
      currentStage: 'analysis',
      progress: 90
    });
    await Scan.addLogMessage(scanId, 'scoring', 'Calculating security score (0–100) and generating AI fix prompts');

    // Enrich each finding with AI prompt
    const enrichedFindings = collectedFindings.map((f) => {
      const promptObj = PromptGenerator.generatePrompt(f);
      return {
        ...f,
        aiPrompt: promptObj
      };
    });

    // Save all findings
    if (enrichedFindings.length > 0) {
      await Finding.insertMany(enrichedFindings);
    }

    // Calculate score
    const scoreResult = ScoringEngine.calculateScore(enrichedFindings);

    // Compute delta with previous scan
    const previousScans = await Scan.findByTargetId(target._id);
    const completedPrev = previousScans.find(
      (s) => String(s._id) !== String(scanId) && s.status === 'COMPLETED' && s.score !== null
    );
    const scoreDelta = completedPrev ? ScoringEngine.computeDelta(scoreResult.score, completedPrev.score) : null;

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // =========================================================================
    // STAGE 4: Finalize & Generate Report
    // =========================================================================
    const finalScan = await Scan.updateById(scanId, {
      status: 'COMPLETED',
      currentStage: 'done',
      progress: 100,
      score: scoreResult.score,
      scoreDelta,
      previousScanId: completedPrev?._id || null,
      summary: scoreResult.summary,
      durationSeconds,
      completedAt: new Date()
    });

    // Update target
    await Target.updateById(target._id, {
      lastScore: scoreResult.score,
      lastScanAt: new Date(),
      scansCount: (target.scansCount || 0) + 1
    });

    // Create Report Record
    const reportData = {
      scanId,
      targetId: target._id,
      targetName: target.name,
      score: scoreResult.score,
      grade: scoreResult.grade,
      scoreDelta,
      executiveSummary: scoreResult.executiveSummary,
      disclaimer: scoreResult.disclaimer,
      findingsBreakdown: {
        critical: scoreResult.summary.criticalCount,
        high: scoreResult.summary.highCount,
        medium: scoreResult.summary.mediumCount,
        low: scoreResult.summary.lowCount,
        info: scoreResult.summary.infoCount,
        total: scoreResult.summary.totalCount
      },
      categoryBreakdown: scoreResult.categoryBreakdown,
      topRisks: enrichedFindings.slice(0, 5).map((f) => ({
        title: f.title,
        severity: f.severity,
        category: f.category,
        impact: f.plainEnglish?.whyItMatters
      }))
    };

    const createdReport = await Report.create(reportData);

    // Generate HTML/PDF file
    try {
      const htmlPath = await PdfService.generateReportHtml(createdReport, target, finalScan, enrichedFindings);
      await Report.create({
        ...reportData,
        pdfPath: htmlPath,
        pdfUrl: `/api/reports/${scanId}/download`
      });
    } catch (reportErr) {
      logger.warn(`PDF generation notice: ${reportErr.message}`);
    }

    await Scan.addLogMessage(
      scanId,
      'orchestrator',
      `Scan completed successfully in ${durationSeconds}s! Final Score: ${scoreResult.score}/100 (${scoreResult.grade})`
    );
    logger.info(`Scan pipeline successfully completed for ${scanId}. Score: ${scoreResult.score}/100`);

    return finalScan;
  }
}
