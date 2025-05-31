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
// ocr-processor/src/index.ts
const vision_1 = require("@google-cloud/vision");
const ws_1 = __importStar(require("ws")); // WebSocketServer も必要
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client = new vision_1.ImageAnnotatorClient();
const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'ws://localhost:8080';
let backendWs = null;
// OCR プロセス自身が WebSocket サーバーとして画像を待ち受けるポート
const OCR_WS_PORT = process.env.OCR_WS_PORT || 8081;
function connectToBackend() {
    backendWs = new ws_1.default(BACKEND_WS_URL);
    backendWs.onopen = () => {
        console.log('Connected to backend WebSocket server.');
    };
    backendWs.onclose = () => {
        console.log('Disconnected from backend WebSocket server. Reconnecting in 5 seconds...');
        setTimeout(connectToBackend, 5000);
    };
    backendWs.onerror = (error) => {
        console.error('Backend WebSocket error:', error);
    };
}
connectToBackend();
/**
 * 画像データ (Buffer) からテキストを抽出し、バックエンドに送信する関数
 * @param imageBuffer スクリーンショット画像データ (Buffer)
 */
async function performOcrAndSend(imageBuffer) {
    try {
        // Vision API で画像からテキストを検出 (直接Bufferを渡す)
        const [result] = await client.textDetection({ image: { content: imageBuffer.toString('base64') } });
        const detections = result.textAnnotations;
        const extractedText = detections && detections.length > 0 ? detections[0].description : '';
        console.log('OCR Extracted Text:', extractedText?.substring(0, 100) + (extractedText?.length > 100 ? '...' : '')); // 長いテキストは一部表示
        if (backendWs && backendWs.readyState === ws_1.default.OPEN) {
            // 抽出したテキストをバックエンドに送信
            backendWs.send(JSON.stringify({ type: 'screenInfo', text: extractedText }));
        }
        else {
            console.warn('Backend WebSocket is not open. Cannot send OCR result.');
        }
    }
    catch (error) {
        console.error('Error during OCR:', error);
    }
}
// OCR プロセスがスクリーンショットキャプチャプロセスから画像を受け取るための WebSocket サーバー
const wssOcr = new ws_1.WebSocketServer({ port: parseInt(OCR_WS_PORT.toString()) });
wssOcr.on('connection', ws => {
    console.log('Screenshot Capture Process connected to OCR WebSocket.');
    ws.on('message', async (message) => {
        // message は Buffer (バイナリデータ) として送られてくる
        if (Buffer.isBuffer(message)) {
            console.log(`Received image data from screenshot capture process (${message.length} bytes).`);
            await performOcrAndSend(message);
        }
        else {
            console.warn('Received non-binary message from screenshot capture process:', message.toString());
        }
    });
    ws.on('close', () => {
        console.log('Screenshot Capture Process disconnected from OCR WebSocket.');
    });
    ws.on('error', error => {
        console.error('OCR WebSocket server error:', error);
    });
});
console.log(`OCR Processor WebSocket server started on port ${OCR_WS_PORT}`);
