const { mondayQuery, BOARDS } = require('./_monday');

module.exports = async function handler(req, res) {
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
