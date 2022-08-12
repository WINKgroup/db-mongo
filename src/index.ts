import _ from 'lodash'
import mongoose from 'mongoose'
import Env from '@winkgroup/env'
import { EventEmitter } from 'node:events'

export interface MaterialTableSearch {
    page: number
    search: string
    pageSize: number
    orderBy: {
        field: string
    },
    orderDirection: 'asc' | 'desc'
}

export default class Db extends EventEmitter {
    private static singleton: Db
    private db = mongoose
    private connectionStarted = false
    private constructor() {
        super()
    }

    private async connect() {
        try {
            this.connectionStarted = true
            const dbUri = Env.get('DB_URI')
            console.info(`Connecting ${ dbUri }...`)
            await this.db.connect( dbUri )
            console.info(`DB Connected!`)
            this.emit('connected')
        } catch (e) {
            console.error(e)
            this.emit('error', e)
        }
    }
 
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

    static get() {
        if (!this.singleton) this.singleton = new Db()
        
        return new Promise<typeof mongoose>( (resolve, reject) => {
            if (this.singleton.db.connection.readyState === 1) resolve(this.singleton.db)
            
            const onConnected = () => {
                this.singleton.removeListener('connected', onConnected)
                resolve(this.singleton.db)
            }

            this.singleton.on('connected', onConnected)
            if (!this.singleton.connectionStarted) this.singleton.connect()
        } )
    }
}