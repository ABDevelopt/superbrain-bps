import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';

export async function GET(request, { params }) {
  const { slug } = params;

  if (!slug) {
    return new NextResponse('Slug tidak valid', { status: 400 });
  }

  try {
    const q = query(collection(db, 'short_links'), where('slug', '==', slug));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // Return a beautiful glassmorphic HTML error page
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Link Tidak Ditemukan - SuperBrain BPS</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
              body {
                background: radial-gradient(circle at center, #1e1b4b 0%, #0f0728 100%);
                color: #f1f5f9;
                font-family: 'Inter', sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                padding: 20px;
                box-sizing: border-box;
                text-align: center;
              }
              .card {
                background: rgba(255, 255, 255, 0.02);
                backdrop-filter: blur(16px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                padding: 40px;
                max-width: 480px;
                width: 100%;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
                animation: slideUp 0.6s ease-out;
              }
              @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .icon {
                font-size: 48px;
                margin-bottom: 20px;
                display: inline-block;
                animation: pulse 2s infinite;
              }
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
              }
              h1 {
                font-size: 24px;
                margin: 0 0 10px 0;
                color: #f43f5e;
                font-weight: 700;
              }
              p {
                color: #94a3b8;
                font-size: 15px;
                line-height: 1.6;
                margin: 0 0 30px 0;
              }
              .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                color: white;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
              }
              .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">🔍</div>
              <h1>Tautan Tidak Ditemukan</h1>
              <p>Maaf, tautan singkat <strong>/s/${slug}</strong> tidak terdaftar di sistem atau sudah dihapus.</p>
              <a href="/" class="btn">Kembali ke Beranda</a>
            </div>
          </body>
        </html>`,
        {
          headers: { 'Content-Type': 'text/html' },
          status: 404
        }
      );
    }

    const docSnap = querySnapshot.docs[0];
    const linkData = docSnap.data();
    const longUrl = linkData.longUrl;

    // Increment click count asynchronously in Firestore
    try {
      await updateDoc(doc(db, 'short_links', docSnap.id), {
        clicks: increment(1)
      });
    } catch (err) {
      console.error('Error incrementing short link clicks:', err);
    }

    // Temporary Redirect (307) so browser requests it every time
    return NextResponse.redirect(longUrl, 307);

  } catch (error) {
    console.error('Redirection Route Error:', error);
    return new NextResponse('Internal Server Error: ' + error.message, { status: 500 });
  }
}
