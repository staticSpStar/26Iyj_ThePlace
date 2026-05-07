import mongoose from "mongoose";

const PixelStateSchema = new mongoose.Schema(
  {
    floor: {
      type: Number,
      required: true,
      index: true,
    },

    x: {
      type: Number,
      required: true,
    },

    y: {
      type: Number,
      required: true,
    },

    color: {
      type: String,
      required: true,
    },

    editCount: {
      type: Number,
      default: 0,
    },

    lastObjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaintObject",
      index: true,
    },

    lastEditedBy: {
      type: String,
    },

    lastEditedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

PixelStateSchema.index(
  { floor: 1, x: 1, y: 1 },
  { unique: true }
);

export default mongoose.models.PixelState ||
  mongoose.model("PixelState", PixelStateSchema);