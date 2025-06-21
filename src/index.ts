import Cmd from '@winkgroup/cmd';
import ConsoleLog, { ConsoleLogLevel } from '@winkgroup/console-log';
import _ from 'lodash';
import { Db } from 'mongodb';
import mongoose, { Connection as MongooseConnection, ObjectId } from 'mongoose';
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
        mongooseConnection: MongooseConnection,
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
        inputOptions?: DbBackupOptions,
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

    protected static async prepareCommand(
        command: string,
        consoleLog?: ConsoleLog,
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
            stderrOptions: { logLevel: ConsoleLogLevel.NONE },
        });
        cmd.consoleLog = consoleLog;
        return cmd;
    }

    static async checkMongoTools() {
        if (this.areMongoToolsAvailable !== null)
            return this.areMongoToolsAvailable;
        const results = await Promise.all(
            ['mongodump', 'mongorestore'].map((command) => Cmd.exists(command)),
        );
        this.areMongoToolsAvailable = results[0] && results[1];
        return this.areMongoToolsAvailable;
    }

    static createRobustConnection(uri: string, name: string = 'MongoDB') {
        const conn = mongoose.createConnection(uri, {
            // Connection options for better reliability and long standby periods
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 30000, // 30 seconds to detect server unavailability
            socketTimeoutMS: 0, // No timeout - let operations run indefinitely
            connectTimeoutMS: 30000, // 30 seconds to establish initial connection
            heartbeatFrequencyMS: 10000, // Check server health every 10 seconds
            maxIdleTimeMS: 0, // Don't close idle connections
            minPoolSize: 1, // Keep at least 1 connection alive
        });

        // Track connection state for better management
        let isConnected = false;
        let reconnectAttempts = 0;
        let lastErrorTime = 0;

        // Enhanced error handling and auto-reconnection
        conn.on('error', (error) => {
            const now = Date.now();

            // Avoid spam logging - only log if it's been more than 30 seconds since last error
            if (now - lastErrorTime > 30000) {
                console.error(`${name} connection error:`, error.message);
                lastErrorTime = now;
            }

            // Reset connection state
            isConnected = false;

            // If it's a network error, we don't need to panic - the retry mechanism will handle it
            if (
                error.message.includes('ECONNREFUSED') ||
                error.message.includes('ETIMEDOUT') ||
                error.message.includes('ENOTFOUND')
            ) {
                // These are expected during standby - don't crash
                return;
            }

            // For unexpected errors, log more details
            console.error(`${name} unexpected error details:`, {
                name: error.name,
                code: (error as any).code,
                syscall: (error as any).syscall,
            });
        });

        conn.on('disconnected', () => {
            if (isConnected) {
                console.warn(
                    `${name} disconnected. MongoDB will automatically attempt to reconnect...`,
                );
                isConnected = false;
                reconnectAttempts = 0;
            }
        });

        conn.on('reconnected', () => {
            console.info(
                `${name} reconnected successfully after ${reconnectAttempts} attempts`,
            );
            isConnected = true;
            reconnectAttempts = 0;
            lastErrorTime = 0;
        });

        conn.on('connected', () => {
            console.info(`${name} connected successfully`);
            isConnected = true;
            reconnectAttempts = 0;
            lastErrorTime = 0;
        });

        conn.on('connecting', () => {
            reconnectAttempts++;
            if (reconnectAttempts > 1) {
                console.debug(
                    `${name} attempting to reconnect (attempt ${reconnectAttempts})...`,
                );
            }
        });

        conn.on('close', () => {
            if (isConnected) {
                console.warn(`${name} connection closed`);
                isConnected = false;
            }
        });

        return conn;
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
        let query = this.db!.collection(this.collectionName).find(
            params.queryObj ? params.queryObj : {},
        );
        if (params.limit) query = query.limit(params.limit);
        if (params.sort) query = query.sort(params.sort as any);
        const result = await query.toArray();
        return result as Doc[];
    }

    async start() {
        let watch = this.db!.collection(this.collectionName).watch();
        watch.on('change', (data) => this.onChange(data));
    }
}

export { DbVar, QueryCacheAbstract, QueryCacheOptions, QueryData, QueryParams };

