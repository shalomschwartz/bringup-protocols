const CLAUDE_API_KEY = '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';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, participants, meetingDate } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });

    const today = new Date().toISOString().split('T')[0];
    const dayName = new Date().toLocaleDateString('he-IL', { weekday: 'long' });
    const refDate = meetingDate || today;

    const prompt = `You are a task parser for a Hebrew construction project management app.
Given this spoken Hebrew text from a meeting, extract the task details.

Today is ${today} (${dayName}). The meeting date is ${refDate}.

Available participants: ${(participants || []).join(', ')}

Spoken text: "${text}"

Return ONLY valid JSON with these fields:
{
  "description": "the task description in Hebrew (clean, concise, professional)",
  "owner": "the responsible person's name (MUST exactly match one of the available participants, or empty string if unclear)",
  "dueDate": "YYYY-MM-DD format (calculate from relative dates, or empty string if no date mentioned)"
}

Rules:
- Match owner name EXACTLY to one of the available participants (e.g. "דני" matches "דני הוכמן", "טלי" matches "טלי קרן")
- Always try to identify the responsible person from context (who was asked to do something)
- For relative dates: "מחר" = tomorrow, "יום ראשון הבא" = next Sunday, "עד סוף השבוע" = this Friday, "בעוד שבוע" = +7 days
- If a specific date is mentioned like "עד ה-23" use the current month and year
- If no date is mentioned but urgency is implied, default to 7 days from meeting date
- Keep description concise but complete, in professional Hebrew
- Return ONLY the JSON object, no other text`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const claudeData = await claudeRes.json();

    if (claudeData.error) {
      console.error('Claude API error:', claudeData.error);
      return res.status(500).json({ error: 'Claude API error', details: claudeData.error });
    }

    const responseText = claudeData.content[0].text.trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: responseText });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error('Error parsing task:', err);
    res.status(500).json({ error: 'Failed to parse task' });
  }
};
