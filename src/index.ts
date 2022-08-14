import _ from 'lodash'
import mongoose from 'mongoose'
import Env from '@winkgroup/env'

export interface MaterialTableSearch {
    page: number
    search: string
    pageSize: number
    orderBy: {
        field: string
    },
    orderDirection: 'asc' | 'desc'
}

export default class Db {
    private static connections:{[key:string]: Db} = {}
    private conn:mongoose.Connection
    private constructor(dbUri:string) {
        this.conn = mongoose.createConnection(dbUri)
    }

    get() { return this.conn }

    static async fromQueryToMaterialTableData(query:mongoose.Query<any[], any>, search:MaterialTableSearch) {
        const totalCount = await _.clone(query).countDocuments()
        if (search.orderBy) {
            const sortField = (search.orderDirection !== 'desc' ? '' : '-') + search.orderBy.field
            query.sort( sortField )
        }
        const data = await query.skip(search.pageSize * search.page).limit(search.pageSize)

        return {
            data: data,
            page: search.page,
            totalCount: totalCount
        }
    }

    static get(dbUri?:string) {
        if (!dbUri) dbUri = Env.get('DB_URI')
        if (!this.connections[dbUri]) this.connections[dbUri] = new Db(dbUri)
        
        return this.connections[dbUri].conn
    }
}