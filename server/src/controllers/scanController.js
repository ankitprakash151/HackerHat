import { Scan } from '../models/Scan.js';
import { Target } from '../models/Target.js';
import { Finding } from '../models/Finding.js';
import { ScanOrchestrator } from '../services/orchestrator.js';
import { DemoOrchestrator } from '../services/demoOrchestrator.js';
import { logger } from '../utils/logger.js';

export class ScanController {
  /**
   * Launch new scan for a target
   * In Demo Mode: bypasses ownership check and dispatches 6-8s simulated pipeline
   * In Normal Mode: strict ownership verification enforced
   */
  static async createScan(req, res) {
    try {
      const { targetId, isDemo, isReScan } = req.body;
      if (!targetId) {
        return res.status(400).json({ error: 'targetId is required' });
      }

      let target = await Target.findById(targetId);
      if (!target) {
        return res.status(404).json({ error: 'Target not found' });
      }

      // Check Demo Mode
      if (isDemo) {
        // Auto-verify if not verified
        if (!target.verified) {
          target = await Target.updateById(targetId, {
            verified: true,
            verificationMethod: target.type === 'zip_archive' ? 'zip_upload' : target.type === 'live_url' ? 'dns_file' : 'github_oauth',
            verifiedAt: new Date()
          });
        }

        // Check if this is a re-scan (explicit flag or past completed scans exist)
        const pastScans = await Scan.findByTargetId(targetId);
        const hasCompletedPrevious = pastScans.some((s) => s.status === 'COMPLETED');
        const reScanMode = isReScan !== undefined ? Boolean(isReScan) : hasCompletedPrevious;

        const scan = await Scan.create({
          targetId: target._id,
          targetUrl: target.url,
          targetType: target.type,
          status: 'QUEUED',
          currentStage: 'init',
          progress: 10,
          isDemo: true
        });

        // Launch 6-to-8 second animated demo pipeline
        DemoOrchestrator.startDemoScan(scan._id, target._id, reScanMode);

        logger.info(`[Demo Mode] Scan scheduled: ${scan._id} for target ${target.name} (isReScan: ${reScanMode})`);
        return res.status(202).json({
          message: 'Demo scan initiated',
          scanId: scan._id,
          status: scan.status,
          isDemo: true,
          isReScan: reScanMode
        });
      }

      // Mandatory Gate: Ownership Verification check for regular mode
      if (!target.verified) {
        return res.status(403).json({
          error: 'Ownership Verification Gate: You must verify ownership of this target before initiating a scan.',
          verified: false,
          targetId: target._id
        });
      }

      // Create scan record in MongoDB
      const scan = await Scan.create({
        targetId: target._id,
        targetUrl: target.url,
        targetType: target.type,
        status: 'QUEUED',
        currentStage: 'init',
        progress: 5
      });

      // Dispatch async orchestration job
      ScanOrchestrator.startScan(scan._id);

      logger.info(`Scan scheduled: ${scan._id} for target ${target.name}`);
      return res.status(202).json({
        message: 'Scan successfully queued',
        scanId: scan._id,
        status: scan.status
      });
    } catch (err) {
      logger.error(`Failed to initiate scan: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get live scan progress & status
   */
  static async getScanStatus(req, res) {
    try {
      const { id } = req.params;
      const scan = await Scan.findById(id);
      if (!scan) {
        return res.status(404).json({ error: 'Scan not found' });
      }

      return res.json(scan);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get findings list for a scan
   */
  static async getScanFindings(req, res) {
    try {
      const { id } = req.params;
      const { severity, category, tool } = req.query;

      const scan = await Scan.findById(id);
      if (!scan) {
        return res.status(404).json({ error: 'Scan not found' });
      }

      let findings = await Finding.findByScanId(id);

      if (severity) {
        findings = findings.filter(
          (f) => f.severity.toUpperCase() === severity.toUpperCase()
        );
      }
      if (category) {
        findings = findings.filter(
          (f) => f.category.toUpperCase() === category.toUpperCase()
        );
      }
      if (tool) {
        findings = findings.filter(
          (f) => f.tool.toLowerCase() === tool.toLowerCase()
        );
      }

      return res.json({
        scanId: id,
        total: findings.length,
        findings
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Before & After Comparison between current scan and previous scan
   */
  static async getBeforeAfterComparison(req, res) {
    try {
      const { id } = req.params;
      const currentScan = await Scan.findById(id);
      if (!currentScan) {
        return res.status(404).json({ error: 'Scan not found' });
      }

      const allScans = await Scan.findByTargetId(currentScan.targetId);
      const previousScan = allScans.find(
        (s) => String(s._id) !== String(id) && s.status === 'COMPLETED'
      );

      const currentFindings = await Finding.findByScanId(id);
      const previousFindings = previousScan ? await Finding.findByScanId(previousScan._id) : [];

      // Determine resolved and newly introduced findings
      const currentRuleKeys = new Set(
        currentFindings.map((f) => `${f.ruleId}:${f.location?.file || f.location?.url}`)
      );
      const previousRuleKeys = new Set(
        previousFindings.map((f) => `${f.ruleId}:${f.location?.file || f.location?.url}`)
      );

      const resolvedFindings = previousFindings.filter(
        (f) => !currentRuleKeys.has(`${f.ruleId}:${f.location?.file || f.location?.url}`)
      );
      const newFindings = currentFindings.filter(
        (f) => !previousRuleKeys.has(`${f.ruleId}:${f.location?.file || f.location?.url}`)
      );

      return res.json({
        targetId: currentScan.targetId,
        currentScan: {
          id: currentScan._id,
          score: currentScan.score,
          completedAt: currentScan.completedAt,
          summary: currentScan.summary
        },
        previousScan: previousScan
          ? {
              id: previousScan._id,
              score: previousScan.score,
              completedAt: previousScan.completedAt,
              summary: previousScan.summary
            }
          : null,
        delta: currentScan.scoreDelta,
        resolvedCount: resolvedFindings.length,
        resolvedFindings,
        newFindingsCount: newFindings.length,
        newFindings
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}
