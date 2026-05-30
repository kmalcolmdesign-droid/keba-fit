const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const notionHeaders = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  };

  try {
    // GET — fetch latest progress entries
    if (event.httpMethod === 'GET') {
      const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          sorts: [{ property: 'Date', direction: 'descending' }],
          page_size: 10
        })
      });
      const data = await res.json();

      const entries = (data.results || []).map(page => {
        const p = page.properties;
        return {
          id: page.id,
          week: p['Week']?.title?.[0]?.plain_text || '',
          date: p['Date']?.date?.start || '',
          weight: p['Weight (kg)']?.number || null,
          sessions: p['Sessions']?.select?.name || '',
          protein: p['Protein']?.select?.name || '',
          nutrition: p['Nutrition']?.select?.name || '',
          energy: p['Energy (1-5)']?.number || null,
          backShoulder: p['Back/Shoulder']?.select?.name || '',
          biggestWin: p['Biggest Win']?.rich_text?.[0]?.plain_text || '',
          challenge: p['Challenge']?.rich_text?.[0]?.plain_text || '',
          coachNotes: p['Coach Notes']?.rich_text?.[0]?.plain_text || ''
        };
      });

      return { statusCode: 200, headers, body: JSON.stringify({ entries }) };
    }

    // POST — save a new check-in
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);

      const properties = {
        'Week': { title: [{ text: { content: body.week || '' } }] },
        'Weight (kg)': body.weight ? { number: parseFloat(body.weight) } : { number: null },
        'Sessions': body.sessions ? { select: { name: body.sessions } } : {},
        'Protein': body.protein ? { select: { name: body.protein } } : {},
        'Nutrition': body.nutrition ? { select: { name: body.nutrition } } : {},
        'Energy (1-5)': body.energy ? { number: parseInt(body.energy) } : { number: null },
        'Back/Shoulder': body.backShoulder ? { select: { name: body.backShoulder } } : {},
        'Biggest Win': { rich_text: [{ text: { content: body.biggestWin || '' } }] },
        'Challenge': { rich_text: [{ text: { content: body.challenge || '' } }] },
        'Coach Notes': { rich_text: [{ text: { content: body.coachNotes || '' } }] }
      };

      if (body.date) {
        properties['Date'] = { date: { start: body.date } };
      }

      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({ parent: { database_id: DATABASE_ID }, properties })
      });

      const data = await res.json();
      if (data.id) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: data.id }) };
      } else {
        return { statusCode: 400, headers, body: JSON.stringify({ error: data.message || 'Failed to save' }) };
      }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
