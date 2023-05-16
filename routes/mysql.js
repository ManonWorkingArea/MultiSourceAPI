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
        return res.status(400).send('Query parameter is required', query);
      }
    
      try {
        const { mainQuery, countQuery } = query;
    
        // Initialize variables
        let countResults;
        let totalItems;
    
        // Execute the main query to retrieve the data
        const results = await executeQuery(connection, mainQuery);
    
        // Check if countQuery is provided
        if (countQuery) {
          // Execute the count query to retrieve the total count
          countResults = await executeQuery(connection, countQuery);
          totalItems = countResults[0].total_count.toString(); // Convert BigInt to string
        } else {
          // Use the length of the results as the total count
          totalItems = results.length.toString(); // Convert to string
        }
    
        // Convert BigInt values to strings in the results
        const convertedResults = results.map(result => ({
          ...result,
          student_id: result.student_id.toString(),
          school_id: result.school_id.toString(),
        }));
    
        res.send({
          data: convertedResults,
          totalItems: totalItems,
        });
      } catch (error) {
        console.error(error); // Log the error message for debugging
        res.status(500).send('Error executing query: ' + error.message);
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
