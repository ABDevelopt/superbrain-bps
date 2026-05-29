import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('id');

  if (!fileId) {
    return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
  }

  try {
    // 1. Get file path from Telegram
    const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`;
    const getFileRes = await fetch(getFileUrl);
    if (!getFileRes.ok) {
      throw new Error('Gagal mendapatkan lokasi berkas dari Telegram.');
    }
    
    const getFileData = await getFileRes.json();
    if (!getFileData.ok || !getFileData.result?.file_path) {
      throw new Error('Gagal memproses detail berkas dari Telegram.');
    }
    
    const filePath = getFileData.result.file_path;

    // 2. Download file content from Telegram
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const downloadRes = await fetch(downloadUrl);
    
    if (!downloadRes.ok) {
      throw new Error('Gagal mengunduh berkas dari server Telegram.');
    }

    // 3. Proxy the response back
    const headers = new Headers();
    // Forward the content type (e.g. application/pdf, image/jpeg)
    if (downloadRes.headers.get('content-type')) {
      headers.set('Content-Type', downloadRes.headers.get('content-type'));
    }
    
    // Suggest a filename based on the path
    const filename = filePath.split('/').pop() || 'file';
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);

    return new NextResponse(downloadRes.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Telegram file proxy error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
