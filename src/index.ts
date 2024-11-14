/* eslint-disable sort-keys */
import * as lark from '@larksuiteoapi/node-sdk'
import axios from 'axios'

// 抽象基类定义共有的操作
interface BaseOps {
  appId: string;
  appSecret: string;
}

interface Table {
  sheetId: string
  title: string
}

interface Document { [key: string]: string | number | boolean }

abstract class BaseClient<Ops extends BaseOps> {

  ops: Ops
  client: lark.Client
  tableId: string = ''

  constructor (ops: Ops) {
    this.ops = ops
    this.client = new lark.Client({
      appId: this.ops.appId,
      appSecret: this.ops.appSecret,
    })
  }

  // 共享的文档插入逻辑
  protected prepareDocument (doc: Document): Document {
    const _id = new Date().getTime().toString()
    if (!doc['_id']) doc['_id'] = _id
    const dataSorted = Object.keys(doc).sort().reduce((obj: { [key: string]: any }, key) => {
      obj[key] = doc[key]
      return obj
    }, {})
    return dataSorted
  }

  // 抽象方法，需要子类实现
  abstract init(): Promise<Table>;
  abstract create(name: string, heading: Document): Promise<Table>;
  abstract list(name: string): Promise<Table>;
  abstract insert(doc: Document): Promise<Document>;
  abstract update(query: Document, doc: Document): Promise<Document>;
  abstract find(query: Document): Promise<Document>;
  abstract remove(query: Document): Promise<Document>;

}

// Sheet 操作接口和类
export interface SheetOps extends BaseOps {
  spreadsheetToken: string;
  name: string;
}

export class LarkSheet extends BaseClient<SheetOps> {

  tenant_access_token: string = ''
  tenant_access_token_time: number = 0

  constructor (ops: SheetOps) {
    super(ops)
  }

  // 初始化获取 tenant_access_token
  async init (): Promise<Table> {
    const res: any = await this.client.auth.tenantAccessToken.internal({
      data: {
        app_id: this.ops.appId,
        app_secret: this.ops.appSecret,
      },
    })
    this.tenant_access_token = res.tenant_access_token
    this.tenant_access_token_time = new Date().getTime()
    const table = await this.list(this.ops.name)
    this.tableId = table.sheetId
    return table
  }

  async getTenantAccessToken () {
    const now = new Date().getTime()
    if (now - this.tenant_access_token_time > (2 * 60 * 60 * 1000 - 10 * 60 * 1000)) {
      await this.init()
    }
    return this.tenant_access_token
  }

  // 创建表格
  async create (title: string, heading: Document): Promise<Table> {
    console.info('heading', heading)
    const res = await axios.post(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${this.ops.spreadsheetToken}/sheets_batch_update`,
      {
        requests: [
          {
            addSheet: {
              properties: {
                title,
                index: 1,
              },
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${await this.getTenantAccessToken()}`,
          'Content-Type': 'application/json',
        },
      },
    )
    // console.info(JSON.stringify(res.data, null, 2));
    const sheetId = res.data.data.replies[0].addSheet.properties.sheetId
    this.tableId = sheetId
    const data = this.prepareDocument(heading)
    Object.keys(data).forEach((key) => {
      data[key] = key
    })
    // console.info('data', data);
    await this.insert(data)
    return {
      sheetId,
      title,
    }
  }

  // 查找表格
  async list (title: string): Promise<Table> {
    const res = await axios.get(
      `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${this.ops.spreadsheetToken}/sheets/query`,
      {
        headers: {
          Authorization: `Bearer ${await this.getTenantAccessToken()}`,
          'Content-Type': 'application/json',
        },
      },
    )
    // console.info(JSON.stringify(res.data, null, 2));
    const sheets: any[] = res.data.data.sheets
    const sheetFilter = sheets.filter(sheet => sheet.title === title)

    if (sheetFilter.length > 0) {
      return {
        sheetId: sheetFilter[0].sheet_id,
        title: sheetFilter[0].title,
      }
    } else {
      // const res2 = await this.create(title);
      // return {
      //     sheetId: res2.data.replies[0].addSheet.properties.sheetId,
      //     title: title
      // };
      return {
        sheetId: '',
        title,
      }
    }
  }

  // 写入数据
  async insert (doc: Document): Promise<Document> {
    const preparedDoc = this.prepareDocument(doc)
    const dataArr = Object.values(preparedDoc)
    const res = await axios.post(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${this.ops.spreadsheetToken}/values_append?insertDataOption=OVERWRITE`,
      {
        valueRange: {
          range: `${this.tableId}`,
          values: [ dataArr ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${await this.getTenantAccessToken()}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (res.data.code === 0 && res.data.msg === 'success') {
      return preparedDoc
    } else {
      return res.data
    }
  }

  // 更新数据
  async update (query: Document, doc: Document): Promise<Document> {
    console.info('query', query)
    const preparedDoc = this.prepareDocument(doc)
    const dataArr = Object.values(preparedDoc)
    const res = await axios.post(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${this.ops.spreadsheetToken}/values_update`,
      {
        valueRange: {
          range: `${this.tableId}`,
          values: [ dataArr ],
        },
      },
      {
        headers: {
          Authorization: `Bearer ${await this.getTenantAccessToken()}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (res.data.code === 0 && res.data.msg === 'success') {
      return preparedDoc
    } else {
      return res.data
    }
  }

  // 查找数据
  async find (query: Document): Promise<Document> {
    console.info('query', query)
    const res = await axios.get(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${this.ops.spreadsheetToken}/values_get`,
      {
        headers: {
          Authorization: `Bearer ${await this.getTenantAccessToken()}`,
          'Content-Type': 'application/json',
        },
      },
    )
    console.info(JSON.stringify(res.data, null, 2))
    return res.data
  }

  // 删除数据
  async remove (query: Document): Promise<Document> {
    console.info('query', query)

    const res = await axios.post(
      `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${this.ops.spreadsheetToken}/sheets_batch_update`,
      {
        requests: [
          {
            deleteSheet: {
              sheetId: this.tableId,
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${await this.getTenantAccessToken()}`,
          'Content-Type': 'application/json',
        },
      },
    )
    console.info(JSON.stringify(res.data, null, 2))
    return res.data
  }

}

// Table 操作接口和类
export interface TableOps extends BaseOps {
  appToken: string;
  name: string;
}

export class LarkTable extends BaseClient<TableOps> {

  constructor (ops: TableOps) {
    super(ops)
  }

  // 初始化获取表ID
  async init (): Promise<Table> {
    const table = await this.list(this.ops.name)
    this.tableId = table.sheetId
    return table
  }

  // 创建智能表格
  async create (title: string, heading: Document): Promise<any> {
    const fields: { field_name: string; type: 1 | 2 | 7; }[] = Object.keys(heading).map((key) => {
      const type = typeof heading[key] === 'number' ? 2 : (typeof heading[key] === 'boolean' ? 7 : 1)
      return {
        field_name: key,
        type,
      }
    })
    fields.unshift({
      field_name: '_id',
      type: 1,
    })
    const res = await this.client.bitable.appTable.create({
      data: {
        table: {
          name: title,
          default_view_name: '默认的表格视图',
          fields,
        },
      },
      path: {
        app_token: this.ops.appToken,
      },
    })
    console.info(JSON.stringify(res))
    this.tableId = res.data?.table_id || ''
    return {
      sheetId: this.tableId,
      title,
    }
  }

  // 查找智能表格
  async list (title: string): Promise<Table> {
    const res = await this.client.bitable.appTable.list({
      path: {
        app_token: this.ops.appToken,
      },
    })
    // console.info(JSON.stringify(res, null, 2));
    const tables = res.data?.items
    const tableFilter = tables?.filter(table => table.name === title) || []

    if (tableFilter.length > 0) {
      return {
        sheetId: tableFilter[0]?.table_id || '',
        title,
      }
    } else {
      // const type: 1 | 2 = 1;
      // const fields = [
      //     {
      //         "field_name": "名称",
      //         "type": type
      //     },
      // ];
      // const res2 = await this.create(title, fields);
      // return res2;
      return {
        sheetId: '',
        title,
      }
    }
  }

  // 写入数据
  async insert (doc: { [key: string]: any }): Promise<Document> {
    const preparedDoc = this.prepareDocument(doc)
    const res = await this.client.bitable.appTableRecord.create({
      data: {
        fields: preparedDoc,
      },
      path: {
        app_token: this.ops.appToken,
        table_id: this.tableId,
      },
    })

    if (res.msg === 'success' && res.code === 0) {
      return preparedDoc
    } else {
      return {
        error: JSON.stringify(res),
      }
    }
  }

  // 更新数据
  async update (query: Document, doc: Document): Promise<Document> {
    console.info('query', query)
    return doc
  }

  // 查找数据
  async find (query: Document): Promise<Document> {
    console.info('query', query)

    return query
  }

  // 删除数据
  async remove (query: Document): Promise<any> {
    console.info('query', query)
    return query
  }

}

// Vika 操作接口和类
export interface VikaOps extends BaseOps {
  name: string;
}

export class VikaTable extends BaseClient<VikaOps> {

  private vikaBaseURL: string = 'https://vika.cn/fusion/v1'

  constructor (ops: VikaOps) {
    super(ops)
  }

  // 初始化获取表ID
  async init (): Promise<Table> {
    const table = await this.list(this.ops.name)
    this.tableId = table.sheetId
    return table
  }

  // 创建表格（根据 Vika API 文档实现）
  async create (title: string, heading: Document): Promise<Table> {
    const fields: { name: string; type: 'Text' | 'Number' | 'Checkbox'; }[] = Object.keys(heading).map((key) => {
      const type = typeof heading[key] === 'number' ? 'Number' : (typeof heading[key] === 'boolean' ? 'Checkbox' : 'Text')
      return {
        name: key,
        type,
      }
    })
    fields.unshift({
      name: '_id',
      type: 'Text',
    })
    const body = {
      name: title,
      description: title,
      folderId: null,
      preNodeId: null,
      fields,
    }
    // console.info('body', body);
    const res = await axios.post(
      `${this.vikaBaseURL}/spaces/${this.ops.appId}/datasheets`,
      body,
      {
        headers: {
          Authorization: `Bearer ${this.ops.appSecret}`,
          'Content-Type': 'application/json',
        },
      },
    )
    // console.info(JSON.stringify(res.data, null, 2));
    this.tableId = res.data.data.id

    return {
      sheetId: this.tableId,
      title,
    }
  }

  // 写入维格表
  async insert (doc: Document): Promise<Document> {
    const preparedDoc = this.prepareDocument(doc)
    // console.info('preparedDoc', preparedDoc);
    const res = await axios.post(
      `${this.vikaBaseURL}/datasheets/${this.tableId}/records`,
      {
        records: [
          {
            fields: preparedDoc,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${this.ops.appSecret}`,
          'Content-Type': 'application/json',
        },
      },
    )

    // console.info(JSON.stringify(res.data, null, 2));
    if (res.data.code === 200 && res.data.success) {
      return preparedDoc
    } else {
      return res.data
    }
  }

  // 查找表格
  async list (title: string): Promise<Table> {
    const res = await axios.get(
      `${this.vikaBaseURL}/spaces/${this.ops.appId}/nodes`,
      {
        headers: {
          Authorization: `Bearer ${this.ops.appSecret}`,
          'Content-Type': 'application/json',
        },
      },
    )
    // console.info(JSON.stringify(res.data, null, 2));
    const tables = res.data.data.nodes
    const tableFilter = tables.filter((table: any) => table.name === title)

    if (tableFilter.length > 0) {
      return {
        sheetId: tableFilter[0].id,
        title: tableFilter[0].name,
      }
    } else {
      return {
        sheetId: '',
        title,
      }
    }
  }

  // 更新数据
  async update (query: Document, doc: Document): Promise<Document> {
    console.info('query', query)

    return doc
  }

  // 查找数据
  async find (query: Document): Promise<Document> {
    console.info('query', query)
    return query
  }

  // 删除数据
  async remove (query: Document): Promise<Document> {
    return query
  }

}
