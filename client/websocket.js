class WebSocketManager {
    constructor() {
        this.socket = null;
        this.roomId = 'default';
        this.userId = 'user_' + Math.random().toString(36).substr(2, 9);
        
        this.onUserJoined = null;
        this.onUserLeft = null;
        this.onStrokeStart = null;
        this.onStrokePoint = null;
        this.onStrokeEnd = null;
        this.onCursorMove = null;
        this.onRoomState = null;
        this.onConnected = null;
        this.onDisconnected = null;
        this.onUndo = null;
        this.onRedo = null;
        this.onCanvasCleared = null;
    }
    
    connect() {
        console.log('Connecting to server...');
        this.socket = io({
            query: {
                userId: this.userId,
                roomId: this.roomId
            }
        });
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (!this.socket) return;
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to server with socket ID:', this.socket.id);
            if (this.onConnected) {
                this.onConnected();
            }
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            if (this.onDisconnected) {
                this.onDisconnected();
            }
        });
        
        this.socket.on('user_joined', (user) => {
            console.log('User joined:', user);
            if (this.onUserJoined) {
                this.onUserJoined(user);
            }
        });
        
        this.socket.on('user_left', (userId) => {
            console.log('User left:', userId);
            if (this.onUserLeft) {
                this.onUserLeft(userId);
            }
        });
        
        this.socket.on('stroke_start', (stroke) => {
            console.log('Remote stroke start received:', stroke.id);
            if (this.onStrokeStart) {
                this.onStrokeStart(stroke);
            }
        });
        
        this.socket.on('stroke_point', (data) => {
            if (this.onStrokePoint) {
                this.onStrokePoint(data);
            }
        });
        
        this.socket.on('stroke_end', (data) => {
            if (this.onStrokeEnd) {
                this.onStrokeEnd(data);
            }
        });
        
        this.socket.on('room_state', (state) => {
            console.log('Room state received:', state.strokes.length, 'strokes,', state.users.length, 'users');
            if (this.onRoomState) {
                this.onRoomState(state);
            }
        });
        
        // Handle undo events - now receives batch of strokes
        this.socket.on('undo', (data) => {
            console.log('Undo event received for strokes:', data.strokes.map(s => s.id));
            if (this.onUndo) {
                this.onUndo(data.strokes);
            }
        });
        
        // Handle redo events - now receives batch of strokes
        this.socket.on('redo', (data) => {
            console.log('Redo event received for strokes:', data.strokes.map(s => ({ id: s.id, points: s.points ? s.points.length : 0 })));
            if (this.onRedo) {
                this.onRedo(data.strokes);
            }
        });
        
        // Handle canvas cleared events
        this.socket.on('canvas_cleared', (data) => {
            console.log('Canvas cleared event received. Cleared by:', data.clearedBy);
            if (this.onCanvasCleared) {
                this.onCanvasCleared(data);
            }
        });
    }
    
    joinRoom(roomId) {
        this.roomId = roomId;
        if (this.socket) {
            console.log('Requesting to join room:', roomId);
            this.socket.emit('join_room', roomId);
        }
    }
    
    sendStrokeStart(stroke) {
        if (this.socket) {
            console.log('Sending stroke start:', stroke.id);
            this.socket.emit('stroke_start', {
                ...stroke,
                roomId: this.roomId
            });
        }
    }
    
    sendStrokePoint(strokeId, point) {
        if (this.socket) {
            this.socket.emit('stroke_point', {
                strokeId,
                point,
                roomId: this.roomId
            });
        }
    }
    
    sendStrokeEnd(strokeId) {
        if (this.socket) {
            console.log('Sending stroke end:', strokeId);
            this.socket.emit('stroke_end', {
                strokeId,
                roomId: this.roomId
            });
        }
    }
    
    undo() {
        if (this.socket) {
            console.log('Requesting undo for room:', this.roomId);
            this.socket.emit('undo', this.roomId);
        }
    }
    
    redo() {
        if (this.socket) {
            console.log('Requesting redo for room:', this.roomId);
            this.socket.emit('redo', this.roomId);
        }
    }
    
    clearCanvas() {
        if (this.socket) {
            console.log('Requesting clear canvas for room:', this.roomId);
            this.socket.emit('clear_canvas', this.roomId);
        }
    }
    
    // Getters
    getUserId() {
        return this.userId;
    }
    
    getRoomId() {
        return this.roomId;
    }
    
    // Event handlers
    onUserJoinedCallback(callback) {
        this.onUserJoined = callback;
    }
    
    onUserLeftCallback(callback) {
        this.onUserLeft = callback;
    }
    
    onStrokeStartCallback(callback) {
        this.onStrokeStart = callback;
    }
    
    onStrokePointCallback(callback) {
        this.onStrokePoint = callback;
    }
    
    onStrokeEndCallback(callback) {
        this.onStrokeEnd = callback;
    }
    
    onRoomStateCallback(callback) {
        this.onRoomState = callback;
    }
    
    onConnectedCallback(callback) {
        this.onConnected = callback;
    }
    
    onDisconnectedCallback(callback) {
        this.onDisconnected = callback;
    }
    
    // Undo/Redo event handlers - now accept arrays of strokes
    onUndoCallback(callback) {
        this.onUndo = callback;
    }
    
    onRedoCallback(callback) {
        this.onRedo = callback;
    }
    
    onCanvasClearedCallback(callback) {
        this.onCanvasCleared = callback;
    }
}