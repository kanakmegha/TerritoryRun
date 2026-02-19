import mongoose from 'mongoose';

const tileSchema = new mongoose.Schema({
    index: { type: String, required: true, unique: true }, // H3 index
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ownerColor: String,
    timestamp: { type: Date, default: Date.now },
    // GeoJSON Point for MongoDB Geospatial Queries
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    }
});

// Index for Geospatial BBox queries
tileSchema.index({ location: '2dsphere' });
// Compound index for user lookups
tileSchema.index({ owner: 1, timestamp: -1 });

export default mongoose.model('Tile', tileSchema);
