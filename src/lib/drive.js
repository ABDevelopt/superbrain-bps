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
      throw new Error(`Google Drive API Error (${res.status}): ${errorData.error?.message || 'Failed to upload to Google Drive'}`);
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
 * If parentId is provided, searches or creates inside the parent folder.
 * 
 * @param {string} accessToken - Google OAuth access token
 * @param {string} folderName - Name of the folder to get or create
 * @param {string} [parentId] - Optional parent folder ID
 * @returns {Promise<string>} - The ID of the found or created folder
 */
export async function getOrCreateFolder(accessToken, folderName, parentId = null) {
  try {
    // 1. Search for the folder
    let queryStr = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
    if (parentId) {
      queryStr += ` and '${parentId}' in parents`;
    } else {
      queryStr += ` and 'root' in parents`;
    }
    const query = encodeURIComponent(queryStr);
    
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!searchRes.ok) {
      let errMsg = `Failed to search for folder (Status ${searchRes.status})`;
      try {
        const errData = await searchRes.json();
        if (errData.error?.message) {
          errMsg += `: ${errData.error.message}`;
        }
      } catch (e) {}
      throw new Error(errMsg);
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
    if (parentId) {
      metadata.parents = [parentId];
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    if (!createRes.ok) {
      let errMsg = `Failed to create folder (Status ${createRes.status})`;
      try {
        const errData = await createRes.json();
        if (errData.error?.message) {
          errMsg += `: ${errData.error.message}`;
        }
      } catch (e) {}
      throw new Error(errMsg);
    }

    const createData = await createRes.json();
    return createData.id;
  } catch (error) {
    console.error('Error getting/creating folder:', error);
    throw error;
  }
}
