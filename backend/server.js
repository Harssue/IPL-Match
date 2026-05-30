require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const { sequelize } = require('./models');
const { auctionSeq } = require('./auctionDb');
const registerMatchSocket = require('./socket/matchSocket');

const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

registerMatchSocket(io);
app.set('io', io);

// ── Middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────
app.use('/api/setup',    require('./routes/setup'));
app.use('/api/fixtures', require('./routes/fixtures'));
app.use('/api/match',    require('./routes/match'));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Serve React Frontend (Production) ─────────────────────────────
const path = require('path');
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// ── Startup ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;

async function start() {
  try {
    await auctionSeq.authenticate();
    console.log('[Auction DB] Connected (read-only)');

    await sequelize.authenticate();
    await sequelize.sync({ force: false });
    console.log('[Match DB]   Connected and tables synced');

    server.listen(PORT, () => {
      console.log(`\n🏏  IPL Match Engine — http://localhost:${PORT}`);
      console.log(`    Health check: http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
