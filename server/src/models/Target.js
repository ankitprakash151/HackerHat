import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { isUsingMemoryStore, getMemoryStore } from '../config/db.js';

const TargetSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['github_repo', 'live_url', 'zip_archive']
    },
    name: { type: String, required: true },
    url: { type: String }, // For GitHub repo or Live URL
    verified: { type: Boolean, default: false },
    verificationMethod: {
      type: String,
      enum: ['github_oauth', 'zip_upload', 'dns_file', null],
      default: null
    },
    verificationToken: { type: String }, // e.g. "vibeshield-verify=vs_tok_abc123"
    verifiedAt: { type: Date },
    localPath: { type: String }, // Path to extracted ZIP or cloned repo sandbox
    lastScore: { type: Number, min: 0, max: 100, default: null },
    lastScanAt: { type: Date },
    scansCount: { type: Number, default: 0 },
    userId: { type: String, default: 'anonymous' },
    metadata: {
      framework: { type: String },
      gitBranch: { type: String, default: 'main' },
      fileCount: { type: Number, default: 0 },
      liveHeadersChecked: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

const MongooseTarget = mongoose.models.Target || mongoose.model('Target', TargetSchema);

export const Target = {
  schema: TargetSchema,
  mongooseModel: MongooseTarget,

  async create(data) {
    if (isUsingMemoryStore()) {
      const id = data._id || uuidv4();
      const target = {
        _id: id,
        ...data,
        verified: data.verified || false,
        scansCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      getMemoryStore().targets.set(String(id), target);
      return target;
    }
    return await MongooseTarget.create(data);
  },

  async findById(id) {
    if (isUsingMemoryStore()) {
      return getMemoryStore().targets.get(String(id)) || null;
    }
    return await MongooseTarget.findById(id).lean();
  },

  async find(query = {}) {
    if (isUsingMemoryStore()) {
      const all = Array.from(getMemoryStore().targets.values());
      return all
        .filter((t) => {
          return Object.entries(query).every(([k, v]) => t[k] === v);
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return await MongooseTarget.find(query).sort({ createdAt: -1 }).lean();
  },

  async findOne(query) {
    if (isUsingMemoryStore()) {
      const all = Array.from(getMemoryStore().targets.values());
      return (
        all.find((t) => {
          return Object.entries(query).every(([k, v]) => t[k] === v);
        }) || null
      );
    }
    return await MongooseTarget.findOne(query).lean();
  },

  async updateById(id, updateData) {
    if (isUsingMemoryStore()) {
      const existing = getMemoryStore().targets.get(String(id));
      if (!existing) return null;
      const updated = { ...existing, ...updateData, updatedAt: new Date() };
      getMemoryStore().targets.set(String(id), updated);
      return updated;
    }
    return await MongooseTarget.findByIdAndUpdate(id, updateData, { new: true }).lean();
  },

  async deleteById(id) {
    if (isUsingMemoryStore()) {
      const deleted = getMemoryStore().targets.delete(String(id));
      return deleted;
    }
    return await MongooseTarget.findByIdAndDelete(id).lean();
  }
};
