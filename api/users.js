const { mondayQuery } = require('./_monday');

module.exports = async function handler(req, res) {
  try {
    const data = await mondayQuery(`{ users { id name email } }`);
    res.json(data.data.users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
