import mongoose from 'mongoose';

const PaintObjectSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  userName: { type: String },
  floor: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  pixels: [{
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    color: { type: String, required: true }
  }]
});

export default mongoose.models.PaintObject || mongoose.model('PaintObject', PaintObjectSchema);
