import { question } from '@winkgroup/misc/dist/node';
import fs from 'fs';
import { MongoClient } from 'mongodb';
import { RealtimeQuery } from '../src';

const configStr = fs.readFileSync('./playground/config.json', 'utf-8');
const config = JSON.parse(configStr);

async function run() {
    let option = '';
    console.info(`
Run this on different console or edit data directly on DB
Be sure to have correctly configurated playground/config.json
    `);
    const client = new MongoClient(config.dbUri);
    await client.connect();
    const db = client.db();
    const collection = db.collection(config.collectionName);

    const realTimeQuery = new RealtimeQuery({
        db: db,
        collectionName: config.collectionName,
    });

    realTimeQuery.subscribe(
        {
            queryObj: {},
            limit: 50,
            skip: 0,
        },
        (list) => {
            console.info('NEW DATA!', list);
        },
    );

    realTimeQuery.start();

    while (option !== '0') {
        console.info(`


        Options:
1. insert data
2. delete data
0. exit
        `);
        option = await question('Choose: ');

        switch (option) {
            case '1':
                await collection.insertOne({ text: 'this is a test' });
                break;
            case '2':
                await collection.deleteOne({});
                break;
        }
    }

    process.exit();
}

run();
