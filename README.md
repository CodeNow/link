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
  "_id": "5646698d6095bf55310e2863",
  "elasticUrl": "test-ws-server-staging-anandkumarpatel.runnablecloud.com",
  "directUrls": {
    "erwoj2": {
      "branch": "change-it",
      "url": "erwoj2-test-ws-server-staging-anandkumarpatel.runnablecloud.com",
      "dependencies": [
        {
          "elasticUrl": "mongodb-staging-runnabledemo.runnablecloud.com",
          "shortHash": "2gxk81" 
        },{
          "elasticUrl": "helloworld-staging-runnabledemo.runnablecloud.com",
          "shortHash": "1jndz2"
        }
      ],
      "dockerHost": "10.20.219.250",
      "ports": {
        "80": "32809",
        "3000": "32808",
        "8000": "32806",
        "8080": "32807"
      },
      "running": true,
      "lastUpdated": "2015-11-13T23:10:16.142Z",
      "masterPod": false
    },
    "ew0kl1": {
      "branch": "master",
      "url": "ew0kl1-test-ws-server-staging-anandkumarpatel.runnablecloud.com",
      "dependencies": [
        {
          "elasticUrl": "mongodb-staging-runnabledemo.runnablecloud.com",
          "shortHash": "2gxk81" 
        },{
          "elasticUrl": "helloworld-staging-runnabledemo.runnablecloud.com",
          "shortHash": "1jndz2"
        }
      ],
      "dockerHost": "10.20.209.167",
      "ports": {
        "80": "33102",
        "3000": "33101",
        "8000": "33103",
        "8080": "33104"
      },
      "running": true,
      "lastUpdated": "2015-11-17T00:03:27.708Z",
      "masterPod": true
    }
  },
  "ownerGithubId": 2194285,
  "userMappings": {
    "2194285": "ew0kl1"
  }
}
```
