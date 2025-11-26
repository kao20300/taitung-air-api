// server.js

const express = require('express');
const axios = require('axios');
const moment = require('moment'); 

const app = express();
// Zeabur 會自動設定 PORT 環境變數，本機開發通常使用 3000
const PORT = process.env.PORT || 3000;

// ======================= 服務與 API 設定 =======================
const BASE_URL = 'https://data.epa.gov.tw/api/v2/aqx_p_152';

// 💡 從環境變數 (process.env) 中讀取 API_KEY
const API_KEY = process.env.API_KEY || '';

const SITE_NAME = '臺東';
const COUNTY_NAME = '臺東縣';

// 修正點：將參考時間設定在更早的過去 (2025-11-26 00:00)，確保有數據
const REFERENCE_TIME_STR = "2025-11-26 00:00"; 
// ==============================================================


/**
 * 取得指定測站、指定時間的監測數據
 * @param {string} monitorDate - 格式為 'YYYY-MM-DD HH:00'
 * @returns {Promise<Object[]>}
 */
async function fetchDataByTime(monitorDate) {
    // 檢查 API Key
    if (!API_KEY) {
        // 如果 API Key 未設定，直接拋出錯誤，避免呼叫外部 API
        throw new Error("API Key 環境變數未設置。");
    }

    const params = {
        api_key: API_KEY,
        sitename: SITE_NAME, 
        county: COUNTY_NAME,
        monitordate: monitorDate,
        limit: 1000, 
        format: 'json'
    };

    try {
        console.log(`-> 嘗試獲取時間: ${monitorDate}`);
        const response = await axios.get(BASE_URL, { params });
        // 成功，回傳 records 列表
        return response.data.records || [];
    } catch (error) {
        console.error(`Error fetching data for ${monitorDate}: ${error.message}`);
        // 發生錯誤時回傳空陣列
        return []; 
    }
}

// ======================= 1. 主要 API 路由 (/taitung-air-data) =======================

app.get('/taitung-air-data', async (req, res) => {
    // 檢查 API Key 
    if (!API_KEY) {
        return res.status(500).json({ 
            error: "服務配置錯誤：API Key 未設定。",
            guidance: "請在 Zeabur 環境變數中設定 KEY 為 API_KEY 的值。"
        });
    }

    const referenceMoment = moment(REFERENCE_TIME_STR, 'YYYY-MM-DD HH:mm');

    if (!referenceMoment.isValid()) {
        return res.status(400).json({ error: "參考時間格式無效，請檢查 REFERENCE_TIME_STR 設定。" });
    }

    // 1. 生成所有目標時間點 (參考時間點的前後 36 小時，共 73 個點)
    const allMonitorTimes = [];
    // 從 -36 小時開始，到 +36 小時結束
    for (let i = -36; i <= 36; i++) { 
        const targetTime = referenceMoment.clone().add(i, 'hours').format('YYYY-MM-DD HH:00');
        allMonitorTimes.push(targetTime);
    }
    
    // 2. 批次呼叫 API
    console.log(`開始批次請求 ${allMonitorTimes.length} 個時間點的數據...`);

    const fetchPromises = allMonitorTimes.map(time => fetchDataByTime(time));
    const results = await Promise.allSettled(fetchPromises);

    let allData = [];
    let successfulRequests = 0;

    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
            allData = allData.concat(result.value);
            successfulRequests++;
        }
    });

    // 整理資料：按監測日期排序 (從最早到最晚)
    allData.sort((a, b) => new Date(a.monitordate) - new Date(b.monitordate));

    // 3. 回傳結果
    res.json({
        status: 'success',
        time_range_start: allMonitorTimes[0],
        time_range_end: allMonitorTimes[allMonitorTimes.length - 1],
        summary: `成功取得 ${successfulRequests} 個小時，共 ${allData.length} 筆測項紀錄。`,
        data: allData
    });
});

// ======================= 2. 測試路由 (/test-single-record) =======================

// 🚨 修正點：將測試路由獨立定義，不再嵌套
app.get('/test-single-record', async (req, res) => {
    // 1. 定義測試目標：使用一個已知的過去時間點
    const TEST_DATE = "2025-11-26 17:00"; 
    
    if (!API_KEY) {
        return res.status(500).json({ error: "API Key 未設置，無法測試。" });
    }

    try {
        console.log(`-> 執行單點測試：時間 ${TEST_DATE}`);
        
        // 呼叫 fetchDataByTime 函數
        const records = await fetchDataByTime(TEST_DATE);
        
        // 過濾出 PM2.5 數據
        const pm25Record = records.find(r => r.itemengname === 'PM2.5');

        res.json({
            status: 'success',
            test_target: `臺東測站 @ ${TEST_DATE}`,
            total_records_found: records.length,
            pm25_record: pm25Record || "未找到 PM2.5 紀錄",
            all_records_for_test: records 
        });
    } catch (error) {
        console.error(`單點測試失敗: ${error.message}`);
        res.status(500).json({ 
            status: 'error',
            message: '單點測試時發生錯誤',
            detail: error.message
        });
    }
});


// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Access main endpoint: http://localhost:${PORT}/taitung-air-data`);
    console.log(`Access test endpoint: http://localhost:${PORT}/test-single-record`);
});