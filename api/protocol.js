const { mondayQuery, BOARDS } = require('./_monday');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
};
