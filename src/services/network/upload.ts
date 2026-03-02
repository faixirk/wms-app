import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import request from './request';
import ENDPOINTS from '../../constants/endpoints';

export interface UploadedFileResponse {
    success: boolean;
    url?: string;
    publicUrl?: string;
    filename?: string;
}

/** On Android, content:// URIs must be read via native modules; standard fetch() fails. */
const useBlobUtilUpload = (fileUri: string): boolean =>
    Platform.OS === 'android' || fileUri.startsWith('content://');

/**
 * Reusable utility to upload any file directly to S3 via Presigned URL
 * Step 1: Request Presigned URL from backend
 * Step 2: PUT raw file/blob directly to AWS S3
 * On Android (and for content:// URIs), uses react-native-blob-util to avoid "Network request failed".
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

        const mimeType = fileType || 'application/octet-stream';

        if (useBlobUtilUpload(fileUri)) {
            // Android / content://: standard fetch(fileUri) fails; use native blob util.
            const res = await ReactNativeBlobUtil.fetch('PUT', uploadUrl, {
                'Content-Type': mimeType,
            }, ReactNativeBlobUtil.wrap(fileUri));
            const status = (res as any).respInfo?.status ?? (res as any).info?.()?.status ?? 0;
            if (status >= 200 && status < 300) {
                console.log(`[Upload] ✅ Successfully uploaded to S3:`, publicUrl);
                return { success: true, publicUrl, filename: s3Key };
            }
            throw new Error(`S3 Upload failed: ${status} ${(res as any).respInfo?.statusText ?? ''}`);
        }

        // iOS / file://: use standard fetch (reads local file and PUTs to S3).
        const response = await fetch(fileUri);
        const fileBody = await response.blob();
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': mimeType },
            body: fileBody,
        });

        if (uploadRes.ok) {
            console.log(`[Upload] ✅ Successfully uploaded to S3:`, publicUrl);
            return {
                success: true,
                publicUrl: publicUrl,
                filename: s3Key,
            };
        }
        throw new Error(`S3 Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
    } catch (error) {
        console.error('[Upload API] Error uploading file:', error);
        return { success: false };
    }
};
