const CLICK_KAFKA_TOPIC     = process.env.CLICK_KAFKA_TOPIC || 'edm-ui-click,';
const PAGE_LOAD_KAFKA_TOPIC = process.env.PAGE_LOAD_KAFKA_TOPIC || 'edm-ui-pageload';


module.exports = {
  CLICK_KAFKA_TOPIC,
  PAGE_LOAD_KAFKA_TOPIC
}