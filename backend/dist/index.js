"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/index.ts
const ws_1 = require("ws");
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express")); // 必要に応じて
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const wsPort = process.env.WS_PORT || 8080;
// Gemini APIの設定
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in .env file.");
    process.exit(1);
}
const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
// WebSocketサーバーの設定
const wss = new ws_1.WebSocketServer({ port: parseInt(wsPort.toString()) });
wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');
    ws.on('message', async (message) => {
        console.log('Received from client:', message.toString());
        const screenInfo = message.toString(); // クライアントから送られてきた画面情報
        try {
            // Gemini APIを呼び出して実況テキストを生成
            const prompt = `以下のPC画面の情報に基づいて、面白く、簡潔な実況コメントを生成してください。
            情報: ${screenInfo}
            `;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const commentary = response.text();
            console.log('Generated commentary:', commentary);
            ws.send(commentary); // 実況テキストをクライアントに送信
        }
        catch (error) {
            console.error('Error generating commentary:', error);
            ws.send('エラーが発生しました。');
        }
    });
    ws.on('close', () => {
        console.log('Client disconnected from WebSocket.');
    });
    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});
console.log(`WebSocket server started on port ${wsPort}`);
// 必要に応じてHTTPサーバーも起動
app.get('/', (req, res) => {
    res.send('AI Live Commentary Backend is running!');
});
app.listen(port, () => {
    console.log(`HTTP server started on port ${port}`);
});
