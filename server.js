// server.js - 花東空氣品質預報服務 (最終確認版本)

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ======================= API 最終設定 =======================
const BASE_URL = 'https://data.moenv.gov.tw/api/v2/';
// 使用資源代碼 'aqf_p_01'
const RESOURCE_CODE = 'aqf_p_01';
// 從環境變數中讀取 API_KEY
const API_KEY = process.env.API_KEY || ''; 

// 目標篩選區域
const TARGET_AREA = '花東';
// ========================================================


/**
 * 主要路由：取得花東地區的空氣品質預報數據
 */
app.get('/huadong-air-forecast', async (req, res) => {
    
    if (!API_KEY) {
        return res.status(500).json({ 
            status: "error",
            message: "服務配置錯誤：API Key 環境變數未設定。",
            guidance: "請在 Zeabur 儀表板的環境變數中設定 KEY 為 API_KEY。"
        });
    }

    // 完整的 API 請求網址: BASE_URL + RESOURCE_CODE
    const API_ENDPOINT = `${BASE_URL}${RESOURCE_CODE}`;

    const params = {
        api_key: API_KEY,
        limit: 1000, 
        format: 'json'
    };

    try {
        console.log(`-> 嘗試獲取空氣品質預報資料 from: ${API_ENDPOINT}`);
        
        const response = await axios.get(API_ENDPOINT, { params });
        const allRecords = response.data.records || [];

        // 篩選出 area 等於 '花東' 的紀錄
        const huadongRecords = allRecords.filter(record => record.area === TARGET_AREA);

        // 整理資料 - 按發布時間排序 (最新的在前面)
        huadongRecords.sort((a, b) => new Date(b.publishtime) - new Date(a.publishtime));

        // 回傳結果
        res.json({
            status: 'success',
            source_api: API_ENDPOINT,
            filter_area: TARGET_AREA,
            summary: `成功取得共 ${allRecords.length} 筆紀錄，其中 ${huadongRecords.length} 筆為 ${TARGET_AREA} 預報。`,
            data: huadongRecords.length > 0 ? huadongRecords : "API 連線成功，但目前沒有找到符合『花東』地區的預報紀錄。"
        });

    } catch (error) {
        // 捕獲到網路或 API 呼叫錯誤
        console.error(`Error fetching air forecast data: ${error.message}`);
        res.status(500).json({ 
            status: 'error',
            message: '呼叫環境部 API 時發生連線或內部錯誤。',
            detail: error.message
        });
    }
});


// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`服務啟動於: http://localhost:${PORT}/huadong-air-forecast`);
});