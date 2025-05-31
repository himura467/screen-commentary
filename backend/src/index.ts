// backend/src/index.ts
import WebSocket, { WebSocketServer } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import express from 'express'; // 必要に応じて

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const wsPort = process.env.WS_PORT || 8080;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in .env file.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const wss = new WebSocketServer({ port: parseInt(wsPort.toString()) });

// 接続しているクライアントを管理するセット
const clients = new Set<WebSocket>();

wss.on('connection', ws => {
    console.log('Client connected to WebSocket.');
    clients.add(ws); // 新しいクライアントをセットに追加

    ws.on('message', async message => {
        const messageString = message.toString();
        console.log('[BACKEND] Received from client/OCR:', messageString);

        let screenInfo = '';
        try {
            const parsedMessage = JSON.parse(messageString);
            if (parsedMessage.type === 'screenInfo' && typeof parsedMessage.text === 'string') {
                screenInfo = parsedMessage.text;
            } else {
                // 想定外の形式、またはOBS Browser Sourceからの直接メッセージとして扱う
                screenInfo = messageString;
            }
        } catch (e) {
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
                if (client.readyState === WebSocket.OPEN) {
                    client.send(commentary);
                    console.log(`[BACKEND] Commentary sent to client: "${commentary.substring(0, 50)}..."`);
                }
            });

        } catch (error) {
            console.error('[BACKEND] Error generating commentary:', error);
            // エラーを接続しているすべてのクライアントにブロードキャスト
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
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
