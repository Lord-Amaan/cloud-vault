const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'File must belong to a user'],
    index: true
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },
  blobName: {
    type: String,
    required: [true, 'Azure Blob name is required'],
    unique: true,
    trim: true
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size in bytes is required']
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to quickly fetch user's files ordered by uploaded date
fileSchema.index({ owner: 1, uploadedAt: -1 });

module.exports = mongoose.model('File', fileSchema);
