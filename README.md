# edm-stats
Record stats about kafka messages.

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

You will need information from your heroku kafka cluster. Run `heroku config` to obtain that information and set the following information:

```
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

```
npm start
```

