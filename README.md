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

## contributing and tests
If you are activly developing this package and you want to run tests you will need to create a `.env` file with this line:
```
DB_URI={ your db connection }
```