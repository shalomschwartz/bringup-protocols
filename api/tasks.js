const { mondayQuery } = require('./_monday');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { parentId, tasks } = req.body;

    if (!parentId || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'parentId and tasks[] required' });
    }

    const results = [];
    for (const task of tasks) {
      const columnValues = JSON.stringify({
        date0: task.date ? { date: task.date } : undefined,
      });

      const data = await mondayQuery(
        `mutation ($parentId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_subitem(parent_item_id: $parentId, item_name: $itemName, column_values: $columnValues) {
            id
            name
          }
        }`,
        {
          parentId: String(parentId),
          itemName: task.name,
          columnValues: columnValues,
        }
      );

      if (data.errors) {
        results.push({ error: data.errors, task: task.name });
      } else {
        results.push(data.data.create_subitem);
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Error creating tasks:', err);
    res.status(500).json({ error: 'Failed to create tasks' });
  }
};
