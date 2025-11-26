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