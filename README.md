# edm-stats
Record stats about kafka messages to postgres.

This app is part of a group of apps that all must be deployed in a particular order:

1. [edm-relay](https://github.com/trevorscott/edm-relay)
1. [edm-stream](https://github.com/trevorscott/edm-stream)
1. [edm-stats](https://github.com/trevorscott/edm-stats)
1. [edm-ui](https://github.com/trevorscott/edm-ui)
1. [edm-dashboard](https://github.com/trevorscott/edm-dashboard)

## Setup

```
git clone git@github.com:trevorscott/edm-stats.git && cd edm-stats
heroku create $appname
heroku addons:attach <your kafka broker name>
heroku addons:create heroku-postgresql:hobby-dev
```

## Initialize the database

```
heroku pg:psql -f data.sql
```

## local setup

In order to install `node-rdkafka` you must set a few local enviornment variables:

```bash
export CPPFLAGS=-I/usr/local/opt/openssl/include
export LDFLAGS=-L/usr/local/opt/openssl/lib
```

Now you can npm install:
```
npm install
```

Set the consumer group:

```bash
export KAFKA_CONSUMER_GROUP=edm-consumer-group-2-local
```

You will need information from your heroku kafka cluster. Run `heroku config` to obtain that information and set the following information:

```bash
export KAFKA_PREFIX=<your kafka prefix>
export KAFKA_URL=<your broker urls> \
export KAFKA_TOPIC='edm-ui-click,edm-ui-pageload'
export KAFKA_TRUSTED_CERT="multi
line 
cert"
export KAFKA_CLIENT_CERT="multi
line
cert"
export KAFKA_CLIENT_CERT_KEY="multi
line
cert
"
```

Run the .profile script to write ssl config to files:

```
./.profile
```

### Postgres Setup

You will need to create a PostgreSQL database for you local dev purposes.

e.g.

```
psql
username=# create database edm_test;
CREATE DATABASE
username=# \q
```

Then set the DATABASE_URL

```bash 
export DATABASE_URL=postgresql://username@localhost/edm_db
```

Once you have created your database locally run the `data.sql` file with `psql`:

```bash
psql -U username -d edm_test -f data.sql
```

### Run Locally

```
npm start
```

## Custom Kafka Topic Names

If you deviated from the default kafka topic names for this demo you will need to set some extra config:

Production:

```bash
heroku config:set CLICK_KAFKA_TOPIC=<custom-clicks-kafka-topic-name>
heroku config:set PAGE_LOAD_KAFKA_TOPIC=<custom-pageload-kafka-topic-name>
```

local:

```bash
export CLICK_KAFKA_TOPIC=<custom-clicks-kafka-topic-name-local>
export PAGE_LOAD_KAFKA_TOPIC=<custom-pageload-kafka-topic-name-local>
```

