// frontend/script.ts
const commentaryText = document.getElementById('commentary-text') as HTMLParagraphElement;
const wsUrl = 'ws://localhost:8080'; // バックエンドのWebSocket URL

let ws: WebSocket;

function connectWebSocket() {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to WebSocket server.');
        commentaryText.textContent = 'AI接続完了、実況を待機中...';
        // 画面情報は、robotjs -> OCR Processor -> Backend 経由でやってきます。
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
