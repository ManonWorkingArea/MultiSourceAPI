function addHeaders(source, clientID) {
  return (req, res, next) => {
    res.setHeader('X-Source', source);
    res.setHeader('X-ClientID', clientID);
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
      const clientToken = urlParts[1];
      const clientConfigExists = Object.values(clientConfigs).some(config => config.clientToken === clientToken);
  
      if (!clientToken) {
        res.status(500).json({ message: 'Not authenticated client' });
      } else if (!clientConfigExists) {
        res.status(500).json({ message: 'Invalid client token' });
      } else {
        next();
      }
    });
  
    
    for (const client in clientConfigs) {
      const config = clientConfigs[client];
      const sourceFile = sourceMap[config.source];
      const sourceRoutes = require(sourceFile);
    
      app.use(`/api/${config.clientToken}`, addHeaders(config.source, config.clientId), sourceRoutes(config));
    }  
  }
  
  module.exports = setupRoutes;  