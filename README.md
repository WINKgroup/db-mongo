# db-mongo
Singleton class to manage Mongo DB connection through mongoose
It requires to have an .env file with DB_URL entry

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

## contributors
to create the `build` directory: