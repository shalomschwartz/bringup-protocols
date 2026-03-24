// Shared Monday.com helper for all serverless functions
const MONDAY_API = 'https://api.monday.com/v2';

async function mondayQuery(query, variables) {
  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const BOARDS = {
  protocol: 5093376402,
  projects: 1877350176,
  contacts: 1877350141,
};

module.exports = { mondayQuery, BOARDS };
