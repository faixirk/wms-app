import request from './request';
import ENDPOINTS from '../../constants/endpoints';

export interface UploadedFileResponse {
    success: boolean;
    url?: string;
    publicUrl?: string;
    filename?: string;
}

/**
 * Reusable utility to upload any file directly to S3 via Presigned URL
 * Step 1: Request Presigned URL from backend
 * Step 2: PUT raw file/blob directly to AWS S3
 */
export const uploadFile = async (
    fileUri: string,
    fileName: string,
    fileType: string
): Promise<UploadedFileResponse> => {
    try {
        console.log(`[Upload] Starting S3 upload for: ${fileName}`);

        // Step 1: Get presigned URL
        const presignedRes = await request({
            url: ENDPOINTS.PRESIGNED_URL,
            method: 'POST',
            data: {
                filename: fileName,
                fileType: fileType || 'application/octet-stream',
            },
        });

        // Adapting to standard axios structure where status is 2xx and data holds body
        const responseData = presignedRes?.data as any;
        console.log('[Upload] Raw presigned API response data:', JSON.stringify(responseData));
        const presignedData = responseData?.data?.url ? responseData.data : responseData;

        if (!presignedData || !presignedData.url) {
            throw new Error('Failed to retrieve presigned URL from backend');
        }

        const { url: uploadUrl, publicUrl, filename: s3Key } = presignedData;
        console.log(`[Upload] Retrieved Presigned URL successfully`, publicUrl);

        // React Native specific flow to get binary data from local URI
        // Using standard fetch for PUTting to S3 to bypass interceptor auth headers

        let fileBody: any;

        // Convert URI to Blob for fetch API
        const response = await fetch(fileUri);
        fileBody = await response.blob();

        // Step 2: Upload directly to S3 URL
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': fileType, // MUST exactly match what was sent in step 1
            },
            body: fileBody,
        });

        if (uploadRes.ok) {
            console.log(`[Upload] ✅ Successfully uploaded to S3:`, publicUrl);
            return {
                success: true,
                publicUrl: publicUrl,
                filename: s3Key,
            };
        } else {
            throw new Error(`S3 Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
        }
    } catch (error) {
        console.error('[Upload API] Error uploading file:', error);
        return { success: false };
    }
};
