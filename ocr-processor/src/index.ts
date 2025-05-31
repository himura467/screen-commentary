// ocr-processor/src/index.ts
import { ImageAnnotatorClient } from '@google-cloud/vision';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

dotenv.config();

// Google Cloud Vision API クライアントの初期化
// GOOGLE_APPLICATION_CREDENTIALS 環境変数が自動的に認証情報を読み込みます
const client = new ImageAnnotatorClient();

const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'ws://localhost:8080';
let backendWs: WebSocket | null = null;

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
 * 画像ファイルからテキストを抽出し、バックエンドに送信する関数
 * @param imagePath スクリーンショット画像のパス
 */
async function performOcrAndSend(imagePath: string) {
    if (!fs.existsSync(imagePath)) {
        console.error(`Image file not found: ${imagePath}`);
        return;
    }

    try {
        // Vision API で画像からテキストを検出
        const [result] = await client.textDetection(imagePath);
        const detections = result.textAnnotations;
        const extractedText = detections && detections.length > 0 ? detections[0].description : '';

        console.log('OCR Extracted Text:', extractedText);

        if (backendWs && backendWs.readyState === WebSocket.OPEN) {
            // 抽出したテキストをバックエンドに送信
            backendWs.send(JSON.stringify({ type: 'screenInfo', text: extractedText }));
        } else {
            console.warn('Backend WebSocket is not open. Cannot send OCR result.');
        }
    } catch (error) {
        console.error('Error during OCR:', error);
    } finally {
        // 処理後、画像を削除することも検討
        // await fs.remove(imagePath);
    }
}

// --- OCR プロセスがスクリーンショットをどのように受け取るか ---

// 1. HTTP エンドポイントで画像を受け取る場合 (例: OBS スクリプトから POST で送信)
// バックエンドの index.ts とは別のポートでリッスンさせる
const express = require('express'); // import express from 'express';
const app = express();
const ocrListenPort = process.env.OCR_LISTEN_PORT || 8081;

app.use(express.json({ limit: '10mb' })); // 大きな画像データに対応
app.use(express.raw({ type: 'image/*', limit: '10mb' })); // 画像バイナリを受け取る場合

app.post('/ocr/process-image', async (req, res) => {
    if (!req.body) {
        return res.status(400).send('No image data provided.');
    }

    const imageBuffer = req.body; // 画像データ (Buffer)
    const tempImagePath = path.join(__dirname, `temp_screenshot_${Date.now()}.png`); // 一時ファイル名

    try {
        await fs.writeFile(tempImagePath, imageBuffer);
        await performOcrAndSend(tempImagePath);
        res.status(200).send('OCR processed successfully.');
    } catch (error) {
        console.error('Error receiving or processing image:', error);
        res.status(500).send('Failed to process image.');
    } finally {
        // 一時ファイルを削除
        await fs.remove(tempImagePath).catch(err => console.error("Error removing temp file:", err));
    }
});

app.listen(parseInt(ocrListenPort.toString()), () => {
    console.log(`OCR Processor HTTP server listening on port ${ocrListenPort}`);
    console.log(`Send POST request to http://localhost:${ocrListenPort}/ocr/process-image with image data.`);
});


// 2. 特定のフォルダを監視し、新しい画像が置かれたら OCR を実行する (非推奨: ポーリングは非効率)
/*
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots'); // スクリーンショットが保存されるディレクトリ
fs.ensureDirSync(SCREENSHOT_DIR); // ディレクトリが存在しない場合は作成

fs.watch(SCREENSHOT_DIR, async (eventType, filename) => {
    if (filename && eventType === 'rename') { // ファイルが新しく作成されたことを検出
        const fullPath = path.join(SCREENSHOT_DIR, filename);
        // ファイルの書き込みが完了するまで少し待つ
        await new Promise(resolve => setTimeout(resolve, 500));
        if (fs.existsSync(fullPath)) {
            console.log(`New screenshot detected: ${fullPath}`);
            performOcrAndSend(fullPath);
        }
    }
});
console.log(`Monitoring directory for screenshots: ${SCREENSHOT_DIR}`);
*/
