"use strict";
// frontend/script.ts
const commentaryText = document.getElementById('commentary-text');
const wsUrl = 'ws://localhost:8080'; // バックエンドのWebSocket URL
let ws;
function connectWebSocket() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
        console.log('Connected to WebSocket server.');
        commentaryText.textContent = 'AI接続完了、情報入力待ち...';
        // 例: 5秒ごとにダミー情報を送信
        setInterval(() => {
            const dummyScreenInfo = `現在時刻: ${new Date().toLocaleTimeString()}。
            何か特定のアプリケーションが実行中...。
            （実際にはここにOBSのキャプチャ情報を入力）
            `;
            // ws.send(dummyScreenInfo); // 実際のアプリケーションでは、ここに実際の画面情報が来る
        }, 5000);
    };
    ws.onmessage = event => {
        console.log('Received from server:', event.data);
        commentaryText.textContent = event.data;
    };
    ws.onclose = () => {
        console.log('Disconnected from WebSocket server. Reconnecting in 5 seconds...');
        commentaryText.textContent = 'AI接続切断、再接続中...';
        setTimeout(connectWebSocket, 5000); // 5秒後に再接続を試みる
    };
    ws.onerror = error => {
        console.error('WebSocket error:', error);
        commentaryText.textContent = 'WebSocketエラーが発生しました。';
    };
}
connectWebSocket();
// 画面情報を手動で送信する例 (デバッグ用)
function sendScreenInfoManually(info) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(info);
    }
    else {
        console.warn("WebSocket is not open. Cannot send info.");
    }
}
// デバッグのためにウィンドウにグローバル関数として公開
window.sendScreenInfoManually = sendScreenInfoManually;
