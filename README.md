# db-mongo
Helper functions for mongodb and mongoose.
Here some features:
- realtime queries (RealtimeQuery class)
- persistent variables as in key-value paradigm (DbVar class)

## Prerequisites
Ensure you have a MongoDB database set up and the necessary MongoDB drivers installed in your project. This class is intended to be used in a TypeScript environment.

## Installation
```sh
npm install @winkgroup/db-mongo
```

or

```sh
yarn add @winkgroup/db-mongo
```

## RealtimeQuery 
RealtimeQuery class is designed for managing real-time queries with MongoDB. This class uses MongoDB's Change Streams feature, which allows applications to access real-time data changes without the complexity and risk of tailing the oplog. Change streams are available for replica sets and sharded clusters.

Change Streams, and consequently the *watch()* function, require a replica set or sharded cluster configuration. This is because they rely on the oplog (operations log) for tracking changes, and a standalone MongoDB server (single-node instance) does not maintain an oplog by default.

It's worth noting that you can configure a single-node instance of MongoDB to run as a replica set, which enables the oplog and allows the use of change streams. This setup is sometimes used for development purposes. However, in a production environment, a replica set typically consists of multiple nodes for redundancy and failover capabilities.

### Usage
Here an usage example:
```js
import { MongoClient } from 'mongodb';
import { RealtimeQuery } from '@winkgroup/db-mongo';

async function main() {
    // Connection URL and database/collection names
    const url = 'your-mongodb-connection-string';
    const dbName = 'your-database-name';
    const collectionName = 'your-collection-name';

    // Create a new MongoClient
    const client = new MongoClient(url);

    try {
        // Connect the client to the server
        await client.connect();
        console.log("Connected successfully to server");

        // Get the database and collection
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        // Instantiate RealtimeQuery
        const realtimeQuery = new RealtimeQuery({
            db: db,
            collectionName: collectionName,
        });

        // Subscribe to real-time updates
        realtimeQuery.subscribe(
            {
                queryObj: {}, // Empty query object means 'all documents'
                limit: 50,
                skip: 0,
            },
            (list) => {
                console.info('Received new data:', list);
            }
        );

        // Start listening to changes
        realtimeQuery.start();
    }
}

main().catch(console.error);
```

### Methods
- **subscribe(queryParams: QueryParams, callback: QueryCallback<Doc>)**: Subscribe to changes in the database. Triggers the callback when the query result changes. It returns a subscriberId.
- **unsubscribe(subscriberId: string)**: Unsubscribe from changes. Stops receiving updates for the specified subscription.

where:
```js
interface QueryParams {
    queryObj: object;
    limit: number;
    skip: number;
    sort?: object;
}

type QueryCallback<Doc> = (
    list: Doc[],
    changeDoc: ChangeStreamDocument,
    changeList: ChangeQueryDocumentList<Doc>
) => void;
```

and **"Doc"** represents a generic type parameter. It's a placeholder for the actual type of the documents that you'll be working with in your MongoDB collection. 

### Interactive Integration Test
Under *playground* folder some extra code is provided to make some interctive integration tests.
This is a command line interface test realtime queries
Here the steps to run this test:
1. copy *playground/config.template.json* to *playground/config.json*
1. edit *playground/config.json* setting the credetials of a real mega account
2. run ```npm run realtime``` or ```yarn realtime```

## DbVar Class
The DbVar class provides an abstraction over a MongoDB collection, allowing you to manage the variables stored in the collection easily. The main methods are:
- **get(name: string)**: Retrieves the value of a variable by its name.
- **set(name: string, value: any)**: Sets or updates the value of a variable.
- **unset(name: string)**: Removes a variable from the collection.

When creating a new DbVar object, you can optionally specify the name of the collection you want to use. If not provided, the default **"vars"** collection name is used.

To use the DbVar class, you need an instance of MongoDB's Db class. Here's how you can utilize the DbVar methods:
```js
import DbVar from './path-to-DbVar';
import { MongoClient } from 'mongodb';

// Connect to your MongoDB database
const client = new MongoClient('your-mongodb-connection-string');
await client.connect();
const db = client.db('your-database-name');

// Create an instance of DbVar
const customCollectionName = 'myCustomCollection'; // optional
const dbVar = new DbVar(db, customCollectionName);

// Set a variable
await dbVar.set('myVar', 'myValue');

// Get a variable
const value = await dbVar.get('myVar');
console.log(value);  // Output: 'myValue'

// Unset a variable
await dbVar.unset('myVar');
```

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Maintainers
* [fairsayan](https://github.com/fairsayan)