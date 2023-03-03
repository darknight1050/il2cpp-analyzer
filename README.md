il2cpp-analyzer
## Deployment 

Useful commands for deploying the project to a server.

### Importing the database from file

To import the database from a file, use the following command in container `db` (to run bash in it run `docker-compose exec db bash` when the database is running), put the database in `dbinit` folder and run:

```bash
mongoimport --username=root -d analyzer -c crashes --jsonArray --authenticationDatabase admin --file=/docker-entrypoint-initdb.d/<filename>.json
```

### Reanalyze older crashes

```bash
yarn reanalyze
```

### Indexing existing documents in Elasticsearch

```bash
yarn dbindex
```
