/// <reference types="node" />
import mongoose from 'mongoose';
import { EventEmitter } from 'node:events';
export interface MaterialTableSearch {
    page: number;
    search: string;
    pageSize: number;
    orderBy: {
        field: string;
    };
    orderDirection: 'asc' | 'desc';
}
export default class Db extends EventEmitter {
    private static singleton;
    private db;
    private connectionStarted;
    private constructor();
    private connect;
    static fromQueryToMaterialTableData(query: mongoose.Query<any[], any>, search: MaterialTableSearch): Promise<{
        data: any[];
        page: number;
        totalCount: number;
    }>;
    static get(): Promise<typeof mongoose>;
}
