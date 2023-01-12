import fs from 'fs';
import { Connection, Model, Schema } from 'mongoose';
import Db from '../src/index';

jest.setTimeout(10000);

let config: any = null;
let db1: Connection;
let db2: Connection;
let TestModel1: Model<{ name: string }, {}, {}, {}, any>;
let TestModel2: Model<{ name: string }, {}, {}, {}, any>;

beforeAll(async () => {
    const configStr = fs.readFileSync('./tests/config.json', 'utf-8');
    config = JSON.parse(configStr);

    db1 = Db.get(config.dbUri1);
    db2 = Db.get(config.dbUri2);

    TestModel1 = db1.model<{ name: string }>(
        'Test',
        new Schema({ name: String })
    );
    TestModel2 = db2.model<{ name: string }>(
        'Test',
        new Schema({ name: String })
    );
});

afterAll(async () => {
    await db1.dropDatabase();
    await db2.dropDatabase();
    db1.close();
    db2.close();
});

test('it should wait for db connected', async () => {
    try {
        const driver = await Db.getMongoDb(config.dbUri1);
        expect(driver).toBeTruthy();
    } catch (e) {
        fail(e);
    }
});

test('should create a document in "test" collection on db with dbUri1', async () => {
    const doc = new TestModel1({ name: 'hello' });
    await doc.save();
    const count = await TestModel1.find().count();
    expect(count).toBe(1);
});

test('should create a document in "test" collection on db with dbUri2 and delete document in dbUri1', async () => {
    const doc = new TestModel2({ name: 'hello' });
    await doc.save();
    const count = await TestModel2.find().count();
    expect(count).toBe(1);

    await db1.dropCollection('tests');
    const count2 = await TestModel1.find().count();
    expect(count2).toBe(0);
});
