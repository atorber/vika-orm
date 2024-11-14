/* eslint-disable sort-keys */
import { LarkSheet, LarkTable, VikaTable, SheetOps, TableOps, VikaOps } from '../src/mod.js'

const main = async () => {
  const latestTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  const bitableOptions: TableOps = {
    appId: '',
    appSecret: '',
    appToken: 'CcHNb4wMkapNUYsDMB5cUb6VnI3',
    name: '测试表格',
  }

  const spreadsheetsOptions: SheetOps = {
    appId: '',
    appSecret: '',
    spreadsheetToken: 'shtcnQX9PFJgxHLBOFivEJ3dqWh',
    name:'测试表格',
  }

  const vikaOptions: VikaOps = {
    appId: '',
    appSecret: '',
    name: '测试表格',
  }

  const data = {
    分钟: new Date().getTime(),
    更新时间: latestTime,
    最大购买力: 481437.52,
  }

  const db = new LarkTable(bitableOptions)
  await db.init()
  const res = await db.insert(data)
  console.info(res)

  const db2 = new LarkSheet(spreadsheetsOptions)
  await db2.init()

  const db3 = new VikaTable(vikaOptions)
  await db3.init()

  const res2 = await db2.insert(data)
  console.info(res2)
}

main().catch((err) => {
  console.error(err)
})
