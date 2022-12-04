import mongoose from 'mongoose';
import { Db as MongoDb } from 'mongodb';
import { DataGridQuery } from './common';
export default class Db {
    private static connections;
    private conn;
    private constructor();
    get(): mongoose.Connection;
    getMongoDb(): Promise<MongoDb>;
    static fromQueryToMaterialTableData(query: mongoose.Query<any[], any>, searchQuery: DataGridQuery): Promise<{
        data: any[];
        page: number;
        totalCount: number;
    }>;
    static get(dbUri: string): mongoose.Connection;
    static getObj(dbUri: string): Db;
    static getMongoDb(dbUri: string): Promise<MongoDb>;
}
