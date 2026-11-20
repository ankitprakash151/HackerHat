import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { isUsingMemoryStore, getMemoryStore } from '../config/db.js';

const ReportSchema = new mongoose.Schema(
  {
    scanId: { type: String, required: true, unique: true },
    targetId: { type: String, required: true },
    targetName: { type: String },
    score: { type: Number, required: true },
    grade: { type: String }, // 'A+', 'B', 'C', 'F'
    scoreDelta: { type: Number, default: null },
    executiveSummary: { type: String },
    disclaimer: { type: String },
    findingsBreakdown: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      info: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    categoryBreakdown: {
      secrets: { type: Number, default: 0 },
      auth: { type: Number, default: 0 },
      crypto: { type: Number, default: 0 },
      injection: { type: Number, default: 0 },
      headers: { type: Number, default: 0 },
      exposedFiles: { type: Number, default: 0 },
      misconfig: { type: Number, default: 0 }
    },
    topRisks: [
      {
        title: String,
        severity: String,
        category: String,
        impact: String
      }
    ],
    pdfPath: { type: String },
    pdfUrl: { type: String }
  },
  { timestamps: true }
);

const MongooseReport = mongoose.models.Report || mongoose.model('Report', ReportSchema);

export const Report = {
  schema: ReportSchema,
  mongooseModel: MongooseReport,

  async create(data) {
    if (isUsingMemoryStore()) {
      const id = data._id || uuidv4();
      const report = {
        _id: id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      getMemoryStore().reports.set(String(id), report);
      return report;
    }
    return await MongooseReport.create(data);
  },

  async findByScanId(scanId) {
    if (isUsingMemoryStore()) {
      const all = Array.from(getMemoryStore().reports.values());
      return all.find((r) => String(r.scanId) === String(scanId)) || null;
    }
    return await MongooseReport.findOne({ scanId }).lean();
  },

  async findById(id) {
    if (isUsingMemoryStore()) {
      return getMemoryStore().reports.get(String(id)) || null;
    }
    return await MongooseReport.findById(id).lean();
  }
};
