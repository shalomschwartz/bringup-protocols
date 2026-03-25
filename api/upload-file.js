const API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ0MDg4NTQyOCwiYWFpIjoxMSwidWlkIjo2ODM2OTE2NywiaWFkIjoiMjAyNC0xMS0yNVQxNDo1MDoxMC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjYwMjU0NjcsInJnbiI6ImV1YzEifQ.A1QEGxOKIkdDEZHvyBiJerxztc9grWVdI3EjEmxM38U';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { itemId, filename, fileBase64 } = req.body;
    if (!itemId || !fileBase64) {
      return res.status(400).json({ error: 'itemId and fileBase64 required' });
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const fname = filename || 'protocol.docx';

    // Detect content type from filename
    const ext = fname.split('.').pop().toLowerCase();
    const contentTypes = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Build multipart form for Monday.com file API
    const boundary = '----MondayBoundary' + Date.now();
    const query = `mutation ($file: File!) { add_file_to_column(file: $file, item_id: ${itemId}, column_id: "files__1") { id url } }`;

    const queryPart = `--${boundary}\r\nContent-Disposition: form-data; name="query"\r\n\r\n${query}\r\n`;
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="variables[file]"; filename="${fname}"\r\nContent-Type: ${contentType}\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;

    const body = Buffer.concat([
      Buffer.from(queryPart, 'utf-8'),
      Buffer.from(fileHeader, 'utf-8'),
      fileBuffer,
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
    res.status(500).json({ error: 'Failed to upload file' });
  }
};
