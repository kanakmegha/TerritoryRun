import mongoose from 'mongoose';

const territorySchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    ownerColor: String,
    timestamp: { type: Date, default: Date.now },
    area_sqm: { type: Number, required: true }, // Area in square meters calculated via Shoelace
    perimeter_m: { type: Number, required: true }, // Perimeter in meters
    strength_count: { type: Number, default: 1 }, // Multiplier for defense
    strength: { type: Number, required: true }, // area_sqm * strength_count
    path_nodes: { type: [[Number]], required: true }, // Raw point array [lng, lat] for easy client rendering
    boundary: {
        type: {
            type: String,
            enum: ['Polygon'],
            required: true
        },
        coordinates: {
            type: [[[Number]]], // GeoJSON Polygon spec: [[[lng, lat], [lng, lat], ...]]
            required: true
        }
    }
});

// Index for Geospatial bounds/intersection queries (finding territories to attack)
territorySchema.index({ boundary: '2dsphere' });
// Compound index for fast user lookups
territorySchema.index({ owner: 1, timestamp: -1 });

export default mongoose.model('Territory', territorySchema);
