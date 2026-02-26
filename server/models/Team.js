import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    color: { type: String, default: '#FFB800' },
    strength: { type: Number, default: 0 },
    territories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Territory' }],
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Team', teamSchema);
