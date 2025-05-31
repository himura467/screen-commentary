"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// screenshot-capture/src/index.ts
const robotjs_1 = __importDefault(require("robotjs"));
const ws_1 = __importDefault(require("ws"));
const dotenv_1 = __importDefault(require("dotenv"));
const pngjs_1 = require("pngjs");
dotenv_1.default.config();
const OCR_PROCESSOR_WS_URL = process.env.OCR_PROCESSOR_WS_URL || 'ws://localhost:8081';
const CAPTURE_INTERVAL_MS = parseInt(process.env.CAPTURE_INTERVAL_MS || '1000', 10);
let ocrWs = null;
function connectToOcrProcessor() {
    ocrWs = new ws_1.default(OCR_PROCESSOR_WS_URL);
    ocrWs.onopen = () => {
        console.log('Connected to OCR Processor WebSocket.');
    };
    ocrWs.onclose = () => {
        console.log('Disconnected from OCR Processor WebSocket. Reconnecting in 5 seconds...');
        setTimeout(connectToOcrProcessor, 5000);
    };
    ocrWs.onerror = (error) => {
        console.error('OCR Processor WebSocket error:', error);
    };
}
// OCR プロセスに接続
connectToOcrProcessor();
// スクリーンショットを撮り、OCR プロセスに送信する関数
async function takeScreenshotAndSend() {
    if (!ocrWs || ocrWs.readyState !== ws_1.default.OPEN) {
        console.warn('OCR Processor WebSocket not connected. Skipping screenshot.');
        return;
    }
    try {
        // robotjs でスクリーンショットを撮る
        // `screen.width`, `screen.height` はプライマリスクリーン全体のサイズ
        const screenshot = robotjs_1.default.screen.capture(0, 0, robotjs_1.default.screen.width, robotjs_1.default.screen.height);
        // robotjs の画像データ (Raw RGBA) を PNG に変換
        const png = new pngjs_1.PNG({
            width: screenshot.width,
            height: screenshot.height,
            filterType: -1, // No filter
            colorType: 6 // RGBA
        });
        // robotjs の画像データは BGRx 形式なので、RGBA に変換する必要がある
        for (let i = 0; i < screenshot.image.length; i += 4) {
            png.data[i] = screenshot.image[i + 2]; // Red
            png.data[i + 1] = screenshot.image[i + 1]; // Green
            png.data[i + 2] = screenshot.image[i]; // Blue
            png.data[i + 3] = screenshot.image[i + 3]; // Alpha
        }
        const buffer = await new Promise((resolve, reject) => {
            const chunks = [];
            png.pack()
                .on('data', chunk => chunks.push(chunk))
                .on('end', () => resolve(Buffer.concat(chunks)))
                .on('error', reject);
        });
        // デバッグ用にファイルを保存 (必要なければ削除)
        // const debugPath = `./debug_screenshot_${Date.now()}.png`;
        // await fs.writeFile(debugPath, buffer);
        // console.log(`Debug screenshot saved to ${debugPath}`);
        // 画像データを OCR プロセスに送信
        // WebSocketバイナリメッセージとして直接送信
        ocrWs.send(buffer);
        console.log(`Screenshot captured and sent (${buffer.length} bytes).`);
    }
    catch (error) {
        console.error('Error taking screenshot or sending to OCR processor:', error);
    }
}
// 定期的にスクリーンショットを撮る
setInterval(takeScreenshotAndSend, CAPTURE_INTERVAL_MS);
console.log(`Screenshot capture started. Capturing every ${CAPTURE_INTERVAL_MS}ms.`);
