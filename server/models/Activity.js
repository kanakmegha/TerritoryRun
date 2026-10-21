import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  clientActivityId: { type: String, required: true, maxlength: 80 },
  status: { type: String, enum: ['recording', 'submitted', 'accepted', 'rejected', 'processed'], default: 'recording', required: true },
  samples: [{ lat: Number, lng: Number, timestamp: Number, accuracy: Number }],
  submissionHash: { type: String, maxlength: 64 },
  submittedAt: Date,
  validation: {
    distance_m: Number,
    area_sqm: Number,
    perimeter_m: Number,
    duration_ms: Number,
    sample_count: Number,
    boundary: { type: { type: String, enum: ['Polygon'] }, coordinates: { type: [[[Number]]] } },
  },
  rejectionReason: { code: String, message: String },
  claimResult: { type: mongoose.Schema.Types.Mixed },
  // Trusted server-derived geometry retained separately from raw GPS evidence.
  serverValidated: { type: Boolean, default: false, required: true },
  claimEligible: { type: Boolean, default: false, required: true },
  // Development-only indoor test mode. Test activities can be submitted and
  // validated locally but must never create real territory or affect stats.
  isTest: { type: Boolean, default: false, required: true },
  claimBoundary: {
    type: {
      type: String,
      enum: ['Polygon'],
    },
    coordinates: { type: [[[Number]]] },
  },
  attackEvidence: [{
    territoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Territory', required: true },
    eligible: { type: Boolean, required: true },
  }],
}, { timestamps: true });

activitySchema.index({ owner: 1, clientActivityId: 1 }, {
  unique: true,
  partialFilterExpression: { clientActivityId: { $type: 'string' } },
});
activitySchema.index({ owner: 1, submissionHash: 1 }, {
  unique: true,
  partialFilterExpression: { submissionHash: { $type: 'string' } },
});

export default mongoose.model('Activity', activitySchema);
