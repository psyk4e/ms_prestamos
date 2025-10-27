import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { CustomLogger } from './CustomLogger';

export class AzureBlobStorageService {
    private containerClient?: ContainerClient;
    private logger: CustomLogger;

    constructor() {
        this.logger = new CustomLogger({
            serviceName: 'AzureBlobStorageService'
        });

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
        const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

        if (!containerName) {
            this.logger.error('Azure Storage configuration is missing: AZURE_STORAGE_CONTAINER_NAME');
            return;
        }

        try {
            if (connectionString) {
                const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
                this.containerClient = blobServiceClient.getContainerClient(containerName);
                return;
            }
        } catch (error) {
            this.logger.error('Failed to initialize Azure Blob Storage client via connection string', error instanceof Error ? error : new Error(String(error)));
            // fall through to attempt shared key credential
        }

        try {
            if (accountName && accountKey) {
                const credential = new StorageSharedKeyCredential(accountName, accountKey);
                const serviceUrl = `https://${accountName}.blob.core.windows.net`;
                const blobServiceClient = new BlobServiceClient(serviceUrl, credential);
                this.containerClient = blobServiceClient.getContainerClient(containerName);
                return;
            }
        } catch (error) {
            this.logger.error('Failed to initialize Azure Blob Storage client via shared key', error instanceof Error ? error : new Error(String(error)));
        }

        // If we reach here, initialization failed; do not throw to avoid crashing app at boot.
        this.logger.error('Azure Blob Storage client not initialized due to invalid or missing configuration');
    }

    /**
     * Retrieves an image from Azure Blob Storage securely
     * @param blobPath - The path to the blob (without sensitive information)
     * @returns Buffer containing the image data
     */
    async getBlob(blobPath: string): Promise<Buffer> {
        try {
            // Validate and sanitize the blob path
            const sanitizedPath = this.sanitizeBlobPath(blobPath);

            if (!this.containerClient) {
                throw new Error('Azure Blob Storage client not initialized');
            }

            this.logger.info(`Attempting to retrieve image: ${sanitizedPath}`);

            // Get blob client
            const blobClient = this.containerClient.getBlobClient(sanitizedPath);

            // Check if blob exists
            const exists = await blobClient.exists();
            if (!exists) {
                throw new Error('Image not found');
            }

            // Download the blob
            const downloadResponse = await blobClient.download();

            if (!downloadResponse.readableStreamBody) {
                throw new Error('Failed to download image stream');
            }

            // Convert stream to buffer
            const chunks: Buffer[] = [];
            for await (const chunk of downloadResponse.readableStreamBody) {
                chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
            }

            const imageBuffer = Buffer.concat(chunks);

            this.logger.info(`Successfully retrieved image: ${sanitizedPath}, size: ${imageBuffer.length} bytes`);

            return imageBuffer;

        } catch (error) {
            this.logger.error(`Failed to retrieve image: ${blobPath}`, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }

    /**
     * Gets image metadata without downloading the full content
     * @param blobPath - The path to the blob
     * @returns Object containing image metadata
     */
    async getBlobMetadata(blobPath: string): Promise<{
        contentType?: string;
        contentLength?: number;
        lastModified?: Date;
        exists: boolean;
    }> {
        if (!this.containerClient) {
            this.logger.warn('Azure Blob Storage not initialized, cannot get blob metadata');
            return { exists: false };
        }

        try {
            const sanitizedPath = this.sanitizeBlobPath(blobPath);
            const blobClient = this.containerClient.getBlobClient(sanitizedPath);

            const exists = await blobClient.exists();
            if (!exists) {
                return { exists: false };
            }

            const properties = await blobClient.getProperties();

            return {
                contentType: this.normalizeContentType(properties.contentType),
                contentLength: properties.contentLength,
                lastModified: properties.lastModified,
                exists: true
            };

        } catch (error) {
            this.logger.error(`Failed to get image metadata: ${blobPath}`, error instanceof Error ? error : new Error(String(error)));
            return { exists: false };
        }
    }

    /**
     * Sanitizes and validates the blob path to prevent path traversal attacks
     * @param blobPath - The input blob path
     * @returns Sanitized blob path
     */
    private sanitizeBlobPath(blobPath: string): string {
        if (!blobPath || typeof blobPath !== 'string') {
            throw new Error('Invalid blob path');
        }

        // Remove any potential path traversal attempts
        const sanitized = blobPath
            .replace(/\.\./g, '') // Remove ..
            .replace(/\/+/g, '/') // Replace multiple slashes with single slash
            .replace(/^\//, '') // Remove leading slash
            .trim();

        // Validate that the path only contains allowed characters
        const allowedPattern = /^[a-zA-Z0-9\-_\/\.]+$/;
        if (!allowedPattern.test(sanitized)) {
            throw new Error('Invalid characters in blob path');
        }

        // Ensure the path is not empty after sanitization
        if (!sanitized) {
            throw new Error('Empty blob path after sanitization');
        }

        return sanitized;
    }

    /**
     * Validates if the blob path corresponds to an image file
     * @param blobPath - The blob path to validate
     * @returns boolean indicating if it's a valid image path
     */
    isValidImagePath(blobPath: string): boolean {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        const lowerPath = blobPath.toLowerCase();
        return imageExtensions.some(ext => lowerPath.endsWith(ext));
    }

    /**
     * Normalizes content types to standard MIME types
     * Fixes common issues like "image/jpg" -> "image/jpeg"
     */
    private normalizeContentType(contentType?: string): string | undefined {
        if (!contentType) {
            return contentType;
        }

        const normalized = contentType.toLowerCase().trim();

        // Common MIME type normalizations
        const mimeTypeMap: Record<string, string> = {
            'image/jpg': 'image/jpeg',
            'image/pjpeg': 'image/jpeg', // Progressive JPEG
            'image/x-png': 'image/png',
            'image/x-icon': 'image/x-icon',
            'application/x-pdf': 'application/pdf'
        };

        return mimeTypeMap[normalized] || contentType;
    }
}