import * as lark from '@larksuiteoapi/node-sdk'
import axios from 'axios'

interface BiTableOptions {
    appId: string
    appSecret: string
    appToken: string,
    tableId: string,
}

interface SpreadSheetsOptions {
    appId: string
    appSecret: string
    spreadsheetToken: string,
    sheetId: string,
}

export class SheetDB {

  private larkClient: lark.Client
  private tenantAccessToken: string = ''
  private options: BiTableOptions | SpreadSheetsOptions
  private type: 'bitable' | 'spreadsheets'
  private bitableOptions?: BiTableOptions
  private spreadsheetsOptions?: SpreadSheetsOptions

  constructor (options: BiTableOptions | SpreadSheetsOptions) {
    this.options = options
    this.larkClient = new lark.Client({
      appId: this.options.appId,
      appSecret: this.options.appSecret,
    })
    if ('appToken' in options) {
      this.type = 'bitable'
      this.bitableOptions = options
    } else {
      this.type = 'spreadsheets'
      this.spreadsheetsOptions = options
    }
  }

  async setTenantAccessToken () {
    const res: any = await this.larkClient.auth.tenantAccessToken.internal({
      data: {
        app_id: this.options.appId,
        app_secret: this.options.appSecret,
      },
    })
    this.tenantAccessToken = res.tenant_access_token
  }

  //   db.insert(newData, (err, insertedData) => {
  //     if (err) {
  //       console.error(err);
  //     } else {
  //       console.log('Data inserted:', insertedData);
  //     }
  //   });
  async insert (data: { [key: string]: number | string }) {
    if (this.type === 'bitable') {
      return await this.larkClient.bitable.appTableRecord.create({
        data: {
          fields: data,
        },
        path: {
          app_token: this.bitableOptions?.appToken || '',
          table_id: this.bitableOptions?.tableId || '',
        },
      })
    } else {
      const dataArray = []
      for (const key in data) {
        dataArray.push(data[key])
      }
      const res = await axios.post(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${this.spreadsheetsOptions?.spreadsheetToken}/values_append?insertDataOption=OVERWRITE`, {
        valueRange: {
          range: this.spreadsheetsOptions?.sheetId,
          values: [
            dataArray,
          ],
        },
      }, {
        headers: {
          Authorization: `Bearer ${this.tenantAccessToken}`,
          'Content-Type': 'application/json',
        },
      })
      return res.data
    }
  }

}

export type {
  BiTableOptions,
  SpreadSheetsOptions,
}
