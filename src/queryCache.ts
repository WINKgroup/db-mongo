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

export interface QuerySubscriber<Doc> {
    id: string;
    callback: (list: Doc[], changeDoc: ChangeStreamDocument) => void;
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

    subscribe(params: QueryParams, callback: (list: Doc[]) => void) {
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

        queryHashes.map(async (queryHash) => {
            const query = this.queries[queryHash];
            let notifyEventually = false;

            if (
                changeDoc.operationType === 'update' &&
                changeDoc.fullDocument
            ) {
                const fullDocument = changeDoc.fullDocument;
                for (const pos in query.list) {
                    const doc = query.list[pos];
                    const changeFullDocument = fullDocument as Doc;
                    if (this.haveSameKey(changeFullDocument, doc)) {
                        query.list[pos] = changeFullDocument;
                        notifyEventually = true;
                        break;
                    }
                }
            } else {
                const newList = await this._find(query.params);
                notifyEventually = true;
                if (
                    newList.length === query.list.length &&
                    ['insert', 'delete'].indexOf(changeDoc.operationType) !== -1
                ) {
                    notifyEventually = false;
                    for (const pos in query.list) {
                        if (!this.haveSameKey(query.list[pos], newList[pos])) {
                            notifyEventually = true;
                            break;
                        }
                    }
                }
                query.list = newList;
            }

            if (notifyEventually) {
                if (!query.debouncer || !query.debouncer.debounce()) {
                    query.subscribers.map((subscriber) =>
                        subscriber.callback(query.list, changeDoc)
                    );
                }
            }
        });
    }

    static hash(data: QueryParams) {
        return hash(data);
    }
}
