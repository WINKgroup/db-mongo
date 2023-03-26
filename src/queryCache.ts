import Cron from '@winkgroup/cron';
import _ from 'lodash';
import hash from 'object-hash';
import { ChangeStreamDocument } from 'mongodb';
import { v1 as uuid } from 'uuid';

export interface QueryParams {
    queryObj: object;
    limit: number;
    skip: number;
    sort?: object;
}

export interface ChangeQueryDocumentList<Doc> {
    operationType: 'update' | 'insert' | 'delete' | 'multiple'
    position: number
    doc?: Doc
}

export type QueryCallback<Doc> = (list: Doc[], changeDoc: ChangeStreamDocument, changeList: ChangeQueryDocumentList<Doc>) => void

export interface QuerySubscriber<Doc> {
    id: string;
    callback: QueryCallback<Doc>;
}

export interface QueryData<Doc> {
    params: QueryParams;
    list: Doc[];
    debouncer?: Cron;
    subscribers: QuerySubscriber<Doc>[];
}

export interface QueryCacheOptions {
    debounceSeconds: number;
}

export default abstract class QueryCacheAbstract<Doc> {
    protected queries = {} as { [queryHash: string]: QueryData<Doc> };
    debounceSeconds: number;
    idName: string;

    constructor(idName: string, inputOptions?: Partial<QueryCacheOptions>) {
        const options = _.defaults(inputOptions, {
            debounceSeconds: 0,
        });
        this.debounceSeconds = options.debounceSeconds;
        this.idName = idName;
    }

    abstract _find(params: QueryParams): Promise<Doc[]>;
    abstract isSameId(id1: any, id2: any): boolean;

    getId(doc: Doc) {
        //@ts-ignore
        return doc[this.idName];
    }

    protected haveSameKey(doc1: Doc, doc2: Doc) {
        return this.isSameId(this.getId(doc1), this.getId(doc2));
    }

    getList(queryHash: string) {
        return this.queries[queryHash].list;
    }

    subscribe(params: QueryParams, callback: QueryCallback<Doc>) {
        const hashed = QueryCacheAbstract.hash(params);
        if (!this.queries[hashed]) {
            this.queries[hashed] = {
                params: params,
                list: [],
                debouncer:
                    this.debounceSeconds > 0
                        ? new Cron(this.debounceSeconds)
                        : undefined,
                subscribers: [],
            };

            this._find(params).then(
                (list) => (this.queries[hashed].list = list)
            );
        }

        const id = uuid();
        this.queries[hashed].subscribers.push({
            id: id,
            callback: callback,
        });

        return id;
    }

    find(hashedQuery: string) {
        if (!this.queries[hashedQuery]) return null;
        return this.queries[hashedQuery].list;
    }

    unsubscribe(subscriberId: string) {
        for (const hash of Object.keys(this.queries)) {
            let found = false;
            for (let i = 0; i < this.queries[hash].subscribers.length; i++) {
                const subscriber = this.queries[hash].subscribers[i];
                if (subscriber.id === subscriberId) {
                    delete this.queries[hash].subscribers[i];
                    if (this.queries[hash].subscribers.length === 0)
                        delete this.queries[hash];
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
    }

    onChange(changeDoc: ChangeStreamDocument) {
        const queryHashes = Object.keys(this.queries);
        let changeList = null as ChangeQueryDocumentList<Doc> | null

        queryHashes.map(async (queryHash) => {
            const query = this.queries[queryHash];

            if (
                changeDoc.operationType === 'update' &&
                changeDoc.fullDocument
            ) {
                const fullDocument = changeDoc.fullDocument;
                for (let pos = 0; pos < query.list.length; pos++) {
                    const doc = query.list[pos];
                    const changeFullDocument = fullDocument as Doc;
                    if (this.haveSameKey(changeFullDocument, doc)) {
                        query.list[pos] = changeFullDocument;

                        changeList = {
                            operationType: 'update',
                            doc: changeFullDocument,
                            position: pos
                        }

                        break;
                    }
                }
            } else {
                const newList = await this._find(query.params);
                const maxLength = Math.max(newList.length, query.list.length)
                for (let pos = 0; pos < maxLength; pos++) {
                    switch (changeDoc.operationType) {
                        case 'update':
                            if (this.isSameId(this.getId(newList[pos]), changeDoc.documentKey._id)) {
                                changeList = {
                                    operationType: 'update',
                                    doc: newList[pos],
                                    position: pos
                                }
                            }
                            break
                        default:
                            if (pos >= query.list.length || pos >= newList.length || !this.haveSameKey(query.list[pos], newList[pos])) {
                                if (changeDoc.operationType === 'delete') {
                                    changeList = {
                                        operationType: 'delete',
                                        position: pos
                                    }
                                } else {
                                    changeList = {
                                        operationType: changeDoc.operationType as 'insert' | 'delete',
                                        doc: newList[pos],
                                        position: pos
                                    }
                                }
                            }
                            break
                    }

                    if (changeList) break
                }

                query.list = newList;
            }

            if (changeList) {
                const requiredChangeList = changeList
                if (!query.debouncer || !query.debouncer.debounce()) {
                    query.subscribers.map((subscriber) =>
                        subscriber.callback(query.list, changeDoc, requiredChangeList)
                    );
                }
            }
        });
    }

    static hash(data: QueryParams) {
        return hash(data);
    }
}
