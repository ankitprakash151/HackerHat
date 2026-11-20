import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { isUsingMemoryStore, getMemoryStore } from '../config/db.js';

const FindingSchema = new mongoose.Schema(
  {
    scanId: { type: String, required: true },
    targetId: { type: String, required: true },
    tool: {
      type: String,
      required: true,
      enum: ['semgrep', 'gitleaks', 'zap', 'inspector']
    },
    ruleId: { type: String, required: true },
    title: { type: String, required: true },
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
    },
    category: {
      type: String,
      required: true,
      enum: [
        'SECRETS',
        'AUTH_BYPASS',
        'CRYPTO',
        'INJECTION',
        'HEADERS',
        'EXPOSED_FILES',
        'MISCONFIG'
      ]
    },
    cwe: { type: String }, // e.g. "CWE-798"
    owasp: { type: String }, // e.g. "A01:2021-Broken Access Control"

    // Non-security expert friendly explanations
    plainEnglish: {
      whatItIs: { type: String, required: true },
      whyItMatters: { type: String, required: true },
      howToFix: { type: String, required: true }
    },

    // One-Click copy-paste AI prompt
    aiPrompt: {
      role: { type: String, default: 'Senior Application Security Engineer' },
      targetFile: { type: String },
      lineNumber: { type: Number },
      vulnerableCode: { type: String },
      instructions: { type: String },
      formattedPrompt: { type: String, required: true }
    },

    // Code location or URL location
    location: {
      file: { type: String },
      startLine: { type: Number },
      endLine: { type: Number },
      column: { type: Number },
      url: { type: String },
      parameter: { type: String },
      evidence: { type: String }
    },

    rawOutput: { type: mongoose.Schema.Types.Mixed },
    status: {
      type: String,
      enum: ['OPEN', 'FIXED', 'FALSE_POSITIVE', 'IGNORED'],
      default: 'OPEN'
    }
  },
  { timestamps: true }
);

const MongooseFinding = mongoose.models.Finding || mongoose.model('Finding', FindingSchema);

export const Finding = {
  schema: FindingSchema,
  mongooseModel: MongooseFinding,

  async create(data) {
    if (isUsingMemoryStore()) {
      const id = data._id || uuidv4();
      const finding = {
        _id: id,
        ...data,
        status: data.status || 'OPEN',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      getMemoryStore().findings.set(String(id), finding);
      return finding;
    }
    return await MongooseFinding.create(data);
  },

  async insertMany(items) {
    if (isUsingMemoryStore()) {
      const inserted = [];
      for (const item of items) {
        const id = item._id || uuidv4();
        const record = {
          _id: id,
          ...item,
          status: item.status || 'OPEN',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        getMemoryStore().findings.set(String(id), record);
        inserted.push(record);
      }
      return inserted;
    }
    return await MongooseFinding.insertMany(items);
  },

  async find(query = {}) {
    if (isUsingMemoryStore()) {
      const all = Array.from(getMemoryStore().findings.values());
      return all.filter((f) => {
        return Object.entries(query).every(([k, v]) => f[k] === v);
      });
    }
    return await MongooseFinding.find(query).lean();
  },

  async findByScanId(scanId) {
    if (isUsingMemoryStore()) {
      const all = Array.from(getMemoryStore().findings.values());
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
      return all
        .filter((f) => String(f.scanId) === String(scanId))
        .sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));
    }
    return await MongooseFinding.find({ scanId }).lean();
  },

  async updateById(id, updateData) {
    if (isUsingMemoryStore()) {
      const existing = getMemoryStore().findings.get(String(id));
      if (!existing) return null;
      const updated = { ...existing, ...updateData, updatedAt: new Date() };
      getMemoryStore().findings.set(String(id), updated);
      return updated;
    }
    return await MongooseFinding.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }
};
