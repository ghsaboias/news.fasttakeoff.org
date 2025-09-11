const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const cors = require('cors');

const app = express();

// Enable CORS for all origins (dev tool)
app.use(cors());

// Serve static files from newsletter directory
app.use(express.static(__dirname));

// Also serve the parent directory (for newsletter-data.json)
app.use(express.static(path.join(__dirname, '..')));

// API endpoint to generate newsletter data
app.post('/api/generate-newsletter', (req, res) => {
  console.log('🔄 Starting newsletter generation...');
  
  const scriptPath = path.join(__dirname, '..', 'scripts', 'generate-newsletter-data.js');
  
  // Run the newsletter generation script
  exec(`node "${scriptPath}"`, { 
    cwd: path.join(__dirname, '..'),
    timeout: 120000 // 2 minute timeout
  }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Newsletter generation failed:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        stderr: stderr 
      });
      return;
    }
    
    console.log('✅ Newsletter generation completed');
    
    // Read the generated newsletter data and return it
    try {
      const dataPath = path.join(__dirname, '..', 'newsletter-data.json');
      const newsletterData = JSON.parse(require('fs').readFileSync(dataPath, 'utf8'));
      res.json({ 
        success: true, 
        data: newsletterData,
        output: stdout,
        stderr: stderr 
      });
    } catch (readError) {
      console.error('❌ Failed to read generated data:', readError);
      res.json({ 
        success: true, 
        output: stdout,
        stderr: stderr 
      });
    }
  });
});

const https = require('https');
const url = require('url');

// Image proxy
app.get('/api/image-proxy', (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('Missing image URL');
  }

  const parsedUrl = url.parse(imageUrl);

  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.path,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, {
      end: true
    });
  });

  proxyReq.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    res.status(500).send(`Problem with request: ${e.message}`);
  });

  proxyReq.end();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Newsletter dev server running' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`📰 Newsletter dev server running on http://localhost:${PORT}`);
  console.log(`🎨 Open: http://localhost:${PORT}/`);
});