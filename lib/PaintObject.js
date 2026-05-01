import mongoose from 'mongoose';

const PaintObjectSchema = new mongoose.Schema({
  userEmail: String,
  userName: String,
  floor: {
    type: Number,
    default: 1
  },
  pixels: [
    {
      x: Number,
      y: Number,
      color: String
    }
  ],

  // Paint 버튼을 누른 시간
  paintStartedAt: {
    type: Date
  },

  // Paint 완료 버튼을 눌러 서버에 저장된 시간
  postedAt: {
    type: Date
  },

  // 그린 시간 차이, 밀리초
  durationMs: {
    type: Number
  },

  // 그린 시간 차이, 초
  durationSeconds: {
    type: Number
  }

}, {
  timestamps: true
});

export default mongoose.models.PaintObject || mongoose.model('PaintObject', PaintObjectSchema);