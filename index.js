require('dotenv').config();
const Kafka      = require('node-rdkafka');
const express    = require('express');
const URL        = require('url');
const fs         = require('fs');
const { Pool, Client } = require('pg');
const format = require('pg-format');
const parseDbUrl       = require('parse-database-url');

const PORT       = process.env.PORT || 5002;
const nodeEnv    = process.env.NODE_ENV || 'development';
const sslFlag = (nodeEnv == "development") ? false : true;

const { CLICK_KAFKA_TOPIC, PAGE_LOAD_KAFKA_TOPIC } = require('./kafka-topics.js')


const currentPath  = process.cwd();

if (!process.env.KAFKA_PREFIX)          throw new Error('KAFKA_PREFIX is not set.')
if (!process.env.KAFKA_URL)             throw new Error('KAFKA_URL is not set.')
if (!process.env.KAFKA_CONSUMER_GROUP)  throw new Error('KAFKA_CONSUMER_GROUP is not set.')
if (!process.env.KAFKA_TOPIC)           throw new Error('KAFKA_TOPIC is not set.')
if (!process.env.KAFKA_TRUSTED_CERT)    throw new Error('KAFKA_TRUSTED_CERT is not set.')
if (!process.env.KAFKA_CLIENT_CERT)     throw new Error('KAFKA_CLIENT_CERT is not set.')
if (!process.env.KAFKA_CLIENT_CERT_KEY) throw new Error('KAFKA_CLIENT_CERT_KEY is not set.')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set.')

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


let productClicks = {}
let pageLoads = 0;

//save clicks and page loads every 60 seconds, or every 5 seconds locally
setInterval(saveStatsToPostgres, sslFlag ? 60000 : 5000);

function saveStatsToPostgres() {
  let newClicks = false;
  let newLoads = false;

  var date = new Date();

  let clickValues = Object.keys(productClicks).map(key => {
    return [key,productClicks[key]]
  });

  let clickEventQuery = format('INSERT INTO button_click(button_id,clicks) VALUES %L', clickValues);
  console.log(clickEventQuery);
  if (clickValues.length > 0) newClicks = true;

  const pageLoadValues = [pageLoads, date.getTime()];
  let loadEventQuery = 'INSERT INTO page_load(loads,created_date) VALUES($1, to_timestamp($2 / 1000.0))';
  if (pageLoads > 0) newLoads = true;
  
  if (!newClicks && !newLoads) {
    console.log('no new events to record!')
  } else {
    (async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        let rows;
        let rows2;
        if (newClicks){
          rows = await client.query(clickEventQuery)
        } 
        if (newLoads) {
          rows2 = await client.query(loadEventQuery, pageLoadValues)
        } 
        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
        console.log('successfully saved data to postgres. committing new offset.')
        consumer.commit();
        productClicks = {};
        pageLoads = 0;
      }
    })().catch(e => console.error(e.stack))
  }
}

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
    switch (json.topic) {
    	case CLICK_KAFKA_TOPIC:
        if (json.properties.button_id in productClicks) productClicks[json.properties.button_id]++;
        else productClicks[json.properties.button_id] = 1;
			  break;
		  case PAGE_LOAD_KAFKA_TOPIC:
        pageLoads+=1;
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
const app = express();


app.use(function(req,res,next){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
  next();
})

// returns the number of clicks per button in the db
//'select row_to_json(t) from ( select button_id, count(button_id) from button_click group by button_id) t'
app.get('/api/clickCount', (req, res, next) => {
  const clickEventSql = 'SELECT button_id, SUM(clicks) FROM button_click GROUP BY button_id';
  pool.query(clickEventSql)
      .then(pgResponse => {
      // console.log(pgResponse);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(pgResponse.rows));
      next();
    })
    .catch(error =>{
      next(error);
    });
})

app.get('/api/clickHistory', (req, res, next) => {
  const clickEventSql = 'SELECT date_trunc(\'day\', button_click.created_date) AS "Day" , SUM(clicks) AS "clicks" FROM button_click GROUP BY 1 ORDER BY 1';
  pool.query(clickEventSql)
      .then(pgResponse => {
      // console.log(pgResponse);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(pgResponse.rows));
      next();
    })
    .catch(error =>{
      next(error);
    });
})

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Error calling ')
})

app.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
});