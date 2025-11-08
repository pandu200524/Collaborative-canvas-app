class DrawingCanvas {
    constructor(canvasId, cursorCanvasId) {
        this.canvas = document.getElementById(canvasId);
        this.cursorCanvas = document.getElementById(cursorCanvasId);
        
        this.ctx = this.canvas.getContext('2d');
        this.cursorCtx = this.cursorCanvas.getContext('2d');
        
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokes = new Map(); // Store all strokes by ID
        this.userCursors = new Map();
        
        this.currentTool = 'brush';
        this.currentColor = '#000000';
        this.currentWidth = 5;
        
        this.onStrokeStart = null;
        this.onStrokePoint = null;
        this.onStrokeEnd = null;
        
        this.setupEventListeners();
        this.resizeCanvases();
        this.setupCanvasStyle();
        
        console.log('Canvas initialized');
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        window.addEventListener('resize', this.resizeCanvases.bind(this));
    }
    
    setupCanvasStyle() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalCompositeOperation = 'source-over';
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    resizeCanvases() {
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.cursorCanvas.width = rect.width;
        this.cursorCanvas.height = rect.height;
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.redrawAllStrokes();
    }
    
    getCanvasPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    handleMouseDown(e) {
        e.preventDefault();
        console.log('Mouse down - starting stroke');
        this.startStroke(this.getCanvasPoint(e.clientX, e.clientY));
    }
    
    startStroke(point) {
        this.isDrawing = true;
        
        const stroke = {
            id: Date.now().toString() + Math.random().toString(36).substr(2),
            userId: 'local',
            userColor: this.currentColor,
            points: [point],
            color: this.currentTool === 'eraser' ? '#FFFFFF' : this.currentColor,
            width: this.currentWidth,
            tool: this.currentTool,
            timestamp: Date.now()
        };
        
        this.currentStroke = stroke;
        this.strokes.set(stroke.id, stroke);
        
        console.log('Stroke started:', stroke.id);
        
        if (this.onStrokeStart) {
            this.onStrokeStart(stroke);
        }
        
        this.drawStrokePoint(stroke, point);
    }
    
    handleMouseMove(e) {
        const point = this.getCanvasPoint(e.clientX, e.clientY);
        
        if (this.isDrawing && this.currentStroke) {
            this.addPointToStroke(point);
        }
    }
    
    addPointToStroke(point) {
        if (!this.currentStroke) return;
        
        this.currentStroke.points.push(point);
        
        this.drawStrokePoint(this.currentStroke, point);
        
        if (this.onStrokePoint) {
            this.onStrokePoint(this.currentStroke.id, point);
        }
    }
    
    drawStrokePoint(stroke, point) {
        const points = stroke.points;
        if (points.length < 2) {
            this.ctx.beginPath();
            this.ctx.fillStyle = stroke.color;
            this.ctx.arc(point.x, point.y, stroke.width / 2, 0, Math.PI * 2);
            this.ctx.fill();
            return;
        }
        
        const lastPoint = points[points.length - 2];
        const currentPoint = points[points.length - 1];
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
        
        this.ctx.moveTo(lastPoint.x, lastPoint.y);
        this.ctx.lineTo(currentPoint.x, currentPoint.y);
        this.ctx.stroke();
    }
    
    handleMouseUp() {
        console.log('Mouse up - ending stroke');
        this.endStroke();
    }
    
    handleMouseLeave() {
        this.endStroke();
    }
    
    endStroke() {
        if (this.isDrawing && this.currentStroke) {
            this.isDrawing = false;
            console.log('Stroke ended:', this.currentStroke.id, 'with', this.currentStroke.points.length, 'points');
            if (this.onStrokeEnd) {
                this.onStrokeEnd(this.currentStroke.id);
            }
            this.currentStroke = null;
        }
    }
    
    addRemoteStroke(stroke) {
        console.log('Adding remote stroke:', stroke.id);
        this.strokes.set(stroke.id, stroke);
        this.drawCompleteStroke(stroke);
    }
    
    drawCompleteStroke(stroke) {
        if (!stroke || !stroke.points || stroke.points.length < 1) {
            console.warn('Cannot draw stroke - invalid data:', stroke);
            return;
        }
        
        console.log('Drawing complete stroke:', stroke.id, 'with', stroke.points.length, 'points');
        
        // Set canvas properties
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.width;
        this.ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
        
        this.ctx.beginPath();
        const firstPoint = stroke.points[0];
        this.ctx.moveTo(firstPoint.x, firstPoint.y);
        
        for (let i = 1; i < stroke.points.length; i++) {
            this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        
        this.ctx.stroke();
        
        // Reset to default
        this.ctx.globalCompositeOperation = 'source-over';
    }
    
    redrawAllStrokes() {
        console.log('Redrawing all strokes. Total:', this.strokes.size);
        
        // Clear canvas with white background
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw all strokes in order
        for (const stroke of this.strokes.values()) {
            this.drawCompleteStroke(stroke);
        }
    }

    removeStroke(strokeId) {
        console.log('Removing stroke:', strokeId);
        if (this.strokes.has(strokeId)) {
            this.strokes.delete(strokeId);
            this.redrawAllStrokes();
        } else {
            console.warn('Stroke not found for removal:', strokeId);
        }
    }

    addStroke(stroke) {
        console.log('Adding stroke:', stroke.id, 'Points:', stroke.points ? stroke.points.length : 'NONE');
        
        if (!stroke || !stroke.id) {
            console.error('Invalid stroke - missing id:', stroke);
            return;
        }
        
        if (!stroke.points || stroke.points.length === 0) {
            console.error('Invalid stroke - no points:', stroke);
            return;
        }
        
        // Add to strokes map
        this.strokes.set(stroke.id, stroke);
        
        // Force a complete redraw to ensure proper rendering
        this.redrawAllStrokes();
    }

    clearAllStrokes() {
        console.log('Clearing all strokes');
        this.strokes.clear();
        this.redrawAllStrokes();
    }
    
    setTool(tool) {
        this.currentTool = tool;
        console.log('Tool set to:', tool);
    }
    
    setColor(color) {
        this.currentColor = color;
        console.log('Color set to:', color);
    }
    
    setWidth(width) {
        this.currentWidth = width;
        console.log('Width set to:', width);
    }
    
    clearCanvas() {
        this.clearAllStrokes();
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
}