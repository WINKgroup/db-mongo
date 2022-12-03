# db-mongo
Class to manage multiple mongoose instances

## usage

to get a connection (if already there is a connection it will be reused):
```
import Db from 'db-mongo'

async function foo() {
    ...
    const db = await Db.get() // db is the mongoose object
    ...
}

```

## API
### `Db.get([dbUri])`
If any string is passed for the first time, then a new connection is created.
If no string is passed it will be required to have set `.env` with DB_URI config line according to [@winkgroup/env](https://www.npmjs.com/package/@winkgroup/env) package


## contributing and tests
If you are activly developing this package and you want to run tests you will need to move `tests/config.template.json` file to `tests/config.json` and set the values.
