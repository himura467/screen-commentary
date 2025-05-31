// ocr-processor/src/index.ts
import { ImageAnnotatorClient } from '@google-cloud/vision';
import WebSocket, { WebSocketServer } from 'ws'; // WebSocketServer も必要
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

dotenv.config();

const client = new ImageAnnotatorClient();

const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'ws://localhost:8080';
let backendWs: WebSocket | null = null;

// OCR プロセス自身が WebSocket サーバーとして画像を待ち受けるポート
const OCR_WS_PORT = process.env.OCR_WS_PORT || 8081;

function connectToBackend() {
    backendWs = new WebSocket(BACKEND_WS_URL);

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
async function performOcrAndSend(imageBuffer: Buffer) {
    try {
        // Vision API で画像からテキストを検出 (直接Bufferを渡す)
        const [result] = await client.textDetection({ image: { content: imageBuffer.toString('base64') } });
        const detections = result.textAnnotations;
        const extractedText = detections && detections.length > 0 ? detections[0].description : '';

        console.log('OCR Extracted Text:', extractedText?.substring(0, 100) + (extractedText?.length! > 100 ? '...' : '')); // 長いテキストは一部表示

        if (backendWs && backendWs.readyState === WebSocket.OPEN) {
            // 抽出したテキストをバックエンドに送信
            backendWs.send(JSON.stringify({ type: 'screenInfo', text: extractedText }));
        } else {
            console.warn('Backend WebSocket is not open. Cannot send OCR result.');
        }
    } catch (error) {
        console.error('Error during OCR:', error);
    }
}

// OCR プロセスがスクリーンショットキャプチャプロセスから画像を受け取るための WebSocket サーバー
const wssOcr = new WebSocketServer({ port: parseInt(OCR_WS_PORT.toString()) });

wssOcr.on('connection', ws => {
    console.log('Screenshot Capture Process connected to OCR WebSocket.');

    ws.on('message', async message => {
        // message は Buffer (バイナリデータ) として送られてくる
        if (Buffer.isBuffer(message)) {
            console.log(`Received image data from screenshot capture process (${message.length} bytes).`);
            await performOcrAndSend(message);
        } else {
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
