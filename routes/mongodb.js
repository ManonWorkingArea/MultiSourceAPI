const { Router } = require(`express`);
const MongoClient = require(`mongodb`).MongoClient;

module.exports = function (clientConfig, connections) {
    const router        = Router();
    const express       = require(`express`);
    const mongoose      = require(`mongoose`);
    const { ObjectId }  = require(`mongodb`);
    connections.forEach(item => {
        // Use MongoClient to connect to MongoDB
        const client = new MongoClient(item.connection.URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true
        });
    
        client.connect(err => {
            if (err) {
                console.error(err);
                return;
            }
    
            const db = client.db();
            
            // Get all GET connection
            router.get(`/${item.clientToken}/:collection`, async (req, res) => {
                const collectionName = req.params.collection;
                const collection = db.collection(collectionName);
                try {
                const items = await collection.find().toArray();
                res.status(200).json(items);
                } catch (err) {
                res.status(500).json({ message: err.message });
                }
            });

            // Get a single document by ID from a collection
            router.get(`/${item.clientToken}/:collection/:id`, async (req, res) => {
                const collectionName = req.params.collection;
                const documentId = req.params.id;
                const joinCollection = req.query.join; // Updated variable name
                const arrayField = req.query.sub; // Updated variable name
                const collection = db.collection(collectionName);
            
                try {
                const document = await collection.findOne({ _id: new ObjectId(documentId) });
            
                if (!document) {
                    res.status(404).json({ message: `Document not found` });
                    return;
                }
            
                if (joinCollection && arrayField) {
                    const joinColl = db.collection(joinCollection);
                    const idsToLookup = document[arrayField];
                    const joinedDocs = await joinColl.find({ _id: { $in: idsToLookup.map(id => new ObjectId(id)) } }).toArray();
                    document[arrayField] = joinedDocs;
                }
            
                res.status(200).json(document);
                } catch (err) {
                res.status(500).json({ message: err.message });
                }
            });
            
            router.post(`/${item.clientToken}/:collection`, async (req, res) => {
                
                const collection = db.collection(collectionName);
                const { data, options } = req.body;
            
                try {
                    // Process the fieldType option
                    if (options && options.fieldType) {
                        options.fieldType.forEach(([field, type]) => {
                            if (type === `objectId` && data[field]) {
                                data[field] = new mongoose.Types.ObjectId(data[field]);
                            } else if (type === `number` && data[field]) {
                                data[field] = Number(data[field]);
                            }
                        });
                    }
            
                    // Check if options.uniqueFields is provided and find a document with the same field values
                    if (options && options.uniqueFields) {
                        const uniqueQuery = options.uniqueFields.reduce((query, field) => {
                            query[field] = data[field];
                            return query;
                        }, {});
            
                        const existingItem = await collection.findOne(uniqueQuery);
            
                        if (existingItem) {
                            res.status(400).json({ message: `Duplicate entry for the unique fields: ${options.uniqueFields.join(`, `)}` });
                            return;
                        }
                    }
            
                    // Create a text index for the fields provided in options.textIndexFields
                    if (options && options.textIndexFields) {
                        const indexFields = options.textIndexFields.reduce((obj, field) => {
                            obj[field] = `text`;
                            return obj;
                        }, {});
                        await collection.createIndex(indexFields);
                    }
            
                    // Add the createdAt field to store the current timestamp
                    data.createdAt = new Date();
            
                    const result = await collection.insertOne(data);
                    const insertedItem = await collection.findOne({ _id: result.insertedId });
                    res.status(201).json(insertedItem);
                } catch (err) {
                    res.status(500).json({ message: err.message });
                }
            });
            
            // Update a document by ID in a collection
            router.put(`/${item.clientToken}/:collection/:id`, async (req, res) => {
                const collectionName = req.params.collection;
                const collection = db.collection(collectionName);
                const { data, options } = req.body;
    
                try {
                    const id = new mongoose.Types.ObjectId(req.params.id);
    
                    // Check if options.unique is provided and find a document with the same field value
                    if (options && options.unique) {
                        const existingItem = await collection.findOne({ [options.unique]: data[options.unique], _id: { $ne: id } });
    
                        if (existingItem) {
                            res.status(400).json({ message: `Duplicate entry for the unique field: ${options.unique}` });
                            return;
                        }
                    }
    
                    // Add the updatedAt field to store the current timestamp
                    data.updatedAt = new Date();
    
                    const update = { $set: data };
                    const result = await collection.updateOne({ _id: id }, update);
    
                    if (result.matchedCount > 0) {
                        const updatedItem = await collection.findOne({ _id: id });
                        res.status(200).json(updatedItem);
                    } else {
                        res.status(404).json({ message: `Item not found` });
                    }
                } catch (err) {
                    res.status(400).json({ message: err.message });
                }
            });
    
            // Delete a document by ID from a collection
            router.delete(`/${item.clientToken}/:collection/:id`, async (req, res) => {
            const collectionName = req.params.collection;
            const collection = db.collection(collectionName);
            try {
                const id = new mongoose.Types.ObjectId(req.params.id);
                const result = await collection.deleteOne({ _id: id });
                if (result.deletedCount > 0) {
                res.status(200).json({ message: `Item deleted` });
                } else {
                res.status(404).json({ message: `Item not found` });
                }
            } catch (err) {
                res.status(500).json({ message: err.message });
            }
            });
    
            router.post(`/${item.clientToken}/:collection/query`, async (req, res) => {
                const collectionName = req.params.collection;
                const collection = db.collection(collectionName);
                try {
                    const { method, args } = req.body;
    
                    if (!method || !Array.isArray(args)) {
                        res.status(400).json({ message: `Invalid request format` });
                        return;
                    }
    
                    if (method === `aggregate`) {
                        // Convert string ObjectIds to ObjectId instances
                        args[0] = args[0].map((stage) => {
                            for (const key in stage) {
                            if (stage[key] instanceof Object) {
                                for (const innerKey in stage[key]) {
                                if (typeof stage[key][innerKey] === `string` && innerKey === `_id`) {
                                    stage[key][innerKey] = safeObjectId(stage[key][innerKey]);
                                }
                                }
                            }
                            }
                            return stage;
                        });
                    }
    
                    const result = await collection[method](...args).toArray(); // Handle the results as an array directly
                    console.log("Query result:", result); // Add this line to log the result
                    res.status(200).json(result);
                } catch (err) {
                    res.status(500).json({ message: err.message });
                }
            });
            
            // Search for documents in a collection
            router.post(`/${item.clientToken}/:collection/search`, async (req, res) => {
                const collectionName = req.params.collection;
                const collection = db.collection(collectionName);
                const query = req.body;
            
                try {
                const cursor = await collection.find(query);
                const results = await cursor.toArray();
                res.status(200).json(results);
                } catch (err) {
                res.status(500).json({ message: err.message });
                }
            });
    
            // Add, update, or remove an element in a subarray of a document
            router.post(`/${item.clientToken}/:collection/:documentId/:arrayField`, async (req, res) => {
                const collectionName = req.params.collection;
                const documentId = req.params.documentId;
                const arrayField = req.params.arrayField;
                const collection = db.collection(collectionName);
                const { action, element, newElement, type } = req.body;
    
                try {
                    const document = await collection.findOne({ _id: new ObjectId(documentId) });
                    if (!document) {
                        res.status(404).json({ message: `Document not found` });
                        return;
                    }
    
                    let arrayData = document[arrayField];
    
                    if (!arrayData || !Array.isArray(arrayData)) {
                        const update = { $set: { [arrayField]: [], updatedAt: new Date() } };
                        await collection.updateOne({ _id: new ObjectId(documentId) }, update);
                        const updatedDocument = await collection.findOne({ _id: new ObjectId(documentId) });
                        arrayData = updatedDocument[arrayField];
                    }
    
                    let convertedElement, convertedNewElement;
    
                    if (type === `objectId`) {
                        convertedElement = new mongoose.Types.ObjectId(element);
                        if (newElement) {
                            convertedNewElement = new mongoose.Types.ObjectId(newElement);
                        }
                    } else {
                        convertedElement = element;
                        convertedNewElement = newElement;
                    }
    
                    let update;
    
                    if (action === `add`) {
                        update = { $addToSet: { [arrayField]: convertedElement }, $set: { updatedAt: new Date() } };
                    } else if (action === `update`) {
                        const index = arrayData.findIndex(item => item.toString() === convertedElement.toString());
                        if (index < 0) {
                            res.status(404).json({ message: `Element ${element} not found in ${arrayField}` });
                            return;
                        }
                        update = { $set: { [`${arrayField}.${index}`]: convertedNewElement, updatedAt: new Date() } };
                    } else if (action === `remove`) {
                        update = { $pull: { [arrayField]: convertedElement }, $set: { updatedAt: new Date() } };
                    } else {
                        res.status(400).json({ message: `Invalid action` });
                        return;
                    }
    
                    await collection.updateOne({ _id: new ObjectId(documentId) }, update);
                    const finalUpdatedDocument = await collection.findOne({ _id: new ObjectId(documentId) });
                    res.status(200).json(finalUpdatedDocument);
                } catch (err) {
                    res.status(500).json({ message: err.message });
                }
            });
        });
      });

  return router;
};