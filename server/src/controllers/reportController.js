import fs from 'fs';
import { Report } from '../models/Report.js';
import { Finding } from '../models/Finding.js';
import { Scan } from '../models/Scan.js';
import { Target } from '../models/Target.js';
import { PromptGenerator } from '../services/promptGenerator.js';
import { PdfService } from '../services/pdfService.js';
import { logger } from '../utils/logger.js';

export class ReportController {
  /**
   * Get report overview by scanId
   */
  static async getReport(req, res) {
    try {
      const { scanId } = req.params;
      let report = await Report.findByScanId(scanId);

      if (!report) {
        // If report record is missing but scan is completed, regenerate on the fly
        const scan = await Scan.findById(scanId);
        if (!scan) {
          return res.status(404).json({ error: 'Scan not found' });
        }
        if (scan.status !== 'COMPLETED') {
          return res.status(400).json({ error: 'Report is only available for completed scans' });
        }
        const target = await Target.findById(scan.targetId);
        const findings = await Finding.findByScanId(scanId);
        const htmlPath = await PdfService.generateReportHtml(
          { score: scan.score, grade: 'B', executiveSummary: 'Security Report' },
          target,
          scan,
          findings
        );
        report = {
          scanId,
          targetId: scan.targetId,
          score: scan.score,
          executiveSummary: 'Automated Security Report',
          pdfPath: htmlPath
        };
      }

      return res.json(report);
    } catch (err) {
      logger.error(`Error fetching report: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Download the printable HTML / PDF document
   */
  static async downloadReport(req, res) {
    try {
      const { scanId } = req.params;
      const report = await Report.findByScanId(scanId);
      const scan = await Scan.findById(scanId);
      const target = scan ? await Target.findById(scan.targetId) : null;
      const findings = await Finding.findByScanId(scanId);

      if (!scan || !target) {
        return res.status(404).json({ error: 'Scan or target not found' });
      }

      const filePath = await PdfService.generateReportHtml(
        report || { score: scan.score, grade: 'B', executiveSummary: 'Security Audit' },
        target,
        scan,
        findings
      );

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="vibeshield-report-${scanId}.html"`);
      return res.sendFile(filePath);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Generates a single consolidated copy-paste AI prompt bundle for all findings
   */
  static async getPromptBundle(req, res) {
    try {
      const { scanId } = req.params;
      const findings = await Finding.findByScanId(scanId);

      const bundleText = PromptGenerator.generateMasterFixPlan(findings);

      return res.json({
        scanId,
        totalFindings: findings.length,
        bundleMarkdown: bundleText
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}
