import { NextResponse } from 'next/server';
import { createManagedAgent, listManagedAgents, getManagedAgent } from '@/lib/googleAgents';
import { skpData } from '@/data/skpData';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('id');

    if (agentId) {
      const agent = await getManagedAgent(agentId);
      return NextResponse.json({ success: true, agent });
    }

    const agents = await listManagedAgents();
    return NextResponse.json({ success: true, agents });
  } catch (error) {
    console.warn('API Agents GET error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const skpSummary = skpData.map(s => `ID ${s.id}: ${s.nama} (${s.kategori})`).join('\n');

    const defaultInstruction = `
Anda adalah SuperBrain BPS AI Agent resmi untuk aparatur Badan Pusat Statistik (BPS) Republik Indonesia.
Tugas Anda adalah membantu perencanaan, eksekusi tugas, pencatatan agenda rapat, dinas lapangan, dan pelaporan Capaian Kinerja Pegawai (CKP) sesuai PermenPAN-RB No. 6 Tahun 2022.

Matriks 29 Butir SKP BPS:
${skpSummary}

Aturan Mutlak:
1. Menjaga kerahasiaan data mikro sensus/survei (Zero-Cloud-Egress & UU No. 16 Tahun 1997).
2. Mematuhi batas beban kerja harian maksimal 7,5 jam (450 menit) tanpa tumpang tindih waktu.
3. Selalu memetakan rincian kegiatan ke ID SKP BPS yang paling relevan (1-29).
`;

    const config = {
      id: body.id || 'superbrain-bps-agent',
      description: body.description || 'SuperBrain BPS Productivity & Performance AI Agent powered by Antigravity',
      systemInstruction: body.systemInstruction || defaultInstruction,
      model: body.model || 'gemini-2.5-flash',
      baseAgent: body.baseAgent || 'antigravity-preview-09-2026',
      tools: body.tools || undefined
    };

    const result = await createManagedAgent(config);

    return NextResponse.json({
      success: true,
      message: `Google Managed Agent '${config.id}' berhasil dibuat/didaftarkan.`,
      agent: result
    });
  } catch (error) {
    console.error('API Agents POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
