const { mondayQuery } = require('./_monday');

const PROTOCOL_BOARD = 1718595738;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, date, location, summary, projectId, recorderId, taskIds } = req.body;

    const colVals = {};

    if (date) colVals.date4 = { date };
    if (location) colVals.text_mkkstk45 = location;
    if (summary) colVals.long_text__1 = { text: summary };
    if (projectId) colVals.connect_boards__1 = { item_ids: [Number(projectId)] };
    if (recorderId) colVals.people_mkktj646 = { personsAndTeams: [{ id: Number(recorderId), kind: 'person' }] };
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
};
