# edm-stats
Record stats about kafka messages.

## Setup

```
git clone git@github.com:trevorscott/edm-stats.git && cd edm-stats
heroku create $appname
heroku addons:attach <your kafka broker name>
heroku kafka:consumer-groups:create consumer-group-2
heroku config:set KAFKA_CONSUMER_GROUP=consumer-group-2
```

## local setup

In order to install `node-rdkafka` you must set a few local enviornment variables:

```
export CPPFLAGS=-I/usr/local/opt/openssl/include
export LDFLAGS=-L/usr/local/opt/openssl/lib
```

Now you can npm install:
```
npm install
```

You will want to create a consumer group for this app:
```
heroku kafka:consumer-groups:create consumer-group-2-local
export KAFKA_CONSUMER_GROUP=consumer-group-2-local
```

You will need information from your heroku kafka cluster. Run `heroku config` to obtain that information and set the following information:

```
export KAFKA_PREFIX=<your kafka prefix>
export KAFKA_URL=<your broker urls> \
export KAFKA_TOPIC='topic1,topic2'
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

```
npm start
```

