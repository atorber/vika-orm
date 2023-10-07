/* eslint-disable sort-keys */
/* eslint-disable no-console */
import mqtt from 'mqtt'
import { decrypt, encrypt, getKey, DecryptedMessage } from './utils.js'
import jsonata from 'jsonata'

// 定义接口：请求头部信息
type Headers = {
  endpoint: string;
  port?: number;
  username: string;
  password: string;
  clientid?: string;
  secretkey?: string;
}

// 定义接口：请求查询参数
type Query = {
  RequestTopic: string;
  ResponseTopic?: string;
  Convert?: string;
}

// 定义接口：请求体内容
type Body = {
  [key: string]: any;
}

// 定义接口：响应内容
type ResponsePayload = {
  status: number;
  body: any;
}

// 定义接口：请求选项
type Options = {
  headers: Headers;
  body: Body;
  query: Query;
}

// 主类：处理HTTP到MQTT的转换
class Http2Mqtt {

  private responsePayload: ResponsePayload = { body: {}, status: 200 }
  private ops: Options

  constructor (ops: Options) {
    ops.headers = Object.fromEntries(
      Object.entries(ops.headers).map(([ key, value ]) => [ key.toLowerCase(), value ]),
    ) as Headers
    this.ops = ops
  }

  async pubMessage (): Promise<ResponsePayload> {
    console.debug('this.ops\n', JSON.stringify(this.ops))
    const {
      endpoint = '',
      username = '',
      password = '',
      port = 1883,
      secretkey: key,
    } = this.ops.headers

    const { RequestTopic: pubTopic = '', ResponseTopic: subTopic = pubTopic, Convert } = this.ops.query

    let payload: any = this.ops.body

    // 如果存在Convert参数，使用jsonata进行数据转换
    if (Convert) {
      const expression = jsonata(Convert)
      payload = await expression.evaluate(payload)
    }

    payload = JSON.stringify(payload)

    // 如果存在密钥，对消息进行加密
    if (key) {
      payload = JSON.stringify(encrypt(payload, key))
    }

    // 连接到MQTT服务器
    const client = mqtt.connect(`mqtt://${endpoint}:${port}`, {
      password,
      username,
    })

    return new Promise<ResponsePayload>((resolve) => {

      // 设置15秒超时
      const timeout: any = setTimeout(() => {
        this.responsePayload = {
          status: 408,
          body: { error: 'Request timed out' },
        }
        client.end()
        resolve(this.responsePayload)
      }, 15000)

      client.on('connect', () => {
        client.subscribe(subTopic, (err: any) => {
          if (err) {
            this.responsePayload = {
              status: 500,
              body: { error: 'Failed to subscribe to topic' },
            }
            client.end()
            resolve(this.responsePayload)
            return
          }

          client.publish(pubTopic, payload, (err) => {
            if (err) {
              this.responsePayload = {
                status: 500,
                body: { error: 'Failed to publish to topic' },
              }
              client.end()
              resolve(this.responsePayload)
            }
          })
        })
      })

      client.on('message', (topic, message) => {
        if (topic === subTopic) {
          let messageText = message.toString()

          // 如果存在密钥，对收到的消息进行解密
          if (key) {
            messageText = decrypt(JSON.parse(messageText) as DecryptedMessage, key)
          }

          clearTimeout(timeout)
          this.responsePayload = {
            body: { error: 'ok', message: JSON.parse(messageText) },
            status: 200,
          }
          client.end()
          resolve(this.responsePayload)
        }
      })

      client.on('error', (err) => {
        this.responsePayload = {
          status: 500,
          body: { error: err.message },
        }
        client.end()
        resolve(this.responsePayload)
      })
    })
  }

}

export {
  Http2Mqtt,
  encrypt,
  decrypt,
  getKey,
}

export type {
  Body,
  Headers,
  Query, ResponsePayload,
  Options,
}
