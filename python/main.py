import asyncio
from dataclasses import dataclass
from typing import Union, Dict, Any

from larksuiteoapi import Config, Request, Client
from larksuiteoapi.service.bitable.v1 import app_table_record
import aiohttp

@dataclass
class BiTableOptions:
    app_id: str
    app_secret: str
    app_token: str
    table_id: str

@dataclass
class SpreadSheetsOptions:
    app_id: str
    app_secret: str
    spreadsheet_token: str
    sheet_id: str

class SheetDB:
    def __init__(self, options: Union[BiTableOptions, SpreadSheetsOptions]):
        self.options = options
        self.tenant_access_token = ''
        
        if isinstance(options, BiTableOptions):
            self.type = 'bitable'
            self.bitable_options: BiTableOptions = options
        elif isinstance(options, SpreadSheetsOptions):
            self.type = 'spreadsheets'
            self.spreadsheets_options: SpreadSheetsOptions = options
        else:
            raise ValueError("Invalid options provided.")
        
        # Initialize Lark client configuration
        self.config = Config.new_internal_app_config(
            app_id=self.options.app_id,
            app_secret=self.options.app_secret
        )
        self.lark_client = Client(self.config)

    async def set_tenant_access_token(self):
        # 获取租户访问令牌
        req = Request("POST", "/open-apis/auth/v3/tenant_access_token/internal", {})
        resp = await self.lark_client.request(req)
        if resp.code != 0:
            raise Exception(f"Failed to get tenant access token: {resp.msg}")
        self.tenant_access_token = resp.tenant_access_token

    async def insert(self, data: Dict[str, Union[int, str]]) -> Any:
        if not self.tenant_access_token:
            await self.set_tenant_access_token()
        
        if self.type == 'bitable':
            return await self.insert_bitable(data)
        elif self.type == 'spreadsheets':
            return await self.insert_spreadsheets(data)
        else:
            raise ValueError("Invalid SheetDB type.")

    async def insert_bitable(self, data: Dict[str, Union[int, str]]) -> Any:
        try:
            req = app_table_record.CreateAppTableRecordReq(
                app_token=self.bitable_options.app_token,
                table_id=self.bitable_options.table_id,
                fields=data
            )
            resp = await self.lark_client.bitable.app_table_record.create(req)
            if resp.code != 0:
                raise Exception(f"Failed to insert into Bitable: {resp.msg}")
            return resp
        except Exception as e:
            print(f"Error inserting into Bitable: {e}")
            raise

    async def insert_spreadsheets(self, data: Dict[str, Union[int, str]]) -> Any:
        url = f"https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/{self.spreadsheets_options.spreadsheet_token}/values_append"
        params = {
            "insertDataOption": "OVERWRITE"
        }
        payload = {
            "valueRange": {
                "range": self.spreadsheets_options.sheet_id,
                "values": [list(data.values())],
            }
        }
        headers = {
            "Authorization": f"Bearer {self.tenant_access_token}",
            "Content-Type": "application/json"
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, params=params) as response:
                if response.status != 200:
                    text = await response.text()
                    raise Exception(f"Failed to insert into Spreadsheets: {response.status}, {text}")
                return await response.json()

# 示例用法
async def main():
    # 对于 Bitable
    bitable_options = BiTableOptions(
        app_id="your_app_id",
        app_secret="your_app_secret",
        app_token="your_app_token",
        table_id="your_table_id"
    )
    sheet_db_bitable = SheetDB(bitable_options)
    await sheet_db_bitable.set_tenant_access_token()
    result_bitable = await sheet_db_bitable.insert({
        "字段1": "值1",
        "字段2": 123,
        # 添加更多字段
    })
    print("Bitable 插入结果:", result_bitable)

    # 对于 SpreadSheets
    spreadsheets_options = SpreadSheetsOptions(
        app_id="your_app_id",
        app_secret="your_app_secret",
        spreadsheet_token="your_spreadsheet_token",
        sheet_id="your_sheet_id"
    )
    sheet_db_spreadsheets = SheetDB(spreadsheets_options)
    await sheet_db_spreadsheets.set_tenant_access_token()
    result_spreadsheets = await sheet_db_spreadsheets.insert({
        "列1": "值1",
        "列2": 456,
        # 添加更多列
    })
    print("Spreadsheets 插入结果:", result_spreadsheets)

if __name__ == "__main__":
    asyncio.run(main())