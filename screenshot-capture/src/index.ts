// screenshot-capture/src/index.ts
import robot from 'robotjs';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { PNG } from 'pngjs';
import fs from 'fs-extra'; // デバッグ用

dotenv.config();

const OCR_PROCESSOR_WS_URL = process.env.OCR_PROCESSOR_WS_URL || 'ws://localhost:8081';
const CAPTURE_INTERVAL_MS = parseInt(process.env.CAPTURE_INTERVAL_MS || '1000', 10);

let ocrWs: WebSocket | null = null;

function connectToOcrProcessor() {
    ocrWs = new WebSocket(OCR_PROCESSOR_WS_URL);

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
    if (!ocrWs || ocrWs.readyState !== WebSocket.OPEN) {
        console.warn('OCR Processor WebSocket not connected. Skipping screenshot.');
        return;
    }

    try {
        // robotjs でスクリーンショットを撮る
        // robot.getScreenSize() を使用して画面の幅と高さを取得します
        const screenSize = robot.getScreenSize();
        const width = screenSize.width;
        const height = screenSize.height;

        const screenshot = robot.screen.capture(0, 0, width, height);

        // robotjs の画像データ (Raw RGBA) を PNG に変換
        const png = new PNG({
            width: screenshot.width,
            height: screenshot.height,
            filterType: -1, // No filter
            colorType: 6 // RGBA
        });

        // robotjs の画像データは BGRx 形式なので、RGBA に変換する必要がある
        // BGRx to RGBA
        for (let i = 0; i < screenshot.image.length; i += 4) {
            png.data[i] = screenshot.image[i + 2];     // Red
            png.data[i + 1] = screenshot.image[i + 1]; // Green
            png.data[i + 2] = screenshot.image[i];     // Blue
            png.data[i + 3] = screenshot.image[i + 3]; // Alpha
        }

        const buffer = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
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

    } catch (error) {
        console.error('Error taking screenshot or sending to OCR processor:', error);
    }
}

// 定期的にスクリーンショットを撮る
setInterval(takeScreenshotAndSend, CAPTURE_INTERVAL_MS);
console.log(`Screenshot capture started. Capturing every ${CAPTURE_INTERVAL_MS}ms.`);
