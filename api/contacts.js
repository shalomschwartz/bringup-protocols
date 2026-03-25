const { mondayQuery, BOARDS } = require('./_monday');

module.exports = async function handler(req, res) {
  // POST — create new contact
  if (req.method === 'POST') {
    try {
      const { name, phone, email } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const colVals = {};
      if (phone) colVals.phone__1 = { phone, countryShortName: 'IL' };
      if (email) colVals.email__1 = { email, text: email };

      const data = await mondayQuery(
        `mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
            id
            name
          }
        }`,
        {
          boardId: String(BOARDS.contacts),
          itemName: name,
          columnValues: JSON.stringify(colVals),
        }
      );

      if (data.errors) {
        console.error('Monday create contact errors:', data.errors);
        return res.status(400).json({ error: data.errors });
      }

      res.json(data.data.create_item);
    } catch (err) {
      console.error('Error creating contact:', err);
      res.status(500).json({ error: 'Failed to create contact' });
    }
    return;
  }

  // GET — list contacts
  try {
    const data = await mondayQuery(`{
      boards(ids: [${BOARDS.contacts}]) {
        items_page(limit: 100) {
          items {
            id
            name
            group { id title }
            column_values(ids: ["text_Mjj1lu9j", "email__1", "phone__1"]) {
              id text
            }
          }
        }
      }
    }`);
    const items = data.data.boards[0].items_page.items.map((item) => {
      const role = item.column_values.find(c => c.id === 'text_Mjj1lu9j')?.text || '';
      const email = item.column_values.find(c => c.id === 'email__1')?.text || '';
      const phone = item.column_values.find(c => c.id === 'phone__1')?.text || '';
      return {
        id: item.id,
        name: item.name,
        role,
        email,
        phone,
        group: item.group?.title || '',
      };
    });
    res.json(items);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};
