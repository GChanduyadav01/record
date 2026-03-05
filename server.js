const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT         = 3000;
const ORDERS_FILE  = path.join(__dirname, 'orders.txt');
const HTML_FILE    = path.join(__dirname, 'index.html');

const SERVICE_LABELS = {
  rec:   '📋 LAB RECORD',
  obs:   '🔬 OBSERVATIONS',
  asg:   '📝 ASSIGNMENT',
  notes: '📚 CLASS NOTES',
};

if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE,
    '╔══════════════════════════════════════════════════════╗\n' +
    '║        RECORD WRITER — ALL SERVICE ORDERS            ║\n' +
    '╚══════════════════════════════════════════════════════╝\n\n', 'utf8');
}

function sanitize(s) { return String(s||'').replace(/[<>"'&]/g,'').trim().slice(0,600); }

function parseBody(req) {
  return new Promise((res, rej) => {
    let b = '';
    req.on('data', c => b += c.toString());
    req.on('end', () => {
      try { const p = new URLSearchParams(b); const d = {}; for (const [k,v] of p) d[k]=v; res(d); }
      catch(e) { rej(e); }
    });
    req.on('error', rej);
  });
}

function priceEstimate(svc, pages, hasDiagrams) {
  if (svc === 'rec') {
    if (pages === '50')  return '₹500' + (hasDiagrams==='true' ? ' + diagram charges' : '');
    if (pages === '100') return '₹1000' + (hasDiagrams==='true' ? ' + diagram charges' : '');
    return 'Custom — to discuss on call';
  }
  const n = parseInt(pages);
  if (!n) return 'To discuss on call';
  return `₹${n*5} – ₹${n*10} (${n} pages × ₹5–₹10)`;
}

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);

  if (req.method === 'GET' && pathname === '/') {
    fs.readFile(HTML_FILE, 'utf8', (err, data) => {
      if (err) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/submit') {
    try {
      const body = await parseBody(req);

      const svc           = sanitize(body.serviceType);
      const studentName   = sanitize(body.studentName);
      const phoneNumber   = sanitize(body.phoneNumber);
      const college       = sanitize(body.college);
      const location      = sanitize(body.collegeLocation);
      const branch        = sanitize(body.branch);
      const year          = sanitize(body.year);
      const subject       = sanitize(body.subject);
      const pages         = sanitize(body.pages);
      const deadline      = sanitize(body.deadline);
      const hasDiagrams   = sanitize(body.hasDiagrams);
      const diagramCount  = sanitize(body.diagramCount);
      const experiments   = sanitize(body.experiments);
      const questions     = sanitize(body.questions);
      const topics        = sanitize(body.topics);
      const notes         = sanitize(body.notes);

      if (!studentName || !phoneNumber || !college || !branch || !subject) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({success:false, message:'Required fields missing.'}));
        return;
      }

      if (!/^[6-9]\d{9}$/.test(phoneNumber.replace(/\s/g,''))) {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({success:false, message:'Invalid phone number.'}));
        return;
      }

      const ts    = new Date().toLocaleString('en-IN', {timeZone:'Asia/Kolkata'});
      const refId = (svc||'ORD').toUpperCase()+'-'+Date.now().toString(36).toUpperCase();
      const est   = priceEstimate(svc, pages, hasDiagrams);
      const label = SERVICE_LABELS[svc] || '📄 ORDER';

      let extra = '';
      if (svc==='rec')   extra = `  Diagrams      : ${hasDiagrams==='true'?'YES ('+diagramCount+')':'No'}\n`;
      if (svc==='obs')   extra = `  Experiments   : ${experiments||'N/A'}\n`;
      if (svc==='asg')   extra = `  Questions     : ${questions||'N/A'}\n`;
      if (svc==='notes') extra = `  Topics        : ${topics||'N/A'}\n`;

      const record = [
        `┌──────────────────────────────────────────────────────┐`,
        `  ${label}`,
        `  Ref ID        : ${refId}`,
        `  Submitted     : ${ts}`,
        `├──────────────────────────────────────────────────────┤`,
        `  Name          : ${studentName}`,
        `  Phone         : ${phoneNumber}`,
        `  College       : ${college}`,
        `  Location      : ${location||'N/A'}`,
        `  Branch        : ${branch}`,
        `  Year/Sem      : ${year||'N/A'}`,
        `├──────────────────────────────────────────────────────┤`,
        `  Subject       : ${subject}`,
        `  Pages         : ${pages||'N/A'}`,
        `  Deadline      : ${deadline||'Not specified'}`,
        extra.trimEnd(),
        `  Est. Price    : ${est}`,
        `  Notes         : ${notes||'None'}`,
        `└──────────────────────────────────────────────────────┘`,
        '',
      ].filter(l=>l!==undefined).join('\n');

      fs.appendFile(ORDERS_FILE, record, 'utf8', err => {
        if (err) {
          res.writeHead(500,{'Content-Type':'application/json'});
          res.end(JSON.stringify({success:false,message:'Could not save order.'}));
          return;
        }
        console.log(`✅  ${label} order saved — ${refId} · ${studentName} · ${phoneNumber}`);
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({success:true, message:'Order received!', refId}));
      });

    } catch(e) {
      console.error(e);
      res.writeHead(400,{'Content-Type':'application/json'});
      res.end(JSON.stringify({success:false,message:'Invalid request.'}));
    }
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🚀  Record Writer is live!`);
  console.log(`   Visit  →  http://localhost:${PORT}`);
  console.log(`   Orders →  orders.txt\n`);
});
