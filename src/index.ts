import Cmd from '@winkgroup/cmd';
import ConsoleLog, { LogLevel } from '@winkgroup/console-log';
import _ from 'lodash';
import { ChangeStream, ChangeStreamDocument, Sort } from 'mongodb';
import mongoose, { ObjectId } from 'mongoose';
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

export default class Db {
    private dbUri: string;
    private static connections: { [key: string]: Db } = {};
    private static areMongoToolsAvailable = null as boolean | null;
    private conn: mongoose.Connection;
    private constructor(dbUri: string) {
        this.conn = mongoose.createConnection(dbUri);
        this.dbUri = dbUri;
    }

    get() {
        return this.conn;
    }

    async getMongoDb() {
        const sleep = (ms: number) =>
            new Promise<void>((resolve) => setTimeout(resolve, ms));
        while (this.conn.readyState === 2) {
            await sleep(1000);
        }
        // @ts-ignore: line
        if (this.conn.readyState === 1) return this.conn.db;
        else throw new Error('db disconnected');
    }

    async backup(
        db: string,
        destinationPath: string,
        inputOptions?: DbBackupOptions
    ) {
        const options: DbBackupOptions = _.defaults(inputOptions, {
            gzip: false,
        });
        const cmd = await Db.prepareCommand('mongodump');
        if (!cmd) return cmd;
        cmd.args = [`--db="${db}"`];
        if (options.collection)
            cmd.args.push(`--collection=${options.collection}`);
        if (options.gzip) cmd.args.push('--gzip');
        cmd.args.push(`--archive=${destinationPath}`);
        cmd.args.push(this.dbUri);
        await cmd.run();
        return cmd.exitCode === 0;
    }

    static async fromQueryToMaterialTableData(
        query: mongoose.Query<any[], any>,
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

    static get(dbUri: string) {
        if (!this.connections[dbUri]) this.connections[dbUri] = new Db(dbUri);

        return this.connections[dbUri].conn;
    }

    static getObj(dbUri: string) {
        if (!this.connections[dbUri]) this.connections[dbUri] = new Db(dbUri);

        return this.connections[dbUri];
    }

    static getMongoDb(dbUri: string) {
        const DbObj = this.getObj(dbUri);
        return DbObj.getMongoDb();
    }

    static getConsoleLog() {
        return new ConsoleLog({ prefix: 'Db' });
    }

    protected static async prepareCommand(command: string) {
        const consoleLog = this.getConsoleLog();
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
    dbUri: string;
    collectionName: string;
}

export class RealtimeQuery<Doc> extends QueryCacheAbstract<Doc> {
    private dbUri: string;
    private collectionName: string;

    constructor(inputOptions: RealtimeQueryOptions) {
        super('_id', inputOptions);
        this.dbUri = inputOptions.dbUri;
        this.collectionName = inputOptions.collectionName;
    }

    isSameId(key1: ObjectId, key2: any) {
        return key1.toString() === key2.toString();
    }

    async _find(params: QueryParams) {
        const conn = await Db.getMongoDb(this.dbUri);
        let query = conn
            .collection(this.collectionName)
            .find(params.queryObj)
            .limit(params.limit)
            .skip(params.skip);
        if (params.sort) query = query.sort(params.sort as Sort);
        const result = await query.toArray();
        return result as Doc[];
    }

    async start() {
        let watch: ChangeStream<any, ChangeStreamDocument<any>>;

        const conn = await Db.getMongoDb(this.dbUri);
        watch = conn.collection(this.collectionName).watch();
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
