import { NextResponse } from 'next/server';
import { createAgentInteraction } from '@/lib/googleAgents';

export async function POST(request) {
  try {
    const body = await request.json();
    const { input, agentId, previousInteractionId, model } = body;

    if (!input) {
      return NextResponse.json(
        { error: 'Input teks atau prompt diperlukan.' },
        { status: 400 }
      );
    }

    const result = await createAgentInteraction({
      agent: agentId || 'superbrain-bps-agent',
      model: model || 'gemini-2.5-flash',
      input: input,
      previousInteractionId: previousInteractionId || undefined,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('API Agents Interact error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
