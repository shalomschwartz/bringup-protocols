require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MONDAY_API = 'https://api.monday.com/v2';
const API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ0MDg4NTQyOCwiYWFpIjoxMSwidWlkIjo2ODM2OTE2NywiaWFkIjoiMjAyNC0xMS0yNVQxNDo1MDoxMC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjYwMjU0NjcsInJnbiI6ImV1YzEifQ.A1QEGxOKIkdDEZHvyBiJerxztc9grWVdI3EjEmxM38U';

const BOARDS = {
  protocol: 5093376402,
  projects: 1718594394,
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

// POST /api/protocol — create a new protocol item on the protocol board
app.post('/api/protocol', async (req, res) => {
  try {
    const { name, description, date } = req.body;
    const columnValues = JSON.stringify({
      text_mm1js7hj: description || '',
      date_mm1jmzrh: { date },
    });

    const data = await mondayQuery(
      `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, group_id: "group_mm1jh8px", item_name: $itemName, column_values: $columnValues) {
          id
          name
        }
      }`,
      {
        boardId: String(BOARDS.protocol),
        itemName: name,
        columnValues: columnValues,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BringUp Protocols server running on http://localhost:${PORT}`);
});
