require('dotenv').config();
const Kafka      = require('node-rdkafka');
const express    = require('express');
const app        = express();
const URL        = require('url');
const fs         = require('fs');
const { Pool, Client } = require('pg');
const parseDbUrl       = require('parse-database-url');

const PORT       = process.env.PORT || 5002;
const nodeEnv    = process.env.NODE_ENV || 'development';
const sslFlag = (nodeEnv == "development") ? false : true;


const currentPath  = process.cwd();

if (!process.env.KAFKA_PREFIX)          throw new Error('KAFKA_PREFIX is not set.')
if (!process.env.KAFKA_URL)             throw new Error('KAFKA_URL is not set.')
if (!process.env.KAFKA_CONSUMER_GROUP)  throw new Error('KAFKA_TOPIC is not set.')
if (!process.env.KAFKA_TRUSTED_CERT)    throw new Error('KAFKA_TRUSTED_CERT is not set.')
if (!process.env.KAFKA_CLIENT_CERT)     throw new Error('KAFKA_CLIENT_CERT is not set.')
if (!process.env.KAFKA_CLIENT_CERT_KEY) throw new Error('KAFKA_CLIENT_CERT_KEY is not set.')

if (!fs.existsSync('tmp/env/KAFKA_TRUSTED_CERT')) {
	throw new Error('KAFKA_TRUSTED_CERT has not been written to file. Try executing the .profile script.');
}
if (!fs.existsSync('tmp/env/KAFKA_CLIENT_CERT')) {
	throw new Error('KAFKA_CLIENT_CERT has not been written to file. Try executing the .profile script.');
}
if (!fs.existsSync('tmp/env/KAFKA_CLIENT_CERT_KEY')) {
	throw new Error('KAFKA_CLIENT_CERT_KEY has not been written to file. Try executing the .profile script.');
}

//Postgres Config
const dbConfig = parseDbUrl(process.env["DATABASE_URL"]);

// Connect to postgres
const pool = new Pool({
  user: dbConfig.user,
  host: dbConfig.host,
  database: dbConfig.database,
  password: dbConfig.password,
  port: dbConfig.port,
  ssl: sslFlag
})

// Kafka Config
// For multi-tenant kafka on heroku, we must prefix each topic
const kafkaTopicsString=process.env.KAFKA_TOPIC;
let kafkaTopics = kafkaTopicsString.split(",");
kafkaTopics = kafkaTopics.map((topic)=>{
  return `${process.env.KAFKA_PREFIX}${topic}`
});

// split up the comma separated list of broker urls into an array
const kafkaBrokerUrls = process.env.KAFKA_URL;
let brokerHostnames = kafkaBrokerUrls.split(",").map((u)=>{
  return URL.parse(u).host;
});

// throw an error if we don't connect to the broker in 5 seconds
// causes the heroku app to crash and retry
const connectTimeout = 5000;
const connectTimoutId = setTimeout(() => {
      const message = `Failed to connect Kafka consumer (${connectTimeout}-ms timeout)`;
      const e = new Error(message);
      throw e;
    }, connectTimeout)

//
// Kafka Consumer 
//
var consumer = new Kafka.KafkaConsumer({
  // 'debug': 'all',
  'client.id':                `edm/${process.env.DYNO || 'localhost'}`,
  'group.id': `${process.env.KAFKA_PREFIX}${process.env.KAFKA_CONSUMER_GROUP}`,
  'metadata.broker.list': brokerHostnames.toString(),
  'security.protocol': 'SSL',
  'ssl.ca.location':          "tmp/env/KAFKA_TRUSTED_CERT",
  'ssl.certificate.location': "tmp/env/KAFKA_CLIENT_CERT",
  'ssl.key.location':         "tmp/env/KAFKA_CLIENT_CERT_KEY",
  'enable.auto.commit': false,
  'offset_commit_cb': function(err, topicPartitions) {
    if (err) {
      // There was an error committing
      console.error("There was an error committing");
      console.error(err);
    } else {
      // Commit went through. Let's log the topic partitions
      console.log("New offset successfully committed.")
    }
  }
}, {});

consumer.connect({}, (err, data) => {
  if(err) {
    console.error(`Consumer connection failed: ${err}`);
  }else {
    console.log(`Connection to kafka broker successful: ${JSON.stringify(data)}`)
  }
});

consumer
  .on('ready', (id, metadata) => {
    console.log(kafkaTopics);
    consumer.subscribe(kafkaTopics); 
    consumer.consume();
    consumer.on('error', err => {
      console.log(`!      Error in Kafka consumer: ${err.stack}`);
    });
    console.log('Kafka consumer ready.' + JSON.stringify(metadata));
    clearTimeout(connectTimoutId);
  })
  .on('data', function(data) {
    const message = data.value.toString()
    const json = JSON.parse(message);
    //track stats here
    // 1. how many times has the page been loaded?
    // 1. how many times has a button been clicked?
    // 1. what are the most popular buttons?
    switch (json.topic) {
    	case 'edm-ui-click':
			const clickEventSql = 'INSERT INTO button_click(uuid,button_id,created_date) VALUES($1, $2, to_timestamp($3 / 1000.0))';
			const clickEventValues = [json.uuid,json.properties.button_id,json.event_timestamp];
			pool.query(clickEventSql, clickEventValues)
    		  .then(pgResponse => {
			    console.log("button click event inserted");
			    consumer.commitMessage(data);
			  })
			  .catch(error =>{
			    console.error(error.stack);
			  });
			  break;
		case 'edm-ui-pageload':
			const loadEventSql = 'INSERT INTO page_load(uuid,user_agent,created_date) VALUES($1, $2, to_timestamp($3 / 1000.0))';
			const loadEventValues = [json.uuid,json.properties.user_agent,json.event_timestamp];
			pool.query(loadEventSql, loadEventValues)
			  .then(pgResponse => {
			    consumer.commitMessage(data);
			  })
			  .catch(error =>{
			    console.error(error.stack)
			  }); 
			  break;
    }
  })
  .on('event.log', function(log) {
    console.log(log);
  })
  .on('event.error', function(err) {
    console.error('Error from consumer');
    console.error(err);
  });


//
// Server
//

app.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
});


