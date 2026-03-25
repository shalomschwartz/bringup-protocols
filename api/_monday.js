// Shared Monday.com helper for all serverless functions
const MONDAY_API = 'https://api.monday.com/v2';

async function mondayQuery(query, variables) {
  const res = await fetch(MONDAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ0MDg4NTQyOCwiYWFpIjoxMSwidWlkIjo2ODM2OTE2NywiaWFkIjoiMjAyNC0xMS0yNVQxNDo1MDoxMC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjYwMjU0NjcsInJnbiI6ImV1YzEifQ.A1QEGxOKIkdDEZHvyBiJerxztc9grWVdI3EjEmxM38U',
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const BOARDS = {
  protocol: 1718595738,
  projects: 1718594394,
  tasks: 1718595865,
  contacts: 1718596075,
};

module.exports = { mondayQuery, BOARDS };
