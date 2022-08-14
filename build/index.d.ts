import mongoose from 'mongoose';
import { DataGridQuery } from './commons';
export default class Db {
    private static connections;
    private conn;
    private constructor();
    get(): mongoose.Connection;
    static fromQueryToMaterialTableData(query: mongoose.Query<any[], any>, searchQuery: DataGridQuery): Promise<{
        data: any[];
        page: number;
        totalCount: number;
    }>;
    static get(dbUri?: string): mongoose.Connection;
}
