// server.js - 花東空氣品質預報服務

const express = require('express');
const axios = require('axios');

const app = express();
// Zeabur 會自動設定 PORT 環境變數
const PORT = process.env.PORT || 3000;

// ======================= 新 API 設定 =======================
// 新的基礎網址
const BASE_URL = 'https://data.moenv.gov.tw/api/v2/';
// 新的資料資源 ID (空氣品質預報)
const RESOURCE_ID = '226e6d3c-4232-4ec5-aec8-688894aa1f67';
// 從環境變數中讀取 API_KEY。請確認 Zeabur 上設定的 Key 名稱是 API_KEY
const API_KEY = process.env.API_KEY || '0476db62-ac45-42aa-a868-9b1e57f72746'; 

// 目標篩選區域 (花東空品區)
const TARGET_AREA = '花東';
// ==============================================================


/**
 * 取得空氣品質預報數據，並篩選指定區域
 */
app.get('/huadong-air-forecast', async (req, res) => {
    // 檢查 API Key 
    if (!API_KEY) {
        return res.status(500).json({ 
            status: "error",
            message: "服務配置錯誤：API Key 未設定。",
            guidance: "請在 Zeabur 環境變數中設定 KEY 為 API_KEY 的值。"
        });
    }

    // 完整的 API 請求網址
    const API_ENDPOINT = `${BASE_URL}${RESOURCE_ID}`;

    const params = {
        api_key: API_KEY,
        limit: 1000, 
        format: 'json'
        // 註: 此 API 不支援 URL 參數直接篩選 area='花東'，需在程式碼中篩選
    };

    try {
        console.log(`-> 嘗試獲取空氣品質預報資料...`);
        const response = await axios.get(API_ENDPOINT, { params });
        const allRecords = response.data.records || [];

        // 篩選出 area 等於 '花東' 的紀錄
        const huadongRecords = allRecords.filter(record => record.area === TARGET_AREA);

        // 整理資料：按發布時間排序
        huadongRecords.sort((a, b) => new Date(b.publishtime) - new Date(a.publishtime));


        // 回傳結果
        res.json({
            status: 'success',
            source_api: API_ENDPOINT,
            filter_area: TARGET_AREA,
            summary: `成功取得共 ${allRecords.length} 筆紀錄，其中 ${huadongRecords.length} 筆為 ${TARGET_AREA} 預報。`,
            data: huadongRecords
        });

    } catch (error) {
        console.error(`Error fetching air forecast data: ${error.message}`);
        // 錯誤處理：特別指出可能是 Key 錯誤
        res.status(500).json({ 
            status: 'error',
            message: '呼叫環保署 API 時發生錯誤，請檢查 API Key 或網路連線。',
            detail: error.message
        });
    }
});


// 移除舊的 /test-single-record 路由，只保留新的主路由

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`新服務啟動於: http://localhost:${PORT}/huadong-air-forecast`);
});