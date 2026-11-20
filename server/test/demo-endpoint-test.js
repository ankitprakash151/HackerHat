import assert from 'assert';
import { connectDB } from '../src/config/db.js';
import { Target } from '../src/models/Target.js';
import { Scan } from '../src/models/Scan.js';
import { Finding } from '../src/models/Finding.js';
import { DemoOrchestrator } from '../src/services/demoOrchestrator.js';

async function runDirectTest() {
  await connectDB();

  // Test demo target creation & auto verification
  const target = await Target.create({
    type: 'github_repo',
    name: 'direct-demo-app',
    url: 'https://github.com/vibe-org/direct-demo-app',
    verified: false
  });

  const scan = await Scan.create({
    targetId: target._id,
    status: 'QUEUED',
    isDemo: true
  });

  await DemoOrchestrator.finalizeDemoScan(scan._id, target._id, false);
  const updatedScan = await Scan.findById(scan._id);
  assert.strictEqual(updatedScan.score, 45);

  const findings = await Finding.findByScanId(scan._id);
  assert(findings.length >= 3);

  console.log('✅ Demo orchestrator direct test passed');
}

runDirectTest().catch(console.error);
