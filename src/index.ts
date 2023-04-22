import Cmd from '@winkgroup/cmd';
import ConsoleLog, { LogLevel } from '@winkgroup/console-log';
import _ from 'lodash';
import { ChangeStream, ChangeStreamDocument, Db, Sort } from 'mongodb';
import { Connection as MongooseConnection, ObjectId, Query } from 'mongoose';
import { DataGridFilter, DataGridQuery } from './common';
import QueryCacheAbstract, {
    QueryCacheOptions,
    QueryData,
    QueryParams,
} from './queryCache';
import DbVar from './var';

export interface DbBackupOptions {
    gzip: boolean;
    collection: string;
}

export default class MongoHelper {
    private static areMongoToolsAvailable = null as boolean | null;

    static async waitForMongoDbConnected(
        mongooseConnection: MongooseConnection
    ): Promise<MongooseConnection['db']> {
        const sleep = (ms: number) =>
            new Promise<void>((resolve) => setTimeout(resolve, ms));

        while (mongooseConnection.readyState === 2) {
            await sleep(1000);
        }

        if (mongooseConnection.readyState === 1) return mongooseConnection.db;
        else throw new Error('db disconnected');
    }

    static async backup(
        dbUri: string,
        db: string,
        destinationPath: string,
        inputOptions?: DbBackupOptions
    ) {
        const options: DbBackupOptions = _.defaults(inputOptions, {
            gzip: false,
        });
        const cmd = await MongoHelper.prepareCommand('mongodump');
        if (!cmd) return cmd;
        cmd.args = [`--db="${db}"`];
        if (options.collection)
            cmd.args.push(`--collection=${options.collection}`);
        if (options.gzip) cmd.args.push('--gzip');
        cmd.args.push(`--archive=${destinationPath}`);
        cmd.args.push(dbUri);
        await cmd.run();
        return cmd.exitCode === 0;
    }

    static async fromQueryToMaterialTableData(
        query: Query<any[], any>,
        searchQuery: DataGridQuery
    ) {
        const totalCount = await _.clone(query).countDocuments();
        if (searchQuery.orderBy) {
            const sortField =
                (searchQuery.orderDirection !== 'desc' ? '' : '-') +
                searchQuery.orderBy;
            query.collation({ locale: 'en' }).sort(sortField);
        }
        const data = await query
            .skip(searchQuery.pageSize * searchQuery.page)
            .limit(searchQuery.pageSize);

        return {
            data: data,
            page: searchQuery.page,
            totalCount: totalCount,
        };
    }

    protected static async prepareCommand(
        command: string,
        consoleLog?: ConsoleLog
    ) {
        if (!consoleLog) consoleLog = new ConsoleLog({ prefix: 'MongoHelper' });
        const areMongoToolsAvailable = await this.checkMongoTools();
        if (!areMongoToolsAvailable) {
            consoleLog.error('mongo tools not present!');
            return false;
        }

        const cmd = new Cmd(command, {
            getResult: false,
            timeout: 60,
            stderrOptions: { logLevel: LogLevel.NONE },
        });
        cmd.consoleLog = consoleLog;
        return cmd;
    }

    static async checkMongoTools() {
        if (this.areMongoToolsAvailable !== null)
            return this.areMongoToolsAvailable;
        const results = await Promise.all(
            ['mongodump', 'mongorestore'].map((command) => Cmd.exists(command))
        );
        this.areMongoToolsAvailable = results[0] && results[1];
        return this.areMongoToolsAvailable;
    }
}

export interface RealtimeQueryOptions extends Partial<QueryCacheOptions> {
    db: Db | MongooseConnection['db'];
    collectionName: string;
}

export class RealtimeQuery<Doc> extends QueryCacheAbstract<Doc> {
    protected db: Db | MongooseConnection['db'];
    protected collectionName: string;

    constructor(inputOptions: RealtimeQueryOptions) {
        super('_id', inputOptions);
        this.db = inputOptions.db;
        this.collectionName = inputOptions.collectionName;
    }

    isSameId(key1: ObjectId, key2: ObjectId) {
        return key1.toString() === key2.toString();
    }

    async _find(params?: Partial<QueryParams>) {
        if (!params) params = {};
        let query = this.db
            .collection(this.collectionName)
            .find(params.queryObj ? params.queryObj : {});
        if (params.limit) query = query.limit(params.limit);
        if (params.sort) query = query.sort(params.sort as Sort);
        const result = await query.toArray();
        return result as Doc[];
    }

    async start() {
        let watch = this.db.collection(this.collectionName).watch();
        watch.on('change', (data) => this.onChange(data));
    }
}

export {
    DataGridQuery,
    DataGridFilter,
    DbVar,
    QueryCacheAbstract,
    QueryCacheOptions,
    QueryParams,
    QueryData,
};
