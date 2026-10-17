// STAND-IN for MEDIA-1 (#38). The endpoint is a guess.
import { ApiError, apiRequest, USE_MOCK_API } from '@/api/client';
import { mockCreateUpload, mockPutObject } from '@/api/mocks';
import type { CreateUploadResponse, UploadPurpose } from '@/api/types';

export function createUpload(purpose: UploadPurpose): Promise<CreateUploadResponse> {
  if (USE_MOCK_API) return mockCreateUpload(purpose);
  return apiRequest('POST', '/api/uploads', { purpose, contentType: 'image/jpeg' });
}

// Upload a local JPEG to a presigned S3 URL
export async function putObject(uploadUrl: string, fileUri: string): Promise<void> {
  if (USE_MOCK_API) return mockPutObject(uploadUrl);

  const file = await (await fetch(fileUri)).blob();
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: file,
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Upload failed with ${response.status}`);
  }
}
