require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MONDAY_API = 'https://api.monday.com/v2';
const API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ0MDg4NTQyOCwiYWFpIjoxMSwidWlkIjo2ODM2OTE2NywiaWFkIjoiMjAyNC0xMS0yNVQxNDo1MDoxMC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjYwMjU0NjcsInJnbiI6ImV1YzEifQ.A1QEGxOKIkdDEZHvyBiJerxztc9grWVdI3EjEmxM38U';

const BOARDS = {
  protocol: 1718595738,
  projects: 1718594394,
  tasks: 1718595865,
  contacts: 1877350141,
};

async function mondayQuery(query, variables) {
  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// GET /api/projects — fetch projects from תיקי פרויקטים board
app.get('/api/projects', async (req, res) => {
  try {
    const data = await mondayQuery(`{
      boards(ids: [${BOARDS.projects}]) {
        items_page(limit: 50) {
          items {
            id
            name
            column_values(ids: ["portfolio_project_step", "portfolio_project_rag", "portfolio_project_planned_timeline", "portfolio_project_scope", "location__1"]) {
              id
              type
              text
              value
            }
          }
        }
      }
    }`);
    const items = data.data.boards[0].items_page.items.map((item) => {
      const cols = {};
      item.column_values.forEach((c) => {
        cols[c.id] = { type: c.type, text: c.text, value: c.value };
      });
      return { id: item.id, name: item.name, columns: cols };
    });
    res.json(items);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects — create a new project on the projects board
app.post('/api/projects', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const data = await mondayQuery(
      `mutation ($boardId: ID!, $itemName: String!) {
        create_item(board_id: $boardId, item_name: $itemName) {
          id
          name
        }
      }`,
      {
        boardId: String(BOARDS.projects),
        itemName: name,
      }
    );

    if (data.errors) {
      console.error('Monday mutation errors:', data.errors);
      return res.status(400).json({ error: data.errors });
    }

    res.json(data.data.create_item);
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET /api/contacts — fetch Contacts board items
app.get('/api/contacts', async (req, res) => {
  try {
    const data = await mondayQuery(`{
      boards(ids: [${BOARDS.contacts}]) {
        items_page(limit: 50) {
          items {
            id
            name
            column_values {
              id
              type
              text
              value
            }
          }
        }
      }
    }`);
    const items = data.data.boards[0].items_page.items.map((item) => {
      const cols = {};
      item.column_values.forEach((c) => {
        cols[c.id] = { type: c.type, text: c.text, value: c.value };
      });
      return { id: item.id, name: item.name, columns: cols };
    });
    res.json(items);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// GET /api/users — fetch Monday.com workspace users
app.get('/api/users', async (req, res) => {
  try {
    const data = await mondayQuery(`{ users { id name email } }`);
    res.json(data.data.users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/protocol — create a new protocol item on board 1718595738 (פרוטוקול)
app.post('/api/protocol', async (req, res) => {
  try {
    const { name, date, location, summary, projectId, recorderId, taskIds } = req.body;

    const PROTOCOL_BOARD = 1718595738;
    const colVals = {};

    // Date
    if (date) colVals.date4 = { date };

    // Location
    if (location) colVals.text_mkkstk45 = location;

    // Meeting summary
    if (summary) colVals.long_text__1 = { text: summary };

    // Link to project
    if (projectId) colVals.connect_boards__1 = { item_ids: [Number(projectId)] };

    // Recorder (who filled the protocol)
    if (recorderId) colVals.people_mkktj646 = { personsAndTeams: [{ id: Number(recorderId), kind: 'person' }] };

    // Link to tasks
    if (taskIds && taskIds.length > 0) {
      colVals.board_relation_mm1hhbed = { item_ids: taskIds.map(Number) };
    }

    const data = await mondayQuery(
      `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, group_id: "new_group_mkkf3c5z", item_name: $itemName, column_values: $columnValues) {
          id
          name
        }
      }`,
      {
        boardId: String(PROTOCOL_BOARD),
        itemName: name,
        columnValues: JSON.stringify(colVals),
      }
    );

    if (data.errors) {
      console.error('Monday mutation errors:', data.errors);
      return res.status(400).json({ error: data.errors });
    }

    res.json(data.data.create_item);
  } catch (err) {
    console.error('Error creating protocol:', err);
    res.status(500).json({ error: 'Failed to create protocol' });
  }
});

// POST /api/tasks — create tasks on board 1718595865 linked to a project
app.post('/api/tasks', async (req, res) => {
  try {
    const { projectId, tasks } = req.body; // projectId = item ID on projects board, tasks = [{ name, date }]

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks[] required' });
    }

    const TASK_BOARD = 1718595865;
    const results = [];

    for (const task of tasks) {
      const colVals = {};
      if (task.date) colVals.date__1 = { date: task.date };
      if (projectId) colVals.link_to__________________1 = { item_ids: [Number(projectId)] };
      if (task.ownerId) colVals.people__1 = { personsAndTeams: [{ id: Number(task.ownerId), kind: 'person' }] };

      const data = await mondayQuery(
        `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_item(board_id: $boardId, group_id: "topics", item_name: $itemName, column_values: $columnValues) {
            id
            name
          }
        }`,
        {
          boardId: String(TASK_BOARD),
          itemName: task.name,
          columnValues: JSON.stringify(colVals),
        }
      );

      if (data.errors) {
        console.error('Task creation error:', data.errors);
        results.push({ error: data.errors, task: task.name });
      } else {
        results.push(data.data.create_item);
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Error creating tasks:', err);
    res.status(500).json({ error: 'Failed to create tasks' });
  }
});

// POST /api/parse-task — use Claude AI to parse spoken task into structured fields
const CLAUDE_API_KEY = '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';

app.post('/api/parse-task', async (req, res) => {
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
    // Extract JSON from response (handle possible markdown wrapping)
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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BringUp Protocols server running on http://localhost:${PORT}`);
});
