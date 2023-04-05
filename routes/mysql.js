const express = require('express');
const mariadb = require('mariadb');

module.exports = function (clientConfig, connections) {
  const router = express.Router();

  connections.forEach(connectionItem => {
    const { clientToken, connection } = connectionItem;

    function setCustomHeader(req, res, next) {
        const data      = global.ClientConfiguration;
        const foundData = data.find(item => item.clientToken === clientToken);
        res.set('X-Client-Token', clientToken);
        res.set('X-Client-Source', foundData.source);
        res.set('X-Client-Name', foundData.clientId);
        next();
    }

    router.post(`/${clientToken}/query`, setCustomHeader, async (req, res) => {
      const { clientToken: urlClientToken, query } = req.body;

      if (!query) {
        return res.status(400).send('Query parameter is required');
      }

      try {
        const results = await executeQuery(connection, query);
        res.send(results);
      } catch (error) {
        console.error(error);
        res.status(500).send('Error executing query');
      }
    });
  });

  async function executeQuery(connection, query) {
    let conn;

    try {
      conn = await mariadb.createConnection(connection);
      const result = await conn.query(query);
      return result;
    } catch (error) {
      throw error;
    } finally {
      if (conn) {
        conn.end();
      }
    }
  }

  return router;
}
