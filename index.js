const express         = require('express');
const bodyParser      = require('body-parser');
const cors            = require('cors');
const dotenv          = require('dotenv');

const clientConfigs   = require('./clientConfigs.json');
const mongoRoutes     = require('./routes/mongodb');
const postgreRoutes   = require('./routes/postgresql');
const mysqlRoutes     = require('./routes/mysql');
const firestoreRoutes = require('./routes/firestore');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Custom middleware to add source and clientID to the response header
function addHeaders(source, clientID) {
  return (req, res, next) => {
    res.setHeader('X-Source', source);
    res.setHeader('X-ClientID', clientID);
    next();
  };
}

// Middleware to check if the client token is provided and valid
app.use('/api', (req, res, next) => {
  const urlParts = req.url.split('/');
  const clientToken = urlParts[1]; // Get the client token from the URL
  const clientConfigExists = Object.values(clientConfigs).some(config => config.clientToken === clientToken);

  if (!clientToken) {
    res.status(500).json({ message: 'Not authenticated client' });
  } else if (!clientConfigExists) {
    res.status(500).json({ message: 'Invalid client token' });
  } else {
    next();
  }
});

// Create new routes for each client with their respective configurations
for (const client in clientConfigs) {
  const config = clientConfigs[client];

  if (config.source === 'mongodb') {
    app.use(`/api/${config.clientToken}`, addHeaders(config.source, config.clientId), mongoRoutes(config));
  } else if (config.source === 'postgresql') {
    app.use(`/api/${config.clientToken}`, addHeaders(config.source, config.clientId), postgreRoutes(config));
  }else if (config.source === 'mysql') {
    app.use(`/api/${config.clientToken}`, addHeaders(config.source, config.clientId), mysqlRoutes(config));
  }else if (config.source === 'firestore') {
    app.use(`/api/${config.clientToken}`, addHeaders(config.source, config.clientId), firestoreRoutes(config));
  }
}

app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
