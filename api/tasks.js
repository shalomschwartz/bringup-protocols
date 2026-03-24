const { mondayQuery } = require('./_monday');

const TASK_BOARD = 1718595865;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, tasks } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks[] required' });
    }

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
};
