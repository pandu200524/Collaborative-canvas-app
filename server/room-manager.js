export class RoomManager {
    constructor() {
        this.rooms = new Map();
        this.userColors = new Map();
        this.colorPalette = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
    }
    
    joinRoom(roomId, userId, socket) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                users: new Map(),
                strokes: [],
                undoStack: [],
                redoStack: []
            });
        }
        
        const room = this.rooms.get(roomId);
        const userColor = this.getUserColor(userId);
        
        const user = {
            id: userId,
            name: `User${userId.substr(-4)}`,
            color: userColor,
            socket: socket
        };
        
        room.users.set(userId, user);
        socket.join(roomId);
        
        console.log(`User ${userId} joined room ${roomId}`);
    }
    
    leaveRoom(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.users.delete(userId);
            
            // Remove room if empty
            if (room.users.size === 0) {
                this.rooms.delete(roomId);
            }
        }
    }
    
    addStroke(roomId, strokeData) {
        const room = this.rooms.get(roomId);
        if (room) {
            const stroke = {
                id: strokeData.id,
                userId: strokeData.userId,
                userColor: strokeData.userColor,
                points: strokeData.points,
                color: strokeData.color,
                width: strokeData.width,
                tool: strokeData.tool,
                timestamp: Date.now()
            };
            
            room.strokes.push(stroke);
            
            // Add to undo stack as a single operation
            room.undoStack.push([stroke]);
            room.redoStack = []; // Clear redo stack on new action
        }
    }
    
    completeStroke(roomId, strokeId) {
        // Could be used for additional processing when stroke is complete
    }
    
    undo(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room || room.undoStack.length === 0) return null;
        
        const lastStrokes = room.undoStack.pop();
        room.redoStack.push(lastStrokes);
        
        // Remove strokes from current state
        for (const stroke of lastStrokes) {
            const index = room.strokes.findIndex(s => s.id === stroke.id);
            if (index !== -1) {
                room.strokes.splice(index, 1);
            }
        }
        
        return lastStrokes[0]; // Return first stroke for identification
    }
    
    redo(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (!room || room.redoStack.length === 0) return null;
        
        const redoneStrokes = room.redoStack.pop();
        room.undoStack.push(redoneStrokes);
        
        // Add strokes back to current state
        room.strokes.push(...redoneStrokes);
        
        return redoneStrokes[0];
    }
    
    clearCanvas(roomId, userId) {
        const room = this.rooms.get(roomId);
        if (room) {
            // Save current state to undo stack
            if (room.strokes.length > 0) {
                room.undoStack.push([...room.strokes]);
                room.redoStack = [];
            }
            
            room.strokes = [];
        }
    }
    
    getRoomState(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return { users: [], strokes: [] };
        }
        
        return {
            users: Array.from(room.users.values()),
            strokes: room.strokes
        };
    }
    
    getUserColor(userId) {
        if (!this.userColors.has(userId)) {
            const colorIndex = this.userColors.size % this.colorPalette.length;
            this.userColors.set(userId, this.colorPalette[colorIndex]);
        }
        return this.userColors.get(userId);
    }
    
    getRoomCount() {
        return this.rooms.size;
    }
}