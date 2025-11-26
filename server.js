// server.js - 花東空氣品質預報服務

const express = require('express');
const axios = require('axios');

const app = express();
// Zeabur 會自動設定 PORT 環境變數，確保服務可以正確啟動
const PORT = process.env.PORT || 3000;

// ======================= API 設定 =======================
// 環境部開放資料平台 API v2 基礎網址
const BASE_URL = 'https://data.moenv.gov.tw/api/v2/';
// 空氣品質預報資料的 Resource ID (對應 aqf_p_01)
const RESOURCE_ID = '226e6d3c-4232-4ec5-aec8-688894aa1f67';
// 從環境變數中讀取 API_KEY。***這是最關鍵的一步，請確保 Zeabur 上有設定此變數***
const API_KEY = process.env.API_KEY || ''; 

// 目標篩選區域
const TARGET_AREA = '花東';
// ========================================================


/**
 * 主要路由：取得花東地區的空氣品質預報數據
 */
app.get('/huadong-air-forecast', async (req, res) => {
    
    // 步驟 1: 檢查 API Key 是否存在
    if (!API_KEY) {
        return res.status(500).json({ 
            status: "error",
            message: "服務配置錯誤：API Key 環境變數未設定。",
            guidance: "請在 Zeabur 儀表板的環境變數中設定 KEY 為 API_KEY，並填入您的金鑰值。"
        });
    }

    // 完整的 API 請求網址: BASE_URL + Resource_ID
    const API_ENDPOINT = `${BASE_URL}${RESOURCE_ID}`;

    const params = {
        api_key: API_KEY,
        limit: 1000, // 嘗試獲取足夠的資料
        format: 'json'
    };

    try {
        console.log(`-> 嘗試獲取空氣品質預報資料 from: ${API_ENDPOINT}`);
        
        // 步驟 2: 呼叫外部 API
        const response = await axios.get(API_ENDPOINT, { params });
        const allRecords = response.data.records || [];

        // 步驟 3: 篩選出 area 等於 '花東' 的紀錄
        const huadongRecords = allRecords.filter(record => record.area === TARGET_AREA);

        // 步驟 4: 整理資料 - 按發布時間排序 (最新的在前面)
        // 這樣前端收到後就能立即看到最新的預報數據
        huadongRecords.sort((a, b) => new Date(b.publishtime) - new Date(a.publishtime));

        // 步驟 5: 回傳結果
        res.json({
            status: 'success',
            source_api: API_ENDPOINT,
            filter_area: TARGET_AREA,
            summary: `成功取得共 ${allRecords.length} 筆紀錄，其中 ${huadongRecords.length} 筆為 ${TARGET_AREA} 預報。`,
            data: huadongRecords
        });

    } catch (error) {
        console.error(`Error fetching air forecast data: ${error.message}`);
        // 錯誤處理：回報給用戶端
        res.status(500).json({ 
            status: 'error',
            message: '呼叫環境部 API 時發生錯誤。請檢查您的 API Key 是否有效。',
            detail: error.message
        });
    }
});


// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`新服務啟動於: http://localhost:${PORT}/huadong-air-forecast`);
});