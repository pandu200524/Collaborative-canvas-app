class CollaborativeCanvasApp {
    constructor() {
        this.canvas = null;
        this.websocket = null;
        this.currentUserColor = '#000000';
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    setup() {
        console.log('Setting up Collaborative Canvas App...');
        
        try {
            this.canvas = new DrawingCanvas('drawingCanvas', 'cursorCanvas');
            this.websocket = new WebSocketManager();
            
            this.setupEventListeners();
            this.setupWebSocketHandlers();
            this.setupUI();
            
            // Connect to WebSocket
            this.websocket.connect();
            
            console.log('✅ App setup complete');
        } catch (error) {
            console.error('❌ App setup failed:', error);
        }
    }
    
    setupEventListeners() {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.target.dataset.tool;
                this.setTool(tool);
            });
        });
        
        // Color picker
        const colorPicker = document.getElementById('colorPicker');
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => {
                this.currentUserColor = e.target.value;
                this.canvas.setColor(this.currentUserColor);
            });
        }
        
        // Brush size
        const brushSize = document.getElementById('brushSize');
        const brushSizeValue = document.getElementById('brushSizeValue');
        if (brushSize && brushSizeValue) {
            brushSize.addEventListener('input', (e) => {
                const size = parseInt(e.target.value);
                brushSizeValue.textContent = `${size}px`;
                this.canvas.setWidth(size);
            });
        }
        
        // Undo/Redo
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) undoBtn.addEventListener('click', () => {
            console.log('Undo button clicked');
            this.websocket.undo();
        });
        if (redoBtn) redoBtn.addEventListener('click', () => {
            console.log('Redo button clicked');
            this.websocket.redo();
        });
        
        // Clear canvas
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                console.log('Clear button clicked');
                if (confirm('Clear the entire canvas for all users?')) {
                    this.websocket.clearCanvas();
                }
            });
        }
        
        // Room management
        const joinRoomBtn = document.getElementById('joinRoomBtn');
        const roomInput = document.getElementById('roomInput');
        if (joinRoomBtn && roomInput) {
            joinRoomBtn.addEventListener('click', () => {
                const roomId = roomInput.value.trim() || 'default';
                console.log('Joining room:', roomId);
                this.websocket.joinRoom(roomId);
            });
        }
    }
    
    setupWebSocketHandlers() {
        // Connection status
        this.websocket.onConnectedCallback(() => {
            this.updateConnectionStatus(true);
        });
        
        this.websocket.onDisconnectedCallback(() => {
            this.updateConnectionStatus(false);
        });
        
        // Drawing events - send to server
        this.canvas.onStrokeStartCallback((stroke) => {
            stroke.userId = this.websocket.getUserId();
            stroke.userColor = this.currentUserColor;
            this.websocket.sendStrokeStart(stroke);
        });
        
        this.canvas.onStrokePointCallback((strokeId, point) => {
            this.websocket.sendStrokePoint(strokeId, point);
        });
        
        this.canvas.onStrokeEndCallback((strokeId) => {
            this.websocket.sendStrokeEnd(strokeId);
        });
        
        // Drawing events - receive from server
        this.websocket.onStrokeStartCallback((stroke) => {
            console.log('Received remote stroke start');
            if (stroke.userId !== this.websocket.getUserId()) {
                this.canvas.addRemoteStroke(stroke);
            }
        });
        
        // Handle undo events - now receives array of strokes
        this.websocket.onUndoCallback((strokes) => {
            console.log('Handling undo for strokes:', strokes);
            if (strokes && strokes.length > 0) {
                strokes.forEach(stroke => {
                    this.canvas.removeStroke(stroke.id);
                });
            }
        });
        
        // Handle redo events - now receives array of strokes
        this.websocket.onRedoCallback((strokes) => {
            console.log('Handling redo for strokes:', strokes);
            if (strokes && strokes.length > 0) {
                strokes.forEach(stroke => {
                    this.canvas.addStroke(stroke);
                });
            }
        });
        
        // Handle canvas cleared events
        this.websocket.onCanvasClearedCallback((data) => {
            console.log('Handling canvas clear event');
            this.canvas.clearAllStrokes();
        });
        
        // User management
        this.websocket.onUserJoinedCallback((user) => {
            this.addUserToUI(user);
        });
        
        this.websocket.onUserLeftCallback((userId) => {
            this.removeUserFromUI(userId);
        });
        
        this.websocket.onRoomStateCallback((state) => {
            console.log('Updating room state with', state.strokes.length, 'strokes');
            this.updateUserList(state.users);
            
            // Clear current strokes and redraw all from room state
            this.canvas.clearAllStrokes();
            state.strokes.forEach(stroke => {
                this.canvas.addStroke(stroke);
            });
        });
    }
    
    setupUI() {
        this.setTool('brush');
        this.updateConnectionStatus(false);
        
        // Set initial brush size display
        const brushSize = document.getElementById('brushSize');
        const brushSizeValue = document.getElementById('brushSizeValue');
        if (brushSize && brushSizeValue) {
            brushSizeValue.textContent = `${brushSize.value}px`;
        }
    }
    
    setTool(tool) {
        // Update active tool button
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-tool="${tool}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        this.canvas.setTool(tool);
    }
    
    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            if (connected) {
                statusElement.textContent = 'Connected';
                statusElement.className = 'connected';
            } else {
                statusElement.textContent = 'Disconnected';
                statusElement.className = 'disconnected';
            }
        }
    }
    
    addUserToUI(user) {
        const userList = document.getElementById('userList');
        if (!userList) return;
        
        const userElement = document.createElement('div');
        userElement.className = 'user-indicator';
        userElement.style.backgroundColor = user.color;
        userElement.title = user.name;
        userElement.dataset.userId = user.id;
        
        userList.appendChild(userElement);
        this.updateUserCount();
    }
    
    removeUserFromUI(userId) {
        const userElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (userElement) {
            userElement.remove();
        }
        this.updateUserCount();
    }
    
    updateUserList(users) {
        const userList = document.getElementById('userList');
        if (!userList) return;
        
        userList.innerHTML = '';
        
        users.forEach(user => {
            this.addUserToUI(user);
        });
    }
    
    updateUserCount() {
        const userCountElement = document.getElementById('userCount');
        if (userCountElement) {
            const userCount = document.querySelectorAll('.user-indicator').length;
            userCountElement.textContent = `${userCount} users online`;
        }
    }
}

// Initialize the app
new CollaborativeCanvasApp();