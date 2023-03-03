require('dotenv').config()

const crash = require('./dbmodels/crash')
const mongoose = require("mongoose");


/**
 * Function to sync the unindexed documents to the index
 */
async function syncIndex() {
    mongoose.connect(process.env.MONGODB_URI, async () => {
        const stream = crash.synchronize();
        let count = 0;

        stream.on('data', function (err, doc) {
            count++;
            console.log('indexed ' + count + ' document');
        });

        stream.on('close', async function () {
            console.log('indexed ' + count + ' documents!');
            mongoose.disconnect();;
        });

        stream.on('error', function (err) {
            console.log(err);
        });

    });


}

syncIndex()

/**
 * Function to test the search function
 */
async function testSearch() {
    mongoose.connect(process.env.MONGODB_URI, async () => {
        // let result = await crash.search({
        //     "match": {
        //         "userId": "KodenameKRAK"
        //     },
        //         // "match": {
        //         //     "message": {
        //         //       "query": "this is a test"
        //         //     }
        //         //   },
        //     "range": {
        //         "uploadDate": {
        //             "gte": "now-60d/d",
        //         },
        //     }
        // })

        // Get time passed in ms
        let time = Date.now();

        let result = await crash.esSearch({

            "size": 5,
            "sort": [
                { "uploadDate": { "order": "desc", "mode": "max" } }
            ],
            query: {

                "bool": {

                    "must": [
                        // // { "match": { "userId": "KodenameKRAK" } },
                        // // { "match": { "stacktrace": "\"Liveness\" 20000" }},
                        // {
                        //     "query_string": {
                        //         "fields": [
                        //             "userId",
                        //             "stacktrace",
                        //             "mods"
                        //         ],
                        //         "query": "Liveness and Nya and 20000 userId:KodenameKRAK",
                        //         // "minimum_should_match": 2
                        //     },
                        // },
                        // {
                        //     "exists": { "field": "mods" }
                        // },

                    ],
                    // "should": [
                    //   {
                    //     "match": {
                    //       "stacktrace": "A"
                    //     }
                    //   },
                    // ],
                    // "minimum_number_should_match": 1,
                    "filter": [
                        // {
                        //     "term": { "userId": "KodenameKRAK" },
                        // }, 
                        // {
                        //     "range": { "uploadDate": { "gte": "now-180d" } }
                        // }
                    ],



                },
            }

        }, { hydrate: true })

        // Get time difference in ms
        let diff = Date.now() - time;
        console.log("Search took: " + diff + "ms");
        console.log(result);
        let hits = result.body.hits.hydrated;
        console.log(hits.length)
        hits.map(hit => {
            console.log(hit.uploadDate)
        })
        mongoose.disconnect();
    });
}

// testSearch()