import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  task: { type: String, required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  duration: { type: Number, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  userId: { type: String, required: true, default: 'badar' }
}, { timestamps: true });

export default mongoose.models.Session || mongoose.model('Session', SessionSchema);
