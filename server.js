// server.js - 花東空氣品質預報服務 (優化架構版)

// 載入 .env 檔案中的環境變數
require("dotenv").config(); 
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ======================= API 設定 =======================
// 環境部開放資料平台 API v2 基礎網址
const MOENV_API_BASE_URL = 'https://data.moenv.gov.tw/api/v2/';
// 空氣品質預報資料的 Resource Code
const RESOURCE_CODE = 'aqf_p_01';
// 從環境變數中讀取 API_KEY。注意：我們沿用 API_KEY，而非 CWA_API_KEY
const API_KEY = process.env.API_KEY; 

// 目標篩選區域
const TARGET_AREA = '花東';
// ========================================================


// Middleware (中介層) 設定
// 允許跨域資源共享 (CORS) - 這是上課範例中優化的一步
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/**
 * 核心邏輯函式：取得花東地區的空氣品質預報數據
 * (對應上課範例中的 getTaitungWeather 函式)
 */
const getHuadongAirForecast = async (req, res) => {
  try {
    // 1. 檢查是否有設定 API Key
    if (!API_KEY) {
      return res.status(500).json({
        status: "error",
        message: "服務配置錯誤：API Key 環境變數未設定。",
        guidance: "請在 .env 檔案中設定 API_KEY，並確保 Zeabur 環境變數已設定。",
      });
    }

    // 2. 建構 API 請求
    const API_ENDPOINT = `${MOENV_API_BASE_URL}${RESOURCE_CODE}`;
    const params = {
        api_key: API_KEY,
        limit: 1000, 
        format: 'json'
    };

    // 3. 呼叫外部 API
    const response = await axios.get(API_ENDPOINT, { params });
    const allRecords = response.data.records || [];

    // 4. 篩選出 area 等於 '花東' 的紀錄
    const huadongRecords = allRecords.filter(record => record.area === TARGET_AREA);

    // 5. 整理資料 - 按發布時間排序 (最新的在前面)
    huadongRecords.sort((a, b) => new Date(b.publishtime) - new Date(a.publishtime));

    // 6. 回傳成功結果
    res.json({
      status: 'success',
      source_api: API_ENDPOINT,
      filter_area: TARGET_AREA,
      summary: `成功取得共 ${allRecords.length} 筆紀錄，其中 ${huadongRecords.length} 筆為 ${TARGET_AREA} 預報。`,
      data: huadongRecords.length > 0 ? huadongRecords : "API 連線成功，但目前沒有找到符合『花東』地區的預報紀錄。"
    });

  } catch (error) {
    console.error("取得空氣品質資料失敗:", error.message);
    
    // 錯誤處理：檢查是否為 axios 回應錯誤（如 400, 403, 500 等）
    if (error.response) {
      // API 伺服器回傳了錯誤碼
      return res.status(error.response.status).json({
        status: "api_error",
        message: `環境部 API 錯誤碼 ${error.response.status}`,
        details: error.response.data || "無詳細錯誤訊息",
      });
    }
    
    // 網路連線錯誤 (例如 EAI_AGAIN) 或其他內部錯誤
    res.status(500).json({
      status: "server_error",
      message: "呼叫環境部 API 時發生連線或內部錯誤。",
      detail: error.message
    });
  }
};


// ======================= 路由定義 (Routes) =======================

// 根目錄路由 - 提供服務資訊
app.get("/", (req, res) => {
  res.json({
    message: "歡迎使用花東空氣品質預報 API 服務",
    endpoints: {
      huadong_air_forecast: "/api/air/huadong", // 更改為更結構化的路徑
    },
  });
});

// 健康檢查路由 - 檢查服務是否運行
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// 核心功能路由 - 取得花東空氣品質預報
// 路徑從 /huadong-air-forecast 更改為 /api/air/huadong
app.get("/api/air/huadong", getHuadongAirForecast); 


// ======================= 錯誤處理 (Error Handling) =======================

// 404 處理器 (Handle requests that didn't match any route)
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "找不到此路徑，請檢查 API 端點。",
  });
});

// 統一錯誤處理中介層 (上課範例中的額外保護)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: "error",
    message: "發生無法預期的伺服器錯誤",
    detail: err.message,
  });
});


// 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 伺服器運行已運作`);
  console.log(`📍 測試路徑: http://localhost:${PORT}/api/air/huadong`);
});