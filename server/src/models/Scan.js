import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { isUsingMemoryStore, getMemoryStore } from '../config/db.js';

const ScanSchema = new mongoose.Schema(
  {
    targetId: { type: String, required: true },
    targetUrl: { type: String },
    targetType: { type: String },
    status: {
      type: String,
      enum: ['QUEUED', 'STAGE_1_SAST', 'STAGE_2_DAST', 'ANALYZING', 'COMPLETED', 'FAILED'],
      default: 'QUEUED'
    },
    currentStage: {
      type: String,
      enum: ['init', 'sast', 'dast', 'analysis', 'done', 'failed'],
      default: 'init'
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    stageProgress: {
      sast: {
        status: { type: String, default: 'pending' },
        progress: { type: Number, default: 0 },
        tool: { type: String, default: 'semgrep + gitleaks' },
        findingsCount: { type: Number, default: 0 },
        message: { type: String, default: 'Waiting to start static analysis' },
        error: { type: String }
      },
      dast: {
        status: { type: String, default: 'pending' },
        progress: { type: Number, default: 0 },
        tool: { type: String, default: 'owasp-zap' },
        findingsCount: { type: Number, default: 0 },
        message: { type: String, default: 'Waiting for dynamic sandbox scan' },
        error: { type: String }
      }
    },
    score: { type: Number, min: 0, max: 100, default: null },
    scoreDelta: { type: Number, default: null },
    previousScanId: { type: String, default: null },
    summary: {
      criticalCount: { type: Number, default: 0 },
      highCount: { type: Number, default: 0 },
      mediumCount: { type: Number, default: 0 },
      lowCount: { type: Number, default: 0 },
      infoCount: { type: Number, default: 0 },
      totalCount: { type: Number, default: 0 }
    },
    logMessages: [
      {
        timestamp: { type: Date, default: Date.now },
        stage: { type: String },
        message: { type: String },
        level: { type: String, default: 'info' }
      }
    ],
    startedAt: { type: Date },
    completedAt: { type: Date },
    durationSeconds: { type: Number },
    error: { type: String }
  },
  { timestamps: true }
);

const MongooseScan = mongoose.models.Scan || mongoose.model('Scan', ScanSchema);

export const Scan = {
  schema: ScanSchema,
  mongooseModel: MongooseScan,

  async create(data) {
    if (isUsingMemoryStore()) {
      const id = data._id || uuidv4();
      const scan = {
        _id: id,
        ...data,
        status: data.status || 'QUEUED',
        progress: data.progress || 0,
        summary: data.summary || {
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          infoCount: 0,
          totalCount: 0
        },
        logMessages: data.logMessages || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      getMemoryStore().scans.set(String(id), scan);
      return scan;
    }
    return await MongooseScan.create(data);
  },

  async findById(id) {
    if (isUsingMemoryStore()) {
      return getMemoryStore().scans.get(String(id)) || null;
    }
    return await MongooseScan.findById(id).lean();
  },

  async find(query = {}) {
    if (isUsingMemoryStore()) {
      const all = Array.from(getMemoryStore().scans.values());
      return all
        .filter((s) => {
          return Object.entries(query).every(([k, v]) => s[k] === v);
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return await MongooseScan.find(query).sort({ createdAt: -1 }).lean();
  },

  async findByTargetId(targetId) {
    if (isUsingMemoryStore()) {
      const all = Array.from(getMemoryStore().scans.values());
      return all
        .filter((s) => String(s.targetId) === String(targetId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return await MongooseScan.find({ targetId }).sort({ createdAt: -1 }).lean();
  },

  async updateById(id, updateData) {
    if (isUsingMemoryStore()) {
      const existing = getMemoryStore().scans.get(String(id));
      if (!existing) return null;

      // Handle deep merge for stageProgress or summary if present
      const updated = {
        ...existing,
        ...updateData,
        stageProgress: {
          ...existing.stageProgress,
          ...(updateData.stageProgress || {})
        },
        summary: {
          ...existing.summary,
          ...(updateData.summary || {})
        },
        updatedAt: new Date()
      };

      if (updateData.$push?.logMessages) {
        updated.logMessages = updated.logMessages || [];
        updated.logMessages.push(updateData.$push.logMessages);
      }

      getMemoryStore().scans.set(String(id), updated);
      return updated;
    }
    return await MongooseScan.findByIdAndUpdate(id, updateData, { new: true }).lean();
  },

  async addLogMessage(id, stage, message, level = 'info') {
    const logItem = { timestamp: new Date(), stage, message, level };
    if (isUsingMemoryStore()) {
      const scan = getMemoryStore().scans.get(String(id));
      if (scan) {
        scan.logMessages = scan.logMessages || [];
        scan.logMessages.push(logItem);
      }
      return logItem;
    }
    await MongooseScan.findByIdAndUpdate(id, {
      $push: { logMessages: logItem }
    });
    return logItem;
  }
};
