import _ from 'lodash'
import mongoose from 'mongoose'
import { Db as MongoDb } from 'mongodb'
import { DataGridQuery } from './common'

export default class Db {
    private static connections:{[key:string]: Db} = {}
    private conn:mongoose.Connection
    private constructor(dbUri:string) {
        this.conn = mongoose.createConnection(dbUri)
    }

    get() { return this.conn }

    async getMongoDb() {
        const sleep = (ms:number) => new Promise<void>(resolve => setTimeout(resolve, ms))
        while(this.conn.readyState === 2) {
            await sleep(1000)
        }
        if (this.conn.readyState === 1) return this.conn.db
            else throw new Error('db disconnected')
    }

    static async fromQueryToMaterialTableData(query:mongoose.Query<any[], any>, searchQuery:DataGridQuery) {
        const totalCount = await _.clone(query).countDocuments()
        if (searchQuery.orderBy) {
            const sortField = (searchQuery.orderDirection !== 'desc' ? '' : '-') + searchQuery.orderBy
            query.collation({locale: "en"}).sort( sortField )
        }
        const data = await query.skip(searchQuery.pageSize * searchQuery.page).limit(searchQuery.pageSize)

        return {
            data: data,
            page: searchQuery.page,
            totalCount: totalCount
        }
    }

    static get(dbUri:string) {
        if (!this.connections[dbUri]) this.connections[dbUri] = new Db(dbUri)
        
        return this.connections[dbUri].conn
    }

    static getObj(dbUri:string) {
        if (!this.connections[dbUri]) this.connections[dbUri] = new Db(dbUri)

        return this.connections[dbUri]
    }

    static getMongoDb(dbUri:string) {
        const DbObj = this.getObj(dbUri)
        return DbObj.getMongoDb()
    }
}