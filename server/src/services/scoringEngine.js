export class ScoringEngine {
  /**
   * Weights for score deductions
   */
  static WEIGHTS = {
    CRITICAL: 20,
    HIGH: 20,
    MEDIUM: 10,
    LOW: 5,
    INFO: 0
  };

  /**
   * Mandatory legal and technical disclaimer
   */
  static DISCLAIMER =
    'Notice: A high security score reflects checks against common known automated vulnerabilities (OWASP Top 10, exposed secrets, and standard static/dynamic patterns), not a 100% guarantee of immunity from targeted attacks, zero-day vulnerabilities, or business logic flaws.';

  /**
   * Calculates 0–100 score from findings list
   */
  static calculateScore(findings = []) {
    let score = 100;
    const summary = {
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      infoCount: 0,
      totalCount: findings.length
    };

    const categoryBreakdown = {
      secrets: 0,
      auth: 0,
      crypto: 0,
      injection: 0,
      headers: 0,
      exposedFiles: 0,
      misconfig: 0
    };

    for (const f of findings) {
      const sev = (f.severity || 'LOW').toUpperCase();
      if (sev === 'CRITICAL') {
        summary.criticalCount++;
        score -= this.WEIGHTS.CRITICAL;
      } else if (sev === 'HIGH') {
        summary.highCount++;
        score -= this.WEIGHTS.HIGH;
      } else if (sev === 'MEDIUM') {
        summary.mediumCount++;
        score -= this.WEIGHTS.MEDIUM;
      } else if (sev === 'LOW') {
        summary.lowCount++;
        score -= this.WEIGHTS.LOW;
      } else {
        summary.infoCount++;
      }

      // Track categories
      const cat = (f.category || 'MISCONFIG').toUpperCase();
      if (cat === 'SECRETS') categoryBreakdown.secrets++;
      else if (cat === 'AUTH_BYPASS') categoryBreakdown.auth++;
      else if (cat === 'CRYPTO') categoryBreakdown.crypto++;
      else if (cat === 'INJECTION') categoryBreakdown.injection++;
      else if (cat === 'HEADERS') categoryBreakdown.headers++;
      else if (cat === 'EXPOSED_FILES') categoryBreakdown.exposedFiles++;
      else categoryBreakdown.misconfig++;
    }

    // Floor at 0 and cap at 100
    const finalScore = Math.max(0, Math.min(100, score));
    const grade = this.computeGrade(finalScore);
    const executiveSummary = this.generateExecutiveSummary(finalScore, summary);

    return {
      score: finalScore,
      grade,
      summary,
      categoryBreakdown,
      executiveSummary,
      disclaimer: this.DISCLAIMER
    };
  }

  /**
   * Computes Letter Grade
   */
  static computeGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    return 'F';
  }

  /**
   * Computes Before & After Comparison Delta
   */
  static computeDelta(currentScore, previousScore) {
    if (previousScore === null || previousScore === undefined) {
      return null;
    }
    return currentScore - previousScore;
  }

  /**
   * Generates a plain-English, beginner-friendly executive narrative
   */
  static generateExecutiveSummary(score, summary) {
    if (summary.totalCount === 0) {
      return 'Outstanding job! No security vulnerabilities or hardcoded secrets were detected during this scan. Your baseline configurations match current security best practices.';
    }

    if (score >= 85) {
      return `Good security baseline with a score of ${score}/100. We found ${summary.totalCount} low-to-medium priority items that can be quickly resolved using the provided AI prompts.`;
    }

    if (score >= 50) {
      return `Attention recommended: Your application scored ${score}/100. There are ${summary.highCount + summary.criticalCount} high-risk findings (including security configurations or authentication gaps) that should be addressed before deploying to production.`;
    }

    return `Critical Action Needed: Your application scored ${score}/100. ${summary.criticalCount} critical vulnerabilities and ${summary.highCount} high-severity risks were identified. Attackers could potentially exploit these to compromise credentials, access databases, or breach user accounts. Use the One-Click AI Fix Prompts below to remediate them immediately.`;
  }
}
