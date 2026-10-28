const express = require('express');
const File = require('../models/File');
const authenticateToken = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadBlob, generateSasUrl, deleteBlob } = require('../config/azureStorage');

const router = express.Router();

// Apply JWT authentication middleware to all file routes
router.use(authenticateToken);

/**
 * @route   POST /api/files/upload
 * @desc    Upload file buffer to Azure Blob Storage and save metadata in MongoDB
 *          File format: userId/timestamp-originalName
 * @access  Private (JWT protected)
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach a file under form-data key "file".'
      });
    }

    const { originalname, buffer, mimetype, size } = req.file;

    // Unique blob name pattern: userId/timestamp-originalName
    const timestamp = Date.now();
    // Sanitize spaces/special characters from filename for safe URI encoding
    const safeOriginalName = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobName = `${req.user.id}/${timestamp}-${safeOriginalName}`;

    // 1. Upload in-memory buffer to Azure Blob Storage private container
    await uploadBlob(blobName, buffer, mimetype);

    // 2. Persist metadata record in MongoDB Atlas
    const fileRecord = new File({
      owner: req.user.id,
      originalName: originalname,
      blobName,
      mimeType: mimetype,
      size,
      uploadedAt: new Date()
    });

    await fileRecord.save();

    // 3. Generate a 10-minute read-only SAS URL for immediate verification/preview
    let initialSasUrl = null;
    try {
      const sasData = await generateSasUrl(blobName, 10);
      initialSasUrl = sasData.sasUrl;
    } catch (sasErr) {
      console.warn('[SAS Warning]: Failed to generate initial SAS preview:', sasErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully to Azure Blob Storage and registered in MongoDB.',
      file: {
        _id: fileRecord._id,
        id: fileRecord._id,
        owner: fileRecord.owner,
        originalName: fileRecord.originalName,
        blobName: fileRecord.blobName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        uploadedAt: fileRecord.uploadedAt
      },
      sasUrl: initialSasUrl
    });
  } catch (error) {
    console.error('[File Upload Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error occurred while uploading file.'
    });
  }
});

/**
 * @route   GET /api/files
 * @desc    List ONLY the logged-in user's files
 * @access  Private (JWT protected)
 */
router.get('/', async (req, res) => {
  try {
    // Multi-tenant filter: Only retrieve documents where owner matches logged-in user ID
    const files = await File.find({ owner: req.user.id })
      .select('originalName blobName mimeType size uploadedAt _id')
      .sort({ uploadedAt: -1 });

    return res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (error) {
    console.error('[File List Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error occurred while fetching files.'
    });
  }
});

/**
 * @route   GET /api/files/:id/download
 * @route   GET /api/files/:id/sas (alias)
 * @desc    Check ownership, then return a short-lived (10-minute), read-only SAS URL for that single blob
 * @access  Private (JWT protected)
 */
const handleFileDownload = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found.'
      });
    }

    // Strict Tenant Isolation: Ensure the file belongs to the requesting user
    if (file.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You do not own this file."
      });
    }

    // Optional query param: download=true forces file download attachment header
    const isDownload = req.query.download === 'true';
    const downloadFilename = isDownload ? file.originalName : null;

    // Generate short-lived (10 minute), read-only SAS URL
    const sasInfo = await generateSasUrl(file.blobName, 10, downloadFilename);

    return res.status(200).json({
      success: true,
      fileId: file._id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      sasUrl: sasInfo.sasUrl,
      expiresInMinutes: 10,
      expiresOn: sasInfo.expiresOn
    });
  } catch (error) {
    console.error('[SAS Generation Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error generating SAS download URL.'
    });
  }
};

router.get('/:id/download', handleFileDownload);
router.get('/:id/sas', handleFileDownload); // Backwards-compatible alias for frontend UI

/**
 * @route   DELETE /api/files/:id
 * @desc    Check ownership, delete the blob from Azure Blob Storage and the DB record
 * @access  Private (JWT protected)
 */
router.delete('/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found.'
      });
    }

    // Strict Tenant Isolation: User B cannot delete User A's file
    if (file.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Access forbidden. You cannot delete files you do not own."
      });
    }

    // 1. Delete the blob from Azure Blob Storage
    try {
      await deleteBlob(file.blobName);
    } catch (azureErr) {
      console.warn(`[Azure Delete Warning]: Could not delete blob "${file.blobName}":`, azureErr.message);
      // Proceed to remove from MongoDB even if blob was missing
    }

    // 2. Delete metadata document from MongoDB Atlas
    await File.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully from Azure Blob Storage and database.'
    });
  } catch (error) {
    console.error('[File Delete Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error occurred while deleting file.'
    });
  }
});

module.exports = router;
