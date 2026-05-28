/**
 * Uploads a file to Google Drive using the REST API.
 * 
 * @param {File} file - The file to upload
 * @param {string} accessToken - Google OAuth access token with Drive scope
 * @returns {Promise<string>} - The webViewLink of the uploaded file
 */
export async function uploadFileToDrive(file, accessToken) {
  if (!file || !accessToken) {
    throw new Error('File and access token are required');
  }

  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  try {
    // 1. Upload the file
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || 'Failed to upload to Google Drive');
    }

    const data = await res.json();
    const fileId = data.id;
    let webViewLink = data.webViewLink;

    // 2. Make the file readable by anyone with the link (so you can view it from the app without re-authenticating if you share it, 
    // but since this is a private app, maybe we just keep it private. However, standard practice for "Bukti Dukung" 
    // is often to make it readable so the user doesn't get access denied when clicking from different accounts).
    // Let's set permissions to "anyone with link can view".
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });

    return webViewLink;
  } catch (error) {
    console.error('Google Drive Upload Error:', error);
    throw error;
  }
}
