import mongoose from 'mongoose';
export interface MaterialTableSearch {
    page: number;
    search: string;
    pageSize: number;
    orderBy: {
        field: string;
    };
    orderDirection: 'asc' | 'desc';
}
export default class Db {
    private static connections;
    private conn;
    private constructor();
    get(): mongoose.Connection;
    static fromQueryToMaterialTableData(query: mongoose.Query<any[], any>, search: MaterialTableSearch): Promise<{
        data: any[];
        page: number;
        totalCount: number;
    }>;
    static get(dbUri?: string): mongoose.Connection;
}
