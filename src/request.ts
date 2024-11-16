/* eslint-disable sort-keys */

// 在微信小程序中使用时删除以下行
const wx:any = 'xx'

// Vika 操作接口和类
interface Document { [key: string]: string | number | boolean }

// 抽象基类定义共有的操作
interface BaseOps {
    appId: string;
    appSecret: string;
    autoload?: boolean;
    heading?: Document;
}

interface Table {
    sheetId: string
    title: string
}
abstract class BaseClient<Ops extends BaseOps> {

  ops: Ops
  client: any
  tableId: string = ''
  defaultHeading = {
    _id: '123456',
  }

  constructor (ops: Ops) {
    this.ops = ops
    this.client = ''
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
    abstract insert(doc: Document | Document[]): Promise<Document | Document[]>;
    abstract update(query: Document, doc: Document): Promise<Document>;
    abstract find(query: Document): Promise<Document[]>;
    abstract findOne(query: Document): Promise<Document>;
    abstract remove(query: Document): Promise<Document>;

}

export interface VikaOps extends BaseOps {
    name: string;
}

export class VikaTable extends BaseClient<VikaOps> {

  private vikaBaseURL: string = 'https://vika.cn/fusion/v1'

  constructor (ops: VikaOps) {
    super(ops)
  }

  // 封装 wx.request 为 Promise
  private request (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, data?: any, headers?: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method,
        data,
        header: headers,
        success: (res: { statusCode: number; data: any; }) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(new Error(`Request failed with status code ${res.statusCode}`))
          }
        },
        fail: (err: any) => {
          reject(err)
        },
      })
    })
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
    const res = await this.request(
      'POST',
            `${this.vikaBaseURL}/spaces/${this.ops.appId}/datasheets`,
            body,
            {
              Authorization: `Bearer ${this.ops.appSecret}`,
              'Content-Type': 'application/json',
            },
    )
    // console.info(JSON.stringify(res, null, 2));
    this.tableId = res.data.id

    return {
      sheetId: this.tableId,
      title,
    }
  }

  // 写入维格表
  async insert (doc: Document): Promise<Document | Document[]> {
    const docs = Array.isArray(doc) ? doc : [ doc ]
    const newDocs: Document[] = []
    docs.forEach((doc) => {
      const preparedDoc = this.prepareDocument(doc)
      newDocs.push(preparedDoc)
    })
    const fields = newDocs.map((doc) => {
      return {
        fields: doc,
      }
    })
    const res = await this.request(
      'POST',
            `${this.vikaBaseURL}/datasheets/${this.tableId}/records`,
            {
              records: fields,
            },
            {
              Authorization: `Bearer ${this.ops.appSecret}`,
              'Content-Type': 'application/json',
            },
    )

    // console.info(JSON.stringify(res, null, 2));
    if (res.code === 200 && res.success) {
      return newDocs.length > 1 ? newDocs : (newDocs[0] || [])
    } else {
      return res
    }
  }

  // 查找表格
  async list (title: string): Promise<Table> {
    const res = await this.request(
      'GET',
            `${this.vikaBaseURL}/spaces/${this.ops.appId}/nodes`,
            null,
            {
              Authorization: `Bearer ${this.ops.appSecret}`,
              'Content-Type': 'application/json',
            },
    )
    // console.info(JSON.stringify(res, null, 2));
    const tables = res.data.nodes
    const tableFilter = tables.filter((table: any) => table.name === title)

    if (tableFilter.length > 0) {
      return {
        sheetId: tableFilter[0].id,
        title: tableFilter[0].name,
      }
    } else {
      if (this.ops.autoload) {
        const res2 = await this.create(title, this.ops.heading || this.defaultHeading)
        return res2
      }
      return {
        sheetId: '',
        title,
      }
    }
  }

  // 更新数据
  async update (query: Document, doc: Document): Promise<Document> {
    console.info('query', query)
    // 根据具体需求实现更新逻辑
    return doc
  }

  // 查找单条数据
  async findOne (query: Document): Promise<Document> {
    console.info('query', query)
    const filterByFormula = `{_id}="${query['_id'] || ''}"`
    // 查询示例：&filterByFormula={标题}="标题1"（需要用 encodeURIComponent() 函数对 {标题}="标题1" 进行转义编码），可以精确匹配「标题」这列中值为「标题1」的记录。
    const res = await this.request(
      'GET',
            `https://vika.cn/fusion/v3/datasheets/${this.tableId}/records?filterByFormula=${encodeURIComponent(filterByFormula)}`,
            null,
            {
              Authorization: `Bearer ${this.ops.appSecret}`,
              'Content-Type': 'application/json',
            },
    )
    const docs: Document[] = res.records?.map((item: { fields: Document }) => {
      return item.fields
    })
    return docs[0] || {}
  }

  // 查找多条数据
  async find (query: Document): Promise<Document[]> {
    console.info('query', query)
    const filterByFormula = `{_id}="${query['_id'] || ''}"`
    // 查询示例：&filterByFormula={标题}="标题1"（需要用 encodeURIComponent() 函数对 {标题}="标题1" 进行转义编码），可以精确匹配「标题」这列中值为「标题1」的记录。
    const res = await this.request(
      'GET',
            `https://vika.cn/fusion/v3/datasheets/${this.tableId}/records?filterByFormula=${encodeURIComponent(filterByFormula)}`,
            null,
            {
              Authorization: `Bearer ${this.ops.appSecret}`,
              'Content-Type': 'application/json',
            },
    )
    const docs: Document[] = res.records?.map((item: { fields: Document }) => {
      return item.fields
    })
    return docs
  }

  // 删除数据
  async remove (query: Document): Promise<Document> {
    // 根据具体需求实现删除逻辑
    return query
  }

}
