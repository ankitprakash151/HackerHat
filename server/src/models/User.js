import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { isUsingMemoryStore, getMemoryStore } from '../config/db.js';

const UserSchema = new mongoose.Schema(
  {
    githubId: { type: String, unique: true, sparse: true },
    username: { type: String, required: true },
    email: { type: String, sparse: true },
    avatarUrl: { type: String },
    accessToken: { type: String }, // Encrypted or stored securely
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    apiKeys: [
      {
        key: String,
        name: String,
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const MongooseUser = mongoose.models.User || mongoose.model('User', UserSchema);

// Universal Repository wrapper
export const User = {
  schema: UserSchema,
  mongooseModel: MongooseUser,

  async create(data) {
    if (isUsingMemoryStore()) {
      const id = data._id || uuidv4();
      const user = {
        _id: id,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      getMemoryStore().users.set(String(id), user);
      return user;
    }
    return await MongooseUser.create(data);
  },

  async findById(id) {
    if (isUsingMemoryStore()) {
      return getMemoryStore().users.get(String(id)) || null;
    }
    return await MongooseUser.findById(id).lean();
  },

  async findOne(query) {
    if (isUsingMemoryStore()) {
      const users = Array.from(getMemoryStore().users.values());
      return (
        users.find((u) => {
          return Object.entries(query).every(([k, v]) => u[k] === v);
        }) || null
      );
    }
    return await MongooseUser.findOne(query).lean();
  },

  async updateById(id, updateData) {
    if (isUsingMemoryStore()) {
      const existing = getMemoryStore().users.get(String(id));
      if (!existing) return null;
      const updated = { ...existing, ...updateData, updatedAt: new Date() };
      getMemoryStore().users.set(String(id), updated);
      return updated;
    }
    return await MongooseUser.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }
};
