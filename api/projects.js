const { mondayQuery, BOARDS } = require('./_monday');

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    // Create new project
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
    return;
  }

  // GET — fetch projects
  try {
    const data = await mondayQuery(`{
      boards(ids: [${BOARDS.projects}]) {
        items_page(limit: 50) {
          items {
            id
            name
            column_values(ids: ["portfolio_project_step", "portfolio_project_rag", "portfolio_project_planned_timeline", "portfolio_project_scope", "location__1"]) {
              id type text value
            }
          }
        }
      }
    }`);
    const items = data.data.boards[0].items_page.items.map((item) => {
      const cols = {};
      item.column_values.forEach((c) => { cols[c.id] = { type: c.type, text: c.text, value: c.value }; });
      return { id: item.id, name: item.name, columns: cols };
    });
    res.json(items);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};
