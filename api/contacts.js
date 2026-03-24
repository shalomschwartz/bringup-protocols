const { mondayQuery, BOARDS } = require('./_monday');

module.exports = async function handler(req, res) {
  try {
    const data = await mondayQuery(`{
      boards(ids: [${BOARDS.contacts}]) {
        items_page(limit: 50) {
          items {
            id
            name
            column_values { id type text value }
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
    console.error('Error fetching contacts:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};
