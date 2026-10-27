'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '0.0.0.0';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

function resolveFile(urlPath) {
  try {
    const clean = decodeURIComponent(urlPath.split('?')[0]);
    const normalized = path.normalize(clean).replace(/^(\.\.[/\\])+/, '');
    const target = path.resolve(root, '.' + normalized);
    if (!target.startsWith(root + path.sep) && target !== root) return null;
    return target;
  } catch (error) {
    return null;
  }
}

function send(response, status, body, type, headOnly) {
  response.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store'
  });
  if (headOnly) response.end();
  else response.end(body);
}

const server = http.createServer((request, response) => {
  const headOnly = request.method === 'HEAD';
  if (request.method !== 'GET' && !headOnly) {
    send(response, 405, 'Method not allowed', 'text/plain; charset=utf-8', false);
    return;
  }

  let target = resolveFile(request.url);
  if (!target) {
    send(response, 400, 'Bad request', 'text/plain; charset=utf-8', headOnly);
    return;
  }

  fs.stat(target, (statError, stats) => {
    let file = target;

    if (statError || !stats.isFile()) {
      if (!path.extname(target)) {
        file = path.join(root, 'index.html');
      } else {
        send(response, 404, 'Not found', 'text/plain; charset=utf-8', headOnly);
        return;
      }
    }

    fs.readFile(file, (readError, body) => {
      if (readError) {
        send(response, 500, 'Internal server error', 'text/plain; charset=utf-8', headOnly);
        return;
      }

      const extension = path.extname(file).toLowerCase();
      const type = types[extension] || 'application/octet-stream';
      send(response, 200, body, type, headOnly);
    });
  });
});

server.listen(port, host, () => {
  console.log(`Meridian Core Ops listening on http://${host}:${port}`);
});
