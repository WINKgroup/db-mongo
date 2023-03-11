import Cron from '@winkgroup/cron';
import _ from 'lodash';
import { ChangeStreamDocument } from 'mongodb';
import hash from 'object-hash';

export interface DataGridFilter {
    column: string;
    operator: string;
    value: any;
}

export interface DataGridQuery {
    filters: DataGridFilter[];
    page: number;
    pageSize: number;
    search?: string;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
}

export interface RealtimeQueryData {
    dbUri: string;
    collection: string;
    query?: object;
}
