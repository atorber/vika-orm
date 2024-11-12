/* eslint-disable sort-keys */
import { SheetDB, BiTableOptions, SpreadSheetsOptions } from '../src/mod.js'

const main = async () => {
  const latestTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  const bitableOptions: BiTableOptions = {
    appId: '',
    appSecret: '',
    appToken: 'CcHNb4wMkapNUYsDMB5cUb6VnI3',
    tableId: 'tblMSNWU7cBExFlV',
  }

  const spreadsheetsOptions: SpreadSheetsOptions = {
    appId: '',
    appSecret: '',
    spreadsheetToken: 'shtcnQX9PFJgxHLBOFivEJ3dqWh',
    sheetId:'wGEECy',
  }

  const db = new SheetDB(bitableOptions)
  const res = await db.insert({
    分钟: new Date().getTime(),
    更新时间: latestTime,
    最大购买力: 481437.52,
  })
  console.info(res)

  const db2 = new SheetDB(spreadsheetsOptions)
  await db2.setTenantAccessToken()
  //   [
  //     latestTime, 481437.52, 363645.00, 31437.52, 15683, '2024/11/11 13:43', '2024-11-11 13', '2024/11/11', '2024/11/11 13:43'
  // ]
  const data = {
    latestTime,
    481437.52: 481437.52,
    '363645.00': 363645.00,
    31437.52: 31437.52,
    15683: 15683,
    '2024/11/11 13:43': '2024/11/11 13:43',
    '2024-11-11 13': '2024-11-11 13',
    '2024/11/11': '2024/11/11',
  }
  const res2 = await db2.insert(data)
  console.info(res2)
}

main().catch((err) => {
  console.error(err)
})
