# il2cpp-analyzer

## Search index overview

We are using string_query as a base, to learn more about the syntax, see:
https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html

*We index only header and backtrace fields, because they are the most important ones. The rest of the fields are not important enough to be indexed, but they are still searchable.*

List of fields that are indexed in Elasticsearch search query:
- backtrace
- header
- mods.name
- mods.version
- log

Possible operators (have to be written in uppercase):
- AND
- OR
- NOT




### Query examples

Search for crashes with your build id:
```bash
backtrace: b86ed6d1d47ebf4a2a19bd477781232a2d32a7dd
```

Search for crashes with your build id and a phrase in log:
```bash
backtrace: b86ed6d1d47ebf4a2a19bd477781232a2d32a7dd AND log: "neko para"
```


Simple query (will search for inexact match in all fields):
```bash
neko para
```


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

### What we index

Header example:
```
Version '2019.4.28f1 (1381962e9d08)', Build type 'Release', Scripting Backend 'il2cpp', CPU 'arm64-v8a'
Build fingerprint: 'oculus/hollywood/hollywood:10/QQ3A.200805.001/49882890235800150:user/release-keys'
Revision: '0'
ABI: 'arm64'
Timestamp: 2023-03-02 07:03:16-0500
pid: 19260, tid: 19323, name: UnityMain  >>> com.beatgames.beatsaber <<<
uid: 10161
signal 11 (SIGSEGV), code 1 (SEGV_MAPERR), fault addr 0x8
Cause: null pointer dereference
```

Backtrace example:
```
#00 pc 000000000004ba98  /data/data/com.beatgames.beatsaber/files/libcustom-types.so (Hook_LivenessState_TraverseGCDescriptor::hook_LivenessState_TraverseGCDescriptor(Il2CppObject*, void*)+996) (BuildId: b86ed6d1d47ebf4a2a19bd477781232a2d32a7dd)                               
                                           
#01 pc 0000000000050708  /data/data/com.beatgames.beatsaber/files/libcustom-types.so (Hooking::HookCatchWrapper<&(Hook_LivenessState_TraverseGCDescriptor::hook_LivenessState_TraverseGCDescriptor(Il2CppObject*, void*)), void (*)(Il2CppObject*, void*)>::wrapper(Il2CppObject*, void*)+16) (BuildId: b86ed6d1d47ebf4a2a19bd477781232a2d32a7dd)
#02 pc 00000000000503a0  /data/data/com.beatgames.beatsaber/files/libcustom-types.so (Hooking::HookCatchWrapper<&(Hook_LivenessState_TraverseGenericObject::hook_LivenessState_TraverseGenericObject(Il2CppObject*, void*)), void (*)(Il2CppObject*, void*)>::wrapper(Il2CppObject*, void*)+48) (BuildId: b86ed6d1d47ebf4a2a19bd477781232a2d32a7dd)
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

### Import data
Put the data in `docker/dbinit` folder and run:
(analyzer.crashes.json is the file with the data)
```bash
mongoimport --uri "mongodb://root:root@127.0.0.1:27027/analyzer?ssl=false&authSource=admin" --collection crashes --type json --file /docker-entrypoint-initdb.d/analyzer.crashes.json 
```