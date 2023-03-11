import Db from '.';

export default class DbVar {
    dbUri: string;
    collection = 'vars';

    constructor(dbUri: string, collection?: string) {
        this.dbUri = dbUri;
        if (collection) this.collection = collection;
    }

    async get(name: string) {
        const client = await Db.getMongoDb(this.dbUri);
        const vars = client.collection(this.collection);
        const variable = await vars.findOne({ _id: name });
        if (!variable) return null;
        return variable.value;
    }

    async set(name: string, value: any) {
        const client = await Db.getMongoDb(this.dbUri);

        const vars = client.collection<{ _id: string; value: any }>(
            this.collection
        );
        await vars.replaceOne(
            { _id: name },
            { value: value },
            { upsert: true }
        );
    }

    async unset(name: string) {
        const client = await Db.getMongoDb(this.dbUri);

        const vars = client.collection(this.collection);
        const result = await vars.deleteOne({ _id: name });
        return result.deletedCount === 1;
    }

    async reset() {
        const client = await Db.getMongoDb(this.dbUri);
        return client.dropCollection(this.collection);
    }
}
