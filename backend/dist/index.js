"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/index.ts
const ws_1 = __importStar(require("ws"));
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express")); // 必要に応じて
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const wsPort = process.env.WS_PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in .env file.");
    process.exit(1);
}
const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const wss = new ws_1.WebSocketServer({ port: parseInt(wsPort.toString()) });
// 接続しているクライアントを管理するセット
const clients = new Set();
wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');
    clients.add(ws); // 新しいクライアントをセットに追加
    ws.on('message', async (message) => {
        const messageString = message.toString();
        console.log('[BACKEND] Received from client/OCR:', messageString);
        let screenInfo = '';
        try {
            const parsedMessage = JSON.parse(messageString);
            if (parsedMessage.type === 'screenInfo' && typeof parsedMessage.text === 'string') {
                screenInfo = parsedMessage.text;
            }
            else {
                // 想定外の形式、またはOBS Browser Sourceからの直接メッセージとして扱う
                screenInfo = messageString;
            }
        }
        catch (e) {
            screenInfo = messageString;
        }
        if (!screenInfo) {
            console.log('[BACKEND] No valid screen information received for commentary generation.');
            return;
        }
        try {
            const prompt = `以下のPC画面の情報を元に、短く、面白く、魅力的な実況コメントを生成してください。
            情報: ${screenInfo}
            `;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const commentary = response.text();
            console.log('[BACKEND] Generated commentary:', commentary);
            // 生成されたコメントを接続しているすべてのクライアントにブロードキャスト
            clients.forEach(client => {
                if (client.readyState === ws_1.default.OPEN) {
                    client.send(commentary);
                    console.log(`[BACKEND] Commentary sent to client: "${commentary.substring(0, 50)}..."`);
                }
            });
        }
        catch (error) {
            console.error('[BACKEND] Error generating commentary:', error);
            // エラーを接続しているすべてのクライアントにブロードキャスト
            clients.forEach(client => {
                if (client.readyState === ws_1.default.OPEN) {
                    client.send('AI実況生成中にエラーが発生しました。');
                }
            });
        }
    });
    ws.on('close', () => {
        console.log('Client disconnected from WebSocket.');
        clients.delete(ws); // クライアントが切断されたらセットから削除
    });
    ws.on('error', error => {
        console.error('WebSocket error:', error);
    });
});
console.log(`WebSocket server started on port ${wsPort}`);
app.get('/', (req, res) => {
    res.send('AI Live Commentary Backend is running!');
});
app.listen(port, () => {
    console.log(`HTTP server started on port ${port}`);
});
