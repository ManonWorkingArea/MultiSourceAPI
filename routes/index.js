function addHeaders(source, clientID, clientToken) {
  return (req, res, next) => {
    res.setHeader('X-Source', source);
    res.setHeader('X-ClientID', clientID);
    res.setHeader('X-ClientToken', clientToken);
    next();
  };
}

const sourceMap = {
    mongodb: './mongodb',
    postgresql: './postgresql',
    mysql: './mysql',
    firestore: './firestore',
    api: './api'
  };
  
  function setupRoutes(app, clientConfigs) {
    app.use('/api', (req, res, next) => {
      const urlParts = req.url.split('/');
      const clientToken = urlParts[1] || '523409d67lEXMbFU';
      const clientConfigExists = Object.values(clientConfigs).some(config => config.clientToken === clientToken);
  
      if (!clientToken) {
        res.status(500).json({ message: 'Not authenticated client' });
      } else if (!clientConfigExists) {
        res.status(500).json({ message: 'Invalid client token' });
      } else {
        next();
      }
    });


    const connections = {};

    for (const clientConfig of clientConfigs) {
      if (!connections[clientConfig.source]) {
        connections[clientConfig.source] = [];
      }

      connections[clientConfig.source].push({
        clientToken: clientConfig.clientToken,
        connection: clientConfig.connection
      });
    }

    for (const source in sourceMap) {
      const sourceFile = sourceMap[source];
      const sourceRoutes = require(sourceFile);
    
      const config = clientConfigs.find(c => c.source === source);
      if (!config) {
        console.error(`No config found for source "${source}"`);
        continue;
      } 
      app.use(`/api`, addHeaders(source, config.clientId, config.clientToken), sourceRoutes(config, connections[source]));
    }
    
  }
  
  module.exports = setupRoutes;  