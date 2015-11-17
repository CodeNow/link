# Link

![link](http://vignette2.wikia.nocookie.net/zelda/images/2/27/Link_(Phantom_Hourglass).png/revision/latest?cb=20110907113445)

Link handles the events used to update the database for Navi to use. Finally link gets to slay that data and give it to
navi in easy to eat bite size chunks.

## To Run
Link requires node 4.2.1

1. npm install
2. npm start

## Purpose

The purpose of Link is to handle anytime an instance is created, updated or deleted and populate a record in MongoDB
that contains all the information that Navi needs to do it's job. All this data is stored in such a way that Navi should
at most need to make two calls to Mongo to get everything it needs. This is vitaly important since we want to limit
the amount of time navi spends doing it's job, and io historically has been the bottleneck.

## Implementation

Link is built against 3 worker queues at the moment:
  * instance.updated
  * instance.created
  * instance.deleted

When an instance is created or updated we first make a call to the API server to fetch the instance dependencies using
runnable-api-client. We will then upsert a denormalized version of the instance + dependencies into mongo.
  
Upon deletion we will update the record to no longer contain the instance, and if there are no more instances left we will
destroy the record completely.

## A typical mongo object

```JSON
{
  "_id": "564a6f486095bf55310e2896",
  "elasticUrl": "api-staging-runnabletest20.runnablecloud.com",
  "directUrls": {
    "26wgl1": {
      "branch": "master",
      "url": "26wgl1-api-staging-runnabletest20.runnablecloud.com",
      "dependencies": [],
      "dockerHost": null,
      "running": false,
      "lastUpdated": "2015-11-17T00:08:10.855Z",
      "masterPod": true
    }
  },
  "ownerGithubId": 14130763,
  "__v": 0
}
```
