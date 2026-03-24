const API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ0MDg4NTQyOCwiYWFpIjoxMSwidWlkIjo2ODM2OTE2NywiaWFkIjoiMjAyNC0xMS0yNVQxNDo1MDoxMC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjYwMjU0NjcsInJnbiI6ImV1YzEifQ.A1QEGxOKIkdDEZHvyBiJerxztc9grWVdI3EjEmxM38U';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { itemId, filename, pdfBase64 } = req.body;
    if (!itemId || !pdfBase64) {
      return res.status(400).json({ error: 'itemId and pdfBase64 required' });
    }

    // Convert base64 to Buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const fname = filename || 'protocol.pdf';

    // Build multipart form for Monday.com file API
    const boundary = '----MondayBoundary' + Date.now();
    const query = `mutation ($file: File!) { add_file_to_column(file: $file, item_id: ${itemId}, column_id: "files__1") { id url } }`;

    const queryPart = `--${boundary}\r\nContent-Disposition: form-data; name="query"\r\n\r\n${query}\r\n`;
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="variables[file]"; filename="${fname}"\r\nContent-Type: application/pdf\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(queryPart, 'utf-8'),
      Buffer.from(fileHeader, 'utf-8'),
      pdfBuffer,
      Buffer.from(fileFooter, 'utf-8'),
    ]);

    const mondayRes = await fetch('https://api.monday.com/v2/file', {
      method: 'POST',
      headers: {
        'Authorization': API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    });

    const result = await mondayRes.json();

    if (result.errors) {
      console.error('Monday file upload error:', result.errors);
      return res.status(500).json({ error: result.errors });
    }

    res.json(result.data?.add_file_to_column || { success: true });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload PDF' });
  }
};
