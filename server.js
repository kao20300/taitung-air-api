// server.js

const express = require('express');
const axios = require('axios');
const moment = require('moment'); // 用於處理日期時間

const app = express();
// Zeabur 會自動設定 PORT 環境變數，本機開發通常使用 3000
const PORT = process.env.PORT || 3000;

// ======================= API & 測站設定 =======================
const BASE_URL = 'https://data.epa.gov.tw/api/v2/aqx_p_152';

// 💡 關鍵修改：從環境變數 (process.env) 中讀取名為 API_KEY 的值
// 如果環境變數不存在，則使用空字串作為備用值，防止服務崩潰
const API_KEY = process.env.API_KEY || '';

const SITE_NAME = '臺東';
const COUNTY_NAME = '臺東縣';
// 設定您文件中的參考時間
const REFERENCE_TIME_STR = "2025-11-26 17:00"; 
// ==============================================================


/**
 * 取得指定測站、指定時間的監測數據
 * @param {string} monitorDate - 格式為 'YYYY-MM-DD HH:00'
 * @returns {Promise<Object[]>}
 */
async function fetchDataByTime(monitorDate) {
    // API 呼叫的參數設定
    const params = {
        api_key: API_KEY,
        sitename: SITE_NAME, 
        county: COUNTY_NAME,
        monitordate: monitorDate,
        limit: 1000, // 確保能夠取得該時段所有測項
        format: 'json'
    };

    try {
        console.log(`-> 嘗試獲取時間: ${monitorDate}`);
        const response = await axios.get(BASE_URL, { params });

        // API 成功，回傳 records 列表
        return response.data.records || [];
    } catch (error) {
        console.error(`Error fetching data for ${monitorDate}: ${error.message}`);
        // 發生錯誤時回傳空陣列
        return []; 
    }
}

// ======================= API 路由 (Endpoint) =======================

app.get('/taitung-air-data', async (req, res) => {
    // 檢查 API Key 是否已設定 (如果 API_KEY 依然是空字串，代表未設定)
    if (!API_KEY) {
        return res.status(500).json({ 
            error: "服務配置錯誤：API Key 未設定。",
            guidance: "請在 Zeabur 環境變數或本地 .env 檔案中設定 KEY 為 API_KEY 的值。"
        });
    }


// ==============================================================
// 🎯 新增測試路由：用於檢查 API Key 和單點連線是否正常
// ==============================================================

app.get('/test-single-record', async (req, res) => {
    // 1. 定義測試目標
    const TEST_DATE = "2025-11-26 17:00"; 
    const TEST_SITE = "臺東"; 
    const COUNTY_NAME = '臺東縣'; // 重複定義確保可用，或使用頂部的常量
    const BASE_URL = 'https://data.epa.gov.tw/api/v2/aqx_p_152';
    const API_KEY = process.env.API_KEY || ''; // 確保 API Key 仍從環境變數讀取
    
    // 2. 準備 API 參數
    const params = {
        api_key: API_KEY, 
        sitename: TEST_SITE, 
        county: COUNTY_NAME, 
        monitordate: TEST_DATE,
        limit: 1000, 
        format: 'json'
    };

    if (!API_KEY) {
        return res.status(500).json({ error: "API Key 未設置，無法測試。" });
    }

    try {
        console.log(`-> 執行單點測試：時間 ${TEST_DATE}`);
        
        // 3. 呼叫 API
        const response = await axios.get(BASE_URL, { params });
        const records = response.data.records || [];
        
        // 4. 過濾出 PM2.5 數據（可選）
        const pm25Record = records.find(r => r.itemengname === 'PM2.5');

        res.json({
            status: 'success',
            test_target: `臺東測站 @ ${TEST_DATE}`,
            total_records_found: records.length,
            pm25_record: pm25Record || "未找到 PM2.5 紀錄",
            all_records_for_test: records // 顯示所有數據以便於診斷
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

// ... app.listen(PORT, ...) 啟動伺服器






    const referenceMoment = moment(REFERENCE_TIME_STR, 'YYYY-MM-DD HH:mm');

    if (!referenceMoment.isValid()) {
         return res.status(400).json({ error: "參考時間格式無效，請檢查 REFERENCE_TIME_STR 設定。" });
    }

    // 1. 生成所有目標時間點 (參考時間點的前後 36 小時，共 73 個點)
    const allMonitorTimes = [];
    // 從 -36 小時開始，到 +36 小時結束
    for (let i = -36; i <= 36; i++) {
        // .clone() 避免修改 referenceMoment
        const targetTime = referenceMoment.clone().add(i, 'hours').format('YYYY-MM-DD HH:00');
        allMonitorTimes.push(targetTime);
    }
    
    // 2. 批次呼叫 API
    console.log(`開始批次請求 ${allMonitorTimes.length} 個時間點的數據...`);

    // 建立所有 Promise 請求
    const fetchPromises = allMonitorTimes.map(time => fetchDataByTime(time));
    // 並行執行所有請求
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
        // 顯示時間範圍
        time_range_start: allMonitorTimes[0],
        time_range_end: allMonitorTimes[allMonitorTimes.length - 1],
        // 顯示成功請求的小時數與總紀錄數
        summary: `成功取得 ${successfulRequests} 個小時，共 ${allData.length} 筆測項紀錄。`,
        data: allData
    });
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Access endpoint: http://localhost:${PORT}/taitung-air-data`);
});