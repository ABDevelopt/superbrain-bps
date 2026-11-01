/**
 * Google AI Studio / Gemini Managed Agents & Interactions API Client
 * Official Endpoint Reference: https://aistudio.google.com/api-reference/agents/create-agent
 * Base Agent: antigravity-preview-09-2026 / gemini-2.5-flash
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Creates a new Managed Agent in Google AI Studio / Gemini API
 * @param {Object} config - Agent configuration
 * @param {string} [config.id] - Unique Agent ID (e.g. 'superbrain-bps-agent')
 * @param {string} [config.description] - Agent description
 * @param {string} [config.systemInstruction] - System prompt instructions
 * @param {string} [config.model] - Model name (default: 'gemini-2.5-flash' / 'gemini-2.0-flash')
 * @param {string} [config.baseAgent] - Base agent harness ('antigravity-preview-09-2026')
 * @param {Array} [config.tools] - Tool definitions
 * @returns {Promise<Object>} Created agent details
 */
export async function createManagedAgent(config = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di server.');
  }

  const agentId = config.id || 'superbrain-bps-agent';
  const model = config.model || 'gemini-2.5-flash';
  const baseAgent = config.baseAgent || 'antigravity-preview-09-2026';

  const payload = {
    id: agentId,
    base_agent: baseAgent,
    description: config.description || 'SuperBrain BPS Productivity & Performance AI Agent',
    agent_config: {
      type: 'antigravity',
      model: model,
    },
    system_instruction: config.systemInstruction || 'Anda adalah SuperBrain AI Agent resmi untuk aparatur Badan Pusat Statistik (BPS).'
  };

  if (config.tools && Array.isArray(config.tools)) {
    payload.tools = config.tools;
  }

  const response = await fetch(`${BASE_URL}/agents?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[GoogleAgents] CreateAgent failed with HTTP ${response.status}:`, errorBody);
    throw new Error(`Google Agents API Create Error (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

/**
 * Retrieves details of a specific Managed Agent
 * @param {string} agentId
 * @returns {Promise<Object>}
 */
export async function getManagedAgent(agentId = 'superbrain-bps-agent') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY belum dikonfigurasi.');

  const response = await fetch(`${BASE_URL}/agents/${agentId}?key=${apiKey}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Agents API Get Error (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

/**
 * Lists all registered Managed Agents
 * @returns {Promise<Array>}
 */
export async function listManagedAgents() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY belum dikonfigurasi.');

  const response = await fetch(`${BASE_URL}/agents?key=${apiKey}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Agents API List Error (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

/**
 * Deletes a Managed Agent
 * @param {string} agentId
 * @returns {Promise<Object>}
 */
export async function deleteManagedAgent(agentId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY belum dikonfigurasi.');

  const response = await fetch(`${BASE_URL}/agents/${agentId}?key=${apiKey}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Agents API Delete Error (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

/**
 * Creates an interaction with an Agent or Model using the Gemini Interactions API
 * Includes automatic resilient fallback to generateContent if Interactions API is not yet provisioned.
 * 
 * @param {Object} params
 * @param {string} [params.agent] - Agent ID (e.g. 'superbrain-bps-agent')
 * @param {string} [params.model] - Model name fallback
 * @param {string|Array} params.input - User input text or multimodal parts
 * @param {string} [params.previousInteractionId] - Conversation tracking ID
 * @param {boolean} [params.background] - Whether to run asynchronously in background
 * @returns {Promise<Object>}
 */
export async function createAgentInteraction(params = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY belum dikonfigurasi.');

  const interactionPayload = {
    input: params.input,
  };

  if (params.agent) {
    interactionPayload.agent = params.agent;
  } else {
    interactionPayload.model = params.model || 'gemini-2.5-flash';
  }

  if (params.previousInteractionId) {
    interactionPayload.previous_interaction_id = params.previousInteractionId;
  }

  if (params.background) {
    interactionPayload.background = true;
  }

  // Attempt Interactions API endpoint
  try {
    const response = await fetch(`${BASE_URL}/interactions?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(interactionPayload),
    });

    if (response.ok) {
      return await response.json();
    }

    const errText = await response.text();
    console.warn(`[GoogleAgents] Interactions API call returned ${response.status}:`, errText);
  } catch (apiErr) {
    console.warn('[GoogleAgents] Interactions API request failed, falling back to generateContent:', apiErr.message);
  }

  // Resilient fallback: standard model generateContent
  const fallbackModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash'
  ];

  for (const m of fallbackModels) {
    try {
      const fallbackUrl = `${BASE_URL}/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: typeof params.input === 'string' ? params.input : JSON.stringify(params.input) }] }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          id: `gen_${Date.now()}`,
          output_text: text,
          outputs: [{ text }],
          fallback_model: m
        };
      }
    } catch (_) {}
  }

  throw new Error('Gagal mengeksekusi interaksi dengan Google AI Agents API.');
}
