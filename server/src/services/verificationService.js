import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';
import unzipper from 'unzipper';
import { Target } from '../models/Target.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { resolveSafePath, validateGitHubUrl, validateAndSanitizeUrl } from '../utils/sanitizer.js';

const resolveTxt = promisify(dns.resolveTxt);

export class VerificationService {
  /**
   * Generates a cryptographically strong, unique verification token
   */
  static generateVerificationToken() {
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `vibeshield-verify=vs_tok_${randomBytes}`;
  }

  /**
   * Method 1: GitHub Repository Ownership Check
   * Checks if user has write/admin permissions on the submitted repository
   */
  static async verifyGitHubOwnership(targetId, userAccessToken, repoUrl) {
    const { owner, repo } = validateGitHubUrl(repoUrl);

    // If no GitHub OAuth token provided (e.g. testing or user not linked OAuth)
    if (!userAccessToken) {
      // In development / demo, if the user specifies an authorized test flag or public repo check
      if (env.NODE_ENV === 'development' && process.env.ALLOW_DEV_GITHUB_VERIFY === 'true') {
        const target = await Target.updateById(targetId, {
          verified: true,
          verificationMethod: 'github_oauth',
          verifiedAt: new Date()
        });
        logger.audit('TARGET_VERIFIED', 'dev_mode', { targetId, method: 'github_oauth' });
        return { success: true, verified: true, message: 'Verified repository via dev bypass mode' };
      }
      throw new Error('GitHub OAuth Access Token is required to verify repository write permissions');
    }

    // Call GitHub API to check repository permissions
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'VibeShield-Ownership-Verifier/1.0'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Repository ${owner}/${repo} not found or user lacks access.`);
        }
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      const repoData = await response.json();
      const permissions = repoData.permissions || {};
      const hasWriteAccess = permissions.admin === true || permissions.push === true;

      if (!hasWriteAccess) {
        throw new Error('Verification failed: User does not possess push/admin permissions for this repository.');
      }

      const target = await Target.updateById(targetId, {
        verified: true,
        verificationMethod: 'github_oauth',
        verifiedAt: new Date(),
        metadata: {
          gitBranch: repoData.default_branch || 'main',
          stars: repoData.stargazers_count,
          owner: repoData.owner?.login
        }
      });

      logger.audit('TARGET_VERIFIED', owner, { targetId, repo: `${owner}/${repo}`, method: 'github_oauth' });
      return { success: true, verified: true, target };
    } catch (err) {
      logger.warn(`GitHub verification failed for target ${targetId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Method 2: ZIP Archive Verification & Isolated Extraction
   * Protects against Zip Slip (Path Traversal) and bomb attacks
   */
  static async verifyAndExtractZip(targetId, zipFilePath, originalFilename) {
    const target = await Target.findById(targetId);
    if (!target) {
      throw new Error('Target not found');
    }

    // Create unique isolated sandbox folder for this target extraction
    const extractionDir = path.join(env.TEMP_UPLOAD_DIR, `sandbox_${targetId}_${Date.now()}`);
    fs.mkdirSync(extractionDir, { recursive: true });

    let extractedFilesCount = 0;
    const maxFiles = 5000;
    const maxTotalSize = 100 * 1024 * 1024; // 100MB uncompressed limit
    let totalSize = 0;

    try {
      const directory = await unzipper.Open.file(zipFilePath);

      for (const file of directory.files) {
        extractedFilesCount++;
        if (extractedFilesCount > maxFiles) {
          throw new Error(`Archive exceeds maximum allowed file count (${maxFiles})`);
        }

        totalSize += file.uncompressedSize;
        if (totalSize > maxTotalSize) {
          throw new Error(`Uncompressed archive size exceeds maximum safe limit (${maxTotalSize / 1024 / 1024}MB)`);
        }

        // Zip Slip / Directory Traversal Defense
        const safeDestination = resolveSafePath(extractionDir, file.path);

        if (file.type === 'Directory') {
          fs.mkdirSync(safeDestination, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(safeDestination), { recursive: true });
          await new Promise((resolve, reject) => {
            file
              .stream()
              .pipe(fs.createWriteStream(safeDestination))
              .on('finish', resolve)
              .on('error', reject);
          });
        }
      }

      // Automatically clean up uploaded raw zip file
      try {
        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }
      } catch (err) {
        logger.warn(`Could not delete temp zip: ${err.message}`);
      }

      // Mark target verified
      const updatedTarget = await Target.updateById(targetId, {
        verified: true,
        verificationMethod: 'zip_upload',
        verifiedAt: new Date(),
        localPath: extractionDir,
        metadata: {
          fileCount: extractedFilesCount,
          originalZipName: originalFilename
        }
      });

      logger.audit('TARGET_VERIFIED', 'user', { targetId, method: 'zip_upload', files: extractedFilesCount });
      return {
        success: true,
        verified: true,
        filesExtracted: extractedFilesCount,
        target: updatedTarget
      };
    } catch (err) {
      // Clean up extracted directory on error
      try {
        if (fs.existsSync(extractionDir)) {
          fs.rmSync(extractionDir, { recursive: true, force: true });
        }
      } catch {}
      logger.error(`ZIP extraction failed for target ${targetId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Method 3: DNS or File-based Verification for Live URLs
   * Checks /.well-known/vibeshield.txt for token, or checks DNS TXT record
   */
  static async verifyLiveUrlOwnership(targetId, targetUrl) {
    const target = await Target.findById(targetId);
    if (!target) {
      throw new Error('Target not found');
    }

    if (!target.verificationToken) {
      // Generate token if not yet assigned
      const token = this.generateVerificationToken();
      await Target.updateById(targetId, { verificationToken: token });
      target.verificationToken = token;
    }

    const expectedToken = target.verificationToken;
    const sanitizedUrl = validateAndSanitizeUrl(targetUrl);
    const parsed = new URL(sanitizedUrl);

    // 1. Try /.well-known/vibeshield.txt HTTP verification
    const wellKnownUrl = `${parsed.origin}/.well-known/vibeshield.txt`;
    logger.info(`Checking well-known verification at: ${wellKnownUrl}`);

    let fileVerified = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(wellKnownUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'VibeShield-Ownership-Verifier/1.0' }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const text = await response.text();
        if (text.includes(expectedToken)) {
          fileVerified = true;
        }
      }
    } catch (err) {
      logger.info(`HTTP .well-known check did not succeed: ${err.message}`);
    }

    if (fileVerified) {
      const updatedTarget = await Target.updateById(targetId, {
        verified: true,
        verificationMethod: 'dns_file',
        verifiedAt: new Date()
      });
      logger.audit('TARGET_VERIFIED', 'user', { targetId, method: 'dns_file', type: 'http_well_known' });
      return { success: true, verified: true, method: 'http_file', target: updatedTarget };
    }

    // 2. Try DNS TXT record fallback
    let dnsVerified = false;
    try {
      const domain = parsed.hostname;
      const records = await resolveTxt(domain);
      for (const recordSet of records) {
        for (const entry of recordSet) {
          if (entry.includes(expectedToken)) {
            dnsVerified = true;
            break;
          }
        }
      }
    } catch (err) {
      logger.info(`DNS TXT check error: ${err.message}`);
    }

    if (dnsVerified) {
      const updatedTarget = await Target.updateById(targetId, {
        verified: true,
        verificationMethod: 'dns_file',
        verifiedAt: new Date()
      });
      logger.audit('TARGET_VERIFIED', 'user', { targetId, method: 'dns_file', type: 'dns_txt' });
      return { success: true, verified: true, method: 'dns_txt', target: updatedTarget };
    }

    // If both failed, return instruction on how user can complete it
    return {
      success: false,
      verified: false,
      message: `Ownership token not found. Please create a file at ${parsed.origin}/.well-known/vibeshield.txt containing "${expectedToken}" or add a DNS TXT record with that value.`,
      expectedToken,
      wellKnownUrl
    };
  }
}
