import mongoose from "mongoose";

const CanvasNoteSchema = new mongoose.Schema(
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

    title: {
      type: String,
      default: "",
      maxlength: 80,
    },

    body: {
      type: String,
      default: "",
      maxlength: 1000,
    },

    icon: {
      type: String,
      default: "📌",
    },

    createdByEmail: {
      type: String,
      required: true,
    },

    createdByName: {
      type: String,
      default: "",
    },

    lastEditedByEmail: {
      type: String,
      default: "",
    },

    lastEditedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

CanvasNoteSchema.index({ floor: 1, x: 1, y: 1 });

export default mongoose.models.CanvasNote ||
  mongoose.model("CanvasNote", CanvasNoteSchema);