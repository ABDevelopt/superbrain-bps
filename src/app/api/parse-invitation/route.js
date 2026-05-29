import { NextResponse } from 'next/server';
import { parseInvitation } from '@/lib/invitationParser';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'Berkas surat undangan diperlukan.' },
        { status: 400 }
      );
    }

    const mimeType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Call the shared parser
    const parsedData = await parseInvitation(fileBuffer, mimeType);

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error) {
    console.error('API Parse Invitation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan internal server saat menganalisis undangan.' },
      { status: 500 }
    );
  }
}
