import { Db } from 'mongodb';
import { Connection as MongooseConnection } from 'mongoose';

interface VarDocument extends Document {
    _id: string;
    value: any;
}

export default class DbVar {
    db: Db;
    collection = 'vars';

    constructor(db: Db, collection?: string) {
        this.db = db;
        if (collection) this.collection = collection;
    }

    async get(name: string) {
        const vars = this.db.collection<VarDocument>(this.collection);
        const variable = await vars.findOne({ _id: name });
        if (!variable) return null;
        return variable.value;
    }

    async set(name: string, value: any) {
        const vars = this.db.collection<{ _id: string; value: any }>(
            this.collection
        );
        await vars.replaceOne(
            { _id: name },
            { value: value },
            { upsert: true }
        );
    }

    async unset(name: string) {
        const vars = this.db.collection<VarDocument>(this.collection);
        const result = await vars.deleteOne({ _id: name });
        return result.deletedCount === 1;
    }

    async reset() {
        return this.db.dropCollection(this.collection);
    }
}
