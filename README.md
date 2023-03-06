il2cpp-analyzer


## Elastic search index overview

We are using string_query as a base, to learn more about the syntax, see:
https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html

List of fields that are indexed in Elasticsearch search query:
- stacktrace
- mods.name
- mods.version
- mods.*
- log

Possible operators (have to be written in uppercase):
- AND
- OR
- NOT

### Query examples

Simple query (will search for exact match in all fields):
```bash
"neko para"
```

Query by mod name:
```bash
mods.name: "Mod name"
```

Query by mod version (without the v):
```bash
mods.version: "1.0.0"
```

Query by mod name and version:
```
mods.name: "Mod name" AND mods.version: "1.0.0"
```

Query all the crashes with mods list and logs uploaded:
```
_exists_: mods AND _exists_: log
```

Query all the crashes with mods list and a phrase in log
```
_exists_: mods AND log: "neko para"
```

Query all the crashes with mods list and a phrase in log, but not in stacktrace
```
_exists_: mods AND log: "neko para" AND NOT stacktrace: "neko para"
```

Query to include multiple mods and exclude one:
```
mods.name: Mod1 AND mods.name: Nya AND NOT mods.name: Qosmetics
```


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
