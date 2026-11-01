import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MASKED_DIR = 'D:\\01_Kedinasan_BPS\\Bukti_Dukung_CKP_Oktober_2026_Masked';
const RAW_DIR = 'D:\\01_Kedinasan_BPS\\Bukti_Dukung_CKP_Oktober_2026';

// Helper: Get or create Google Drive folder
async function getOrCreateDriveFolder(accessToken, folderName, parentId = null) {
  const safeName = (folderName || 'Folder').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let queryStr = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`;
  if (parentId) {
    queryStr += ` and '${parentId}' in parents`;
  } else {
    queryStr += ` and 'root' in parents`;
  }

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(queryStr)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder
  const meta = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId) meta.parents = [parentId];

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(meta)
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(`Gagal membuat folder "${folderName}": ${err.error?.message || createRes.statusText}`);
  }

  const created = await createRes.json();
  return created.id;
}

// Helper: Make file or folder public
async function makePublic(accessToken, fileOrFolderId) {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileOrFolderId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch (err) {
    console.warn('Set permission non-blocking warning:', err);
  }
}

// MIME type detector
function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.csv': return 'text/csv';
    case '.json': return 'application/json';
    case '.py': return 'text/x-python';
    case '.md': return 'text/markdown';
    case '.bat': return 'text/plain';
    case '.zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { accessToken, filename, targetFolder } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Google OAuth Access Token diperlukan' }, { status: 401 });
    }
    if (!filename) {
      return NextResponse.json({ error: 'Nama file diperlukan' }, { status: 400 });
    }

    // Determine file location: prefer Masked folder first
    let filePath = path.join(MASKED_DIR, filename);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(RAW_DIR, filename);
    }
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `File bukti fisik "${filename}" tidak ditemukan di disk lokal` }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeType(filename);
    const fileSize = fileBuffer.length;

    // 1. Get or create folder hierarchy
    const rootFolderId = await getOrCreateDriveFolder(accessToken, 'SuperBrain BPS');
    const ckpFolderId = await getOrCreateDriveFolder(accessToken, 'Bukti Dukung CKP', rootFolderId);
    
    let targetFolderId = ckpFolderId;
    if (targetFolder) {
      targetFolderId = await getOrCreateDriveFolder(accessToken, targetFolder, ckpFolderId);
      await makePublic(accessToken, targetFolderId);
    }

    // 2. Check if file already exists in target folder
    const safeFilename = filename.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const checkQuery = `name='${safeFilename}' and '${targetFolderId}' in parents and trashed=false`;
    const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(checkQuery)}&fields=files(id,webViewLink)`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (existing.files && existing.files.length > 0) {
        const existingFile = existing.files[0];
        const folderUrl = `https://drive.google.com/drive/folders/${targetFolderId}`;
        return NextResponse.json({
          success: true,
          status: 'already_exists',
          fileId: existingFile.id,
          fileUrl: existingFile.webViewLink,
          folderId: targetFolderId,
          folderUrl: folderUrl,
          filename,
          size: fileSize
        });
      }
    }

    // 3. Upload file via Google Drive Multipart REST API
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: filename,
      mimeType: mimeType,
      parents: [targetFolderId]
    };

    const metadataPart = Buffer.from(
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n`
    );

    const closePart = Buffer.from(closeDelimiter);
    const multipartBody = Buffer.concat([metadataPart, fileBuffer, closePart]);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(multipartBody.length)
      },
      body: multipartBody
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(`Google Drive API Upload Error (${uploadRes.status}): ${err.error?.message || uploadRes.statusText}`);
    }

    const uploadedData = await uploadRes.json();
    const fileId = uploadedData.id;
    const fileUrl = uploadedData.webViewLink;
    const folderUrl = `https://drive.google.com/drive/folders/${targetFolderId}`;

    // 4. Set public access
    await makePublic(accessToken, fileId);

    return NextResponse.json({
      success: true,
      status: 'uploaded',
      fileId,
      fileUrl,
      folderId: targetFolderId,
      folderUrl,
      filename,
      size: fileSize
    });
  } catch (error) {
    console.error('Error in /api/drive/upload-evidence:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
