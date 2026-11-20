import { VerificationService } from '../services/verificationService.js';
import { Target } from '../models/Target.js';
import { logger } from '../utils/logger.js';

export class VerifyController {
  /**
   * Request a unique ownership token for a target
   */
  static async getVerificationToken(req, res) {
    try {
      const { targetId } = req.body;
      const target = await Target.findById(targetId);
      if (!target) {
        return res.status(404).json({ error: 'Target not found' });
      }

      let token = target.verificationToken;
      if (!token) {
        token = VerificationService.generateVerificationToken();
        await Target.updateById(targetId, { verificationToken: token });
      }

      return res.json({
        token,
        wellKnownPath: '/.well-known/vibeshield.txt',
        expectedFileContent: token,
        dnsRecordName: '_vibeshield',
        dnsRecordValue: token
      });
    } catch (err) {
      logger.error(`Error generating verification token: ${err.message}`);
      return res.status(500).json({ error: err.message });
    }
  }

  /**
   * Method 1: Verify GitHub Repository Access
   */
  static async verifyGitHub(req, res) {
    try {
      const { targetId, repoUrl, userAccessToken, isDemo } = req.body;
      if (!targetId || !repoUrl) {
        return res.status(400).json({ error: 'targetId and repoUrl are required' });
      }

      if (isDemo) {
        await Target.updateById(targetId, {
          verified: true,
          verificationMethod: 'github_oauth',
          verifiedAt: new Date()
        });
        return res.json({
          success: true,
          verified: true,
          message: 'GitHub repository ownership verified (Demo Mode)!'
        });
      }

      const result = await VerificationService.verifyGitHubOwnership(
        targetId,
        userAccessToken || req.headers['x-github-token'],
        repoUrl
      );

      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message, verified: false });
    }
  }

  /**
   * Method 2: Verify and extract uploaded ZIP file
   */
  static async verifyZip(req, res) {
    try {
      const { targetId, isDemo } = req.body;
      if (!targetId) {
        return res.status(400).json({ error: 'targetId is required' });
      }

      if (isDemo) {
        await Target.updateById(targetId, {
          verified: true,
          verificationMethod: 'zip_upload',
          verifiedAt: new Date()
        });
        return res.json({
          success: true,
          verified: true,
          filesExtracted: 42,
          message: 'ZIP archive verified and extracted into sandbox (Demo Mode)!'
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'ZIP file archive is required in multipart upload' });
      }

      const result = await VerificationService.verifyAndExtractZip(
        targetId,
        req.file.path,
        req.file.originalname
      );

      return res.json(result);
    } catch (err) {
      logger.error(`ZIP verification error: ${err.message}`);
      return res.status(400).json({ error: err.message, verified: false });
    }
  }

  /**
   * Method 3: Verify Live URL ownership via /.well-known/vibeshield.txt or DNS TXT
   */
  static async verifyLiveUrl(req, res) {
    try {
      const { targetId, targetUrl, isDemo } = req.body;
      if (!targetId || !targetUrl) {
        return res.status(400).json({ error: 'targetId and targetUrl are required' });
      }

      if (isDemo) {
        await Target.updateById(targetId, {
          verified: true,
          verificationMethod: 'dns_file',
          verifiedAt: new Date()
        });
        return res.json({
          success: true,
          verified: true,
          method: 'dns_file',
          message: 'Domain ownership verified via demo bypass!'
        });
      }

      const result = await VerificationService.verifyLiveUrlOwnership(targetId, targetUrl);
      if (!result.verified) {
        return res.status(422).json(result);
      }

      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message, verified: false });
    }
  }

  /**
   * Direct Demo Mode Bypass endpoint
   */
  static async demoBypass(req, res) {
    try {
      const { targetId } = req.body;
      if (!targetId) {
        return res.status(400).json({ error: 'targetId is required' });
      }

      const target = await Target.findById(targetId);
      if (!target) {
        return res.status(404).json({ error: 'Target not found' });
      }

      const method =
        target.type === 'zip_archive'
          ? 'zip_upload'
          : target.type === 'live_url'
          ? 'dns_file'
          : 'github_oauth';

      const updated = await Target.updateById(targetId, {
        verified: true,
        verificationMethod: method,
        verifiedAt: new Date()
      });

      return res.json({
        success: true,
        verified: true,
        verificationMethod: method,
        target: updated,
        message: 'Target ownership successfully verified (Demo Mode Bypass)'
      });
    } catch (err) {
      logger.error(`Demo bypass error: ${err.message}`);
      return res.status(500).json({ error: err.message, verified: false });
    }
  }
}
