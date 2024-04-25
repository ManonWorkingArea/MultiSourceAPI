const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const setupRoutes = require('./routes');

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

async function initializeApp() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  try {
    await mongoClient.connect();
    const db = mongoClient.db('API');
    global.ClientConfiguration = await db.collection('clients').find().toArray();

    setupRoutes(app, global.ClientConfiguration);

    const server = app.listen(process.env.PORT, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });

    // Set timeout to 5 minutes
    server.setTimeout(300000);  // Timeout is in milliseconds
  } catch (err) {
    console.error('Failed to fetch client configurations from MongoDB', err);
    process.exit(1); // Exit process with error
  } finally {
    await mongoClient.close(); // Ensure MongoDB connection is closed
  }
}

initializeApp();
