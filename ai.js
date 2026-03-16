/**
 * NutriTrack – AI Integration (Anthropic API)
 * Handles food search queries and nutrition label image scanning.
 */

const AI = {
  // ── Food Search ───────────────────────────────────
  async searchFood(query) {
    const apiKey = Store.getApiKey();
    if (!apiKey) throw new Error('No API key set. Please add your Anthropic API key in Targets → AI Settings.');

    const prompt = `You are a nutrition expert. The user wants to log food: "${query}"

Return a JSON array of 1-3 food options. For each option provide:
- name: descriptive food name
- servingSize: numeric serving size (e.g., 100)
- servingUnit: unit string (e.g., "g", "oz", "cup", "piece")
- cal: calories (number)
- protein: grams of protein (number)
- carbs: grams of carbohydrates (number)
- fat: grams of fat (number)

Use standard nutritional databases. Be precise. Return ONLY valid JSON array, no markdown, no explanation.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';

    let parsed;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new Error('Could not parse AI response. Try again.');
    }

    if (!Array.isArray(parsed)) throw new Error('Unexpected AI response format.');
    return parsed;
  },

  // ── Nutrition Label Scan ──────────────────────────
  async scanLabel(imageBase64, mimeType = 'image/jpeg') {
    const apiKey = Store.getApiKey();
    if (!apiKey) throw new Error('No API key set. Please add your Anthropic API key in Targets → AI Settings.');

    const prompt = `Analyze this nutrition facts label image. Extract the nutritional information and return a single JSON object with these fields:
- name: product name (infer from context or use "Scanned Food" if unclear)
- servingSize: numeric serving size (e.g., 30)
- servingUnit: unit string (e.g., "g", "oz", "cup", "piece")
- cal: calories per serving (number)
- protein: grams of protein per serving (number)
- carbs: total carbohydrates per serving (number)
- fat: total fat per serving (number)

Return ONLY valid JSON, no markdown backticks, no explanation. Be accurate to the label.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${resp.status}`);
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || '';

    let parsed;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      throw new Error('Could not parse label data. Try a clearer image.');
    }

    return parsed;
  },
};

// ── Image to Base64 helper ────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Strip data:image/...;base64, prefix
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToBase64(canvas) {
  const dataURL = canvas.toDataURL('image/jpeg', 0.85);
  return {
    base64: dataURL.split(',')[1],
    mimeType: 'image/jpeg',
  };
}
