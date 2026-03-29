const { mondayQuery, BOARDS } = require('./_monday');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { text, participants } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a Hebrew meeting task parser. Extract task information from spoken Hebrew text.
Return a JSON object with these fields:
- "description": The actual task description (clean, without date/owner info)
- "owner": The person responsible (if mentioned). Common patterns: "באחריות X", "X צריך", "X יבדוק", "של X"
- "dueDate": Due date in YYYY-MM-DD format (if mentioned). Parse Hebrew dates like "ה-23 למרץ 2026", "עד סוף החודש", "עד יום שלישי", ordinal words like "הראשון", "השני", months like "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר". Today is ${new Date().toISOString().split('T')[0]}.

ONLY return valid JSON. No markdown, no explanation.
If you can't extract a field, omit it from the JSON.
The description should be CLEAN — remove the date and owner references from it.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error('OpenAI error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    const content = data.choices[0].message.content.trim();
    // Strip markdown code fences if present
    const jsonStr = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(jsonStr);

    return res.json({
      description: parsed.description || text,
      owner: parsed.owner || '',
      dueDate: parsed.dueDate || '',
    });
  } catch (err) {
    console.error('Parse error:', err);
    return res.status(500).json({ error: err.message });
  }
};
