const nodeEnv = process.env.NODE_ENV || 'development';

let devClickTopicName;
let devPageloadTopicName;

if(nodeEnv == "development") {
  devClickTopicName = "edm-ui-click-local";
  devPageloadTopicName = "edm-ui-pageload-local";
} else {
  devClickTopicName = "edm-ui-click";
  devPageloadTopicName = "edm-ui-pageload";
}

const CLICK_KAFKA_TOPIC     = process.env.CLICK_KAFKA_TOPIC || devClickTopicName;
const PAGE_LOAD_KAFKA_TOPIC = process.env.PAGE_LOAD_KAFKA_TOPIC || devPageloadTopicName;


module.exports = {
  CLICK_KAFKA_TOPIC,
  PAGE_LOAD_KAFKA_TOPIC
}