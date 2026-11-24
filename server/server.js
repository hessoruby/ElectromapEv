const path = require('path');
const dotenv = require('dotenv');

// Must run before requiring modules that read process.env at load time.
dotenv.config({ path: path.resolve(__dirname, '.env') });

const http = require('http');
const { Server } = require('socket.io');

const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./services/socketService');
const { corsOriginCallback } = require('./config/cors');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOriginCallback('Socket.IO CORS'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

initSocket(io);
app.set('io', io);

connectDB();

server.listen(PORT, () => {
  console.log(`ElectroMap Server running on port ${PORT}`);
});
