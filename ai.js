/**
 * NutriTrack – AI Integration (Anthropic API)
 * Calories are never requested from the AI — they are calculated from
 * macros using the Atwater system: protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g.
 */

function calcCalories(protein, carbs, fat) {
  return Math.round((parseFloat(protein) || 0) * 4 +
                    (parseFloat(carbs)   || 0) * 4 +
                    (parseFloat(fat)     || 0) * 9);
}

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
- protein: grams of protein (number)
- carbs: grams of total carbohydrates (number)
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
        model: 'claude-haiku-4-5-20251001',
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

    // Calculate calories from macros — never trust AI-provided calorie numbers
    return parsed.map(item => ({
      ...item,
      cal: calcCalories(item.protein, item.carbs, item.fat),
    }));
  },

  // ── Nutrition Label Scan ──────────────────────────
  async scanLabel(imageBase64, mimeType = 'image/jpeg') {
    const apiKey = Store.getApiKey();
    if (!apiKey) throw new Error('No API key set. Please add your Anthropic API key in Targets → AI Settings.');

    const prompt = `Analyze this nutrition facts label image. Extract the nutritional information and return a single JSON object with these fields:
- name: product name (infer from context or use "Scanned Food" if unclear)
- servingSize: numeric serving size (e.g., 30)
- servingUnit: unit string (e.g., "g", "oz", "cup", "piece")
- protein: grams of protein per serving (number)
- carbs: total carbohydrates per serving in grams (number)
- fat: total fat per serving in grams (number)

Do not include calories. Return ONLY valid JSON, no markdown backticks, no explanation. Be accurate to the label.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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

    // Calculate calories from macros
    parsed.cal = calcCalories(parsed.protein, parsed.carbs, parsed.fat);
    return parsed;
  },
};

// ── Image to Base64 helper ────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
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
