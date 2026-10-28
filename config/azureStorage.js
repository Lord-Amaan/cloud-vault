const { BlobServiceClient, BlobSASPermissions } = require('@azure/storage-blob');

const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'vault-files';

/**
 * Creates and returns the BlobServiceClient from AZURE_STORAGE_CONNECTION_STRING in .env
 */
const getBlobServiceClient = () => {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set in environment variables.');
  }
  return BlobServiceClient.fromConnectionString(connectionString);
};

/**
 * Returns the ContainerClient for the target private container
 */
const getContainerClient = () => {
  const blobServiceClient = getBlobServiceClient();
  return blobServiceClient.getContainerClient(CONTAINER_NAME);
};

/**
 * Ensures the container exists with strictly PRIVATE access (no anonymous read)
 */
const ensureContainerExists = async () => {
  try {
    const containerClient = getContainerClient();
    // access: undefined ensures private container (no anonymous public read)
    const createResponse = await containerClient.createIfNotExists({
      access: undefined
    });

    if (createResponse.succeeded) {
      console.log(`[Azure Storage] Private container "${CONTAINER_NAME}" created successfully.`);
    } else {
      console.log(`[Azure Storage] Private container "${CONTAINER_NAME}" verified ready.`);
    }
  } catch (err) {
    console.error(`[Azure Storage] Container init error: ${err.message}`);
  }
};

/**
 * Upload an in-memory buffer directly to Azure Blob Storage
 * @param {string} blobName - Target blob path (userId/timestamp-originalName)
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} mimeType - Content MIME type
 */
const uploadBlob = async (blobName, buffer, mimeType) => {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType || 'application/octet-stream'
    }
  });

  return {
    blobName,
    url: blockBlobClient.url
  };
};

/**
 * Generates a short-lived, read-only Shared Access Signature (SAS) URL for a single blob.
 * Default lifespan: 10 minutes (as requested for secure direct client downloads).
 *
 * @param {string} blobName - Unique path of the blob
 * @param {number} expiryMinutes - Token validity (default 10)
 * @param {string} [downloadFilename] - Optional filename for attachment disposition
 */
const generateSasUrl = async (blobName, expiryMinutes = 10, downloadFilename = null) => {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const sasOptions = {
    permissions: BlobSASPermissions.parse('r'), // Read-only access
    expiresOn
  };

  if (downloadFilename) {
    sasOptions.contentDisposition = `attachment; filename="${encodeURIComponent(downloadFilename)}"`;
  }

  const sasUrl = await blockBlobClient.generateSasUrl(sasOptions);

  return {
    sasUrl,
    expiresOn,
    expiresInMinutes: expiryMinutes
  };
};

/**
 * Delete a blob from the private Azure container
 * @param {string} blobName - The blob path to remove
 */
const deleteBlob = async (blobName) => {
  const containerClient = getContainerClient();
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
};

/**
 * Storage Health Check probe
 */
const checkStorageHealth = async () => {
  try {
    const containerClient = getContainerClient();
    const exists = await containerClient.exists();
    return { status: exists ? 'UP' : 'CONTAINER_NOT_FOUND', container: CONTAINER_NAME };
  } catch (err) {
    return { status: 'DOWN', error: err.message };
  }
};

module.exports = {
  getBlobServiceClient,
  getContainerClient,
  ensureContainerExists,
  uploadBlob,
  generateSasUrl,
  deleteBlob,
  checkStorageHealth,
  CONTAINER_NAME
};
