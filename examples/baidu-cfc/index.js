/* eslint-disable no-undef */
/* eslint-disable sort-keys */
const { Http2Mqtt } =  require('http2mqtt')

exports.handler = async (event, context, callback) => {
  try {
    const headers = event.headers
    const query = event.queryStringParameters
    const bodyString = event.body
    const body = JSON.parse(bodyString)
    const ops = { body, headers, query }

    const http2mqtt = new Http2Mqtt(ops)
    const res = await http2mqtt.pubMessage()

    callback(null, res.body)
  } catch (err) {
    console.error(err)
    callback(error, JSON.stringify({ error: err }))
  }
}
