/**
 * Uploads a file to Google Drive using the REST API.
 * 
 * @param {File} file - The file to upload
 * @param {string} accessToken - Google OAuth access token with Drive scope
 * @param {string} [folderId] - Optional folder ID to upload into
 * @param {string} [customFileName] - Optional custom file name
 * @returns {Promise<string>} - The webViewLink of the uploaded file
 */
export async function uploadFileToDrive(file, accessToken, folderId = null, customFileName = null) {
  if (!file || !accessToken) {
    throw new Error('File and access token are required');
  }

  const metadata = {
    name: customFileName || file.name,
    mimeType: file.type || 'application/octet-stream',
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

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

    // 2. Make the file readable by anyone with the link
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

/**
 * Searches for a folder by name or creates it if it doesn't exist.
 */
export async function getOrCreateFolder(accessToken, folderName) {
  try {
    // 1. Search for the folder
    const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!searchRes.ok) {
      throw new Error('Failed to search for folder');
    }
    
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // 2. If not found, create it
    const metadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!createRes.ok) {
      throw new Error('Failed to create folder');
    }

    const createData = await createRes.json();
    return createData.id;
  } catch (error) {
    console.error('Error getting/creating folder:', error);
    throw error;
  }
}
