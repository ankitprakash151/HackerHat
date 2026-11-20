import { Target } from '../models/Target.js';
import { Scan } from '../models/Scan.js';
import { VerificationService } from '../services/verificationService.js';
import { validateAndSanitizeUrl, validateGitHubUrl } from '../utils/sanitizer.js';
import { logger } from '../utils/logger.js';

export class TargetController {
  /**
   * List all targets
   */
  static async listTargets(req, res) {
    try {
      const targets = await Target.find({});
      return res.json(targets);
    } catch (err) {
      logger.error(`Error listing targets: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Create a new target
   */
  static async createTarget(req, res) {
    try {
      const { type, name, url } = req.body;

      if (!type || !['github_repo', 'live_url', 'zip_archive'].includes(type)) {
        return res.status(400).json({
          error: 'Valid target type is required: github_repo, live_url, or zip_archive'
        });
      }

      let sanitizedUrl = url ? url.trim() : '';
      let targetName = name ? name.trim() : '';

      if (type === 'github_repo') {
        const gh = validateGitHubUrl(sanitizedUrl);
        sanitizedUrl = gh.normalizedUrl;
        targetName = targetName || `${gh.owner}/${gh.repo}`;
      } else if (type === 'live_url') {
        sanitizedUrl = validateAndSanitizeUrl(sanitizedUrl);
        targetName = targetName || new URL(sanitizedUrl).hostname;
      } else if (type === 'zip_archive') {
        targetName = targetName || `Source Archive (${new Date().toLocaleDateString()})`;
      }

      // Generate verification token up front
      const verificationToken = VerificationService.generateVerificationToken();

      const target = await Target.create({
        type,
        name: targetName,
        url: sanitizedUrl,
        verified: false,
        verificationToken,
        userId: req.user?.id || 'anonymous'
      });

      logger.info(`Target created: ${target.name} (${target._id})`);
      return res.status(201).json(target);
    } catch (err) {
      logger.warn(`Failed to create target: ${err.message}`);
      return res.status(400).json({ error: err.message });
    }
  }

  /**
   * Get single target by ID with scan history
   */
  static async getTargetById(req, res) {
    try {
      const { id } = req.params;
      const target = await Target.findById(id);
      if (!target) {
        return res.status(404).json({ error: 'Target not found' });
      }

      const scans = await Scan.findByTargetId(id);

      return res.json({
        target,
        scans,
        latestScan: scans[0] || null
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Delete target
   */
  static async deleteTarget(req, res) {
    try {
      const { id } = req.params;
      const target = await Target.findById(id);
      if (!target) {
        return res.status(404).json({ error: 'Target not found' });
      }

      await Target.deleteById(id);
      logger.info(`Deleted target ${id}`);
      return res.json({ success: true, message: 'Target deleted' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
}
