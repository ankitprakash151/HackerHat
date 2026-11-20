import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { connectDB } from '../src/config/db.js';
import { Target } from '../src/models/Target.js';
import { Scan } from '../src/models/Scan.js';
import { Finding } from '../src/models/Finding.js';
import { VerificationService } from '../src/services/verificationService.js';
import { SastRunner } from '../src/services/sastRunner.js';
import { ScoringEngine } from '../src/services/scoringEngine.js';
import { PromptGenerator } from '../src/services/promptGenerator.js';
import { PdfService } from '../src/services/pdfService.js';
import { ScanOrchestrator } from '../src/services/orchestrator.js';
import { DemoOrchestrator } from '../src/services/demoOrchestrator.js';
import { redactSecrets } from '../src/utils/sanitizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTestSuite() {
  await connectDB();
  console.log('====================================================');
  console.log('🧪 RUNNING VIBESHIELD COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  // Test 1: Secret Redaction
  console.log('Test 1: Redaction of Secrets in Snippets...');
  const secretSample = 'const key = "sk-proj-1234567890abcdef1234567890abcdef12345678"; const db = "mongodb+srv://admin:mySuperSecretPwd@cluster0.net";';
  const redacted = redactSecrets(secretSample);
  assert(!redacted.includes('1234567890abcdef1234567890abcdef'), 'OpenAI key should be redacted');
  assert(!redacted.includes('mySuperSecretPwd'), 'MongoDB password should be redacted');
  assert(redacted.includes('REDACTED'), 'Redacted marker should be present');
  console.log('  ✅ Passed: Secrets successfully masked in code snippets & logs\n');

  // Test 2: Target Creation & Verification Gate
  console.log('Test 2: Ownership Verification Gate...');
  const testTarget = await Target.create({
    type: 'github_repo',
    name: 'test-org/vulnerable-app',
    url: 'https://github.com/test-org/vulnerable-app',
    verified: false,
    verificationToken: VerificationService.generateVerificationToken()
  });

  assert.strictEqual(testTarget.verified, false, 'Target must start unverified');

  // Attempting to run scan before verification must fail
  const unverifiedScan = await Scan.create({
    targetId: testTarget._id,
    status: 'QUEUED'
  });
  await ScanOrchestrator.executeScanPipeline(unverifiedScan._id);
  const updatedUnverifiedScan = await Scan.findById(unverifiedScan._id);
  assert.strictEqual(updatedUnverifiedScan.status, 'FAILED', 'Scan must fail if target is unverified');
  console.log('  ✅ Passed: Scan blocked when target is not verified (Mandatory Gate enforced)\n');

  // Now verify target
  await Target.updateById(testTarget._id, {
    verified: true,
    verificationMethod: 'github_oauth',
    verifiedAt: new Date(),
    localPath: path.resolve(__dirname, '../../test-targets/vulnerable-app')
  });
  console.log('  ✅ Passed: Target successfully verified\n');

  // Test 3: Static Analysis (SAST) on Vulnerable Target
  console.log('Test 3: Executing Stage 1 SAST against vulnerable test target...');
  const vulnerableDir = path.resolve(__dirname, '../../test-targets/vulnerable-app');
  const findings = await SastRunner.fallbackSemgrepScanner(vulnerableDir, 'scan_test_1', testTarget._id);
  const secretFindings = await SastRunner.fallbackSecretScanner(vulnerableDir, 'scan_test_1', testTarget._id);
  const allFindings = [...findings, ...secretFindings];

  console.log(`  Found ${allFindings.length} total vulnerabilities:`);
  allFindings.forEach((f) => {
    console.log(`    - [${f.severity}] ${f.title} (${f.location?.file}:${f.location?.startLine || 1})`);
  });

  assert(allFindings.some((f) => f.ruleId.includes('md5')), 'Must detect MD5 weak password hashing');
  assert(allFindings.some((f) => f.ruleId.includes('plaintext-password')), 'Must detect plaintext password comparison');
  assert(allFindings.some((f) => f.ruleId.includes('missing-auth')), 'Must detect missing authentication middleware');
  assert(allFindings.some((f) => f.ruleId.includes('none-algorithm')), 'Must detect JWT "none" algorithm');
  assert(allFindings.some((f) => f.ruleId.includes('hardcoded-jwt')), 'Must detect hardcoded JWT secret');
  assert(allFindings.some((f) => f.ruleId.includes('env-dump') || f.ruleId.includes('committed-env')), 'Must detect exposed .env leak');
  assert(allFindings.some((f) => f.ruleId.includes('openai-api-key')), 'Must detect hardcoded OpenAI API key');
  console.log('  ✅ Passed: All 7 intended vibe-code vulnerability classes detected\n');

  // Test 4: Scoring Engine
  console.log('Test 4: Scoring Engine & Deduction Evaluation...');
  const scoreResult = ScoringEngine.calculateScore(allFindings);
  console.log(`  Calculated Score: ${scoreResult.score}/100 (Grade: ${scoreResult.grade})`);
  console.log(`  Summary: ${scoreResult.summary.criticalCount} Critical, ${scoreResult.summary.highCount} High, ${scoreResult.summary.mediumCount} Medium`);
  assert(scoreResult.score < 50, 'Vulnerable prototype must receive a low score (< 50)');
  assert.strictEqual(scoreResult.grade, 'F', 'Score < 50 must have Grade F');
  assert(scoreResult.disclaimer.includes('not a 100% guarantee'), 'Disclaimer must be present');
  console.log('  ✅ Passed: Score, grade, and disclaimer generated correctly\n');

  // Test 5: AI Fix Prompt Generation
  console.log('Test 5: One-Click AI Fix Prompt Generator...');
  const md5Finding = allFindings.find((f) => f.ruleId.includes('md5'));
  const prompt = PromptGenerator.generatePrompt(md5Finding);
  assert(prompt.formattedPrompt.includes('You are a Senior Full-Stack & Application Security Engineer'), 'Must contain persona');
  assert(prompt.formattedPrompt.includes(md5Finding.title), 'Must contain title');
  assert(prompt.formattedPrompt.includes('SECURITY REMEDIATION GOAL'), 'Must contain remediation goal');
  console.log('  Sample AI Fix Prompt Preview:\n');
  console.log(prompt.formattedPrompt.slice(0, 350) + '\n...[truncated for test output]...\n');
  console.log('  ✅ Passed: AI Fix Prompt accurately formatted for Cursor/Claude/ChatGPT\n');

  // Test 6: Before & After Comparison Delta
  console.log('Test 6: Before & After Score Delta Calculation...');
  const initialScore = 35;
  const retestedScore = 92;
  const delta = ScoringEngine.computeDelta(retestedScore, initialScore);
  assert.strictEqual(delta, 57, 'Delta must equal 92 - 35 = 57');
  console.log(`  Delta from 35/100 to 92/100: +${delta} points`);
  console.log('  ✅ Passed: Before & After comparison delta verified\n');

  // Test 7: Full Pipeline Execution via Orchestrator
  console.log('Test 7: Full End-to-End Orchestrator Pipeline...');
  const activeScan = await Scan.create({
    targetId: testTarget._id,
    targetUrl: testTarget.url,
    targetType: testTarget.type,
    status: 'QUEUED'
  });

  const completedScan = await ScanOrchestrator.executeScanPipeline(activeScan._id);
  assert.strictEqual(completedScan.status, 'COMPLETED', 'Scan should complete successfully');
  assert(completedScan.score !== null, 'Scan should have a calculated score');
  console.log(`  Orchestrator completed scan in ${completedScan.durationSeconds}s with score: ${completedScan.score}/100`);
  console.log('  ✅ Passed: Orchestrator executed stages, saved findings, and generated score\n');

  // Test 8: Demo Mode Instant Pipeline & Re-Scan Flow
  console.log('Test 8: Demo Mode Pipeline (Initial 45/100 -> Re-Scan 95/100)...');
  const demoTarget = await Target.create({
    type: 'github_repo',
    name: 'vibe-org/cursor-demo-app',
    url: 'https://github.com/vibe-org/cursor-demo-app',
    verified: false
  });

  // Initial Demo Scan
  const demoScan1 = await Scan.create({
    targetId: demoTarget._id,
    status: 'QUEUED'
  });

  // Finalize initial demo scan directly to test output
  await DemoOrchestrator.finalizeDemoScan(demoScan1._id, demoTarget._id, false);
  const finishedDemo1 = await Scan.findById(demoScan1._id);
  assert.strictEqual(finishedDemo1.status, 'COMPLETED', 'Demo scan 1 should complete');
  assert.strictEqual(finishedDemo1.score, 45, 'Initial Demo score must be 45/100');
  const demoFindings1 = await Finding.findByScanId(demoScan1._id);
  assert(demoFindings1.length >= 3, 'Must have realistic demo findings');
  console.log(`  Initial Demo Scan: ${finishedDemo1.score}/100 with ${demoFindings1.length} findings`);

  // Re-Scan Demo
  const demoScan2 = await Scan.create({
    targetId: demoTarget._id,
    status: 'QUEUED'
  });
  await DemoOrchestrator.finalizeDemoScan(demoScan2._id, demoTarget._id, true);
  const finishedDemo2 = await Scan.findById(demoScan2._id);
  assert.strictEqual(finishedDemo2.status, 'COMPLETED', 'Demo scan 2 should complete');
  assert.strictEqual(finishedDemo2.score, 95, 'Re-Scan Demo score must be 95/100');
  assert.strictEqual(finishedDemo2.scoreDelta, 50, 'Score Delta must be +50');
  console.log(`  Re-Scan Demo: ${finishedDemo2.score}/100 (Score Delta: +${finishedDemo2.scoreDelta} pts improved)`);
  console.log('  ✅ Passed: Demo Mode Initial Scan & Before/After Re-Scan flow fully verified\n');

  console.log('====================================================');
  console.log('🎉 ALL VIBESHIELD BACKEND TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
