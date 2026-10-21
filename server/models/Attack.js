import mongoose from 'mongoose';

const attackSchema = new mongoose.Schema({
  activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  territory: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', required: true },
  fromOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now, required: true },
});

attackSchema.index({ activity: 1, territory: 1 }, { unique: true });

export default mongoose.model('Attack', attackSchema);
