import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Room management
const rooms = new Map();
const userColors = new Map();
const colorPalette = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

function getUserColor(userId) {
    if (!userColors.has(userId)) {
        const colorIndex = userColors.size % colorPalette.length;
        userColors.set(userId, colorPalette[colorIndex]);
    }
    return userColors.get(userId);
}

function getOrCreateRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            id: roomId,
            users: new Map(),
            strokes: [],
            undoStack: [],
            redoStack: []
        });
        console.log(`Created new room: ${roomId}`);
    }
    return rooms.get(roomId);
}

function getRoomState(roomId) {
    const room = getOrCreateRoom(roomId);
    const users = Array.from(room.users.values()).map(user => ({
        id: user.id,
        name: user.name,
        color: user.color
    }));
    
    return {
        users: users,
        strokes: room.strokes
    };
}

io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);
    
    const userId = socket.handshake.query.userId || socket.id;
    let currentRoomId = socket.handshake.query.roomId || 'default';
    
    let room = getOrCreateRoom(currentRoomId);
    const userColor = getUserColor(userId);
    
    room.users.set(userId, {
        id: userId,
        name: `User${userId.substr(-4)}`,
        color: userColor
    });
    
    socket.join(currentRoomId);
    
    socket.emit('room_state', getRoomState(currentRoomId));
    
    socket.to(currentRoomId).emit('user_joined', {
        id: userId,
        name: `User${userId.substr(-4)}`,
        color: userColor
    });
    
    console.log(`👤 User ${userId} joined room ${currentRoomId}`);
    
    // Drawing events
    socket.on('stroke_start', (data) => {
        const room = getOrCreateRoom(data.roomId || currentRoomId);
        console.log('📝 Stroke start:', data.id, 'in room:', data.roomId);
        
        const stroke = {
            id: data.id,
            userId: data.userId,
            userColor: data.userColor,
            points: data.points,
            color: data.color,
            width: data.width,
            tool: data.tool,
            timestamp: Date.now()
        };
        
        room.strokes.push(stroke);
        
        console.log(`Room ${data.roomId} - Strokes: ${room.strokes.length}, Undo: ${room.undoStack.length}, Redo: ${room.redoStack.length}`);
        
        socket.to(data.roomId).emit('stroke_start', stroke);
    });
    
    socket.on('stroke_point', (data) => {
        const room = getOrCreateRoom(data.roomId || currentRoomId);
        
        // Find the stroke in the room's strokes array and add the point
        const stroke = room.strokes.find(s => s.id === data.strokeId);
        if (stroke && data.point) {
            stroke.points.push(data.point);
            // console.log(`Added point to stroke ${data.strokeId}. Total points: ${stroke.points.length}`);
        } else {
            console.warn('Could not find stroke for point:', data.strokeId);
        }
        
        socket.to(data.roomId).emit('stroke_point', data);
    });
    
    socket.on('stroke_end', (data) => {
        const room = getOrCreateRoom(data.roomId || currentRoomId);
        
        // Find the completed stroke
        const stroke = room.strokes.find(s => s.id === data.strokeId);
        
        if (stroke) {
            console.log('✅ Stroke ended:', data.strokeId, 'with', stroke.points.length, 'points');
            
            // Add the COMPLETED stroke to undo stack
            room.undoStack.push([stroke]);
            room.redoStack = []; // Clear redo stack on new action
            
            console.log(`After stroke_end - Undo: ${room.undoStack.length}, Redo: ${room.redoStack.length}`);
        } else {
            console.error('❌ Stroke not found on stroke_end:', data.strokeId);
        }
        
        socket.to(data.roomId).emit('stroke_end', data);
    });
    
    socket.on('undo', (undoRoomId) => {
        const room = getOrCreateRoom(undoRoomId);
        console.log('↶ Undo requested for room:', undoRoomId);
        console.log(`Before undo - Strokes: ${room.strokes.length}, Undo: ${room.undoStack.length}, Redo: ${room.redoStack.length}`);
        
        if (room.undoStack.length > 0) {
            const lastStrokes = room.undoStack.pop();
            
            // Log what we're undoing
            console.log('Undoing strokes:', lastStrokes.map(s => ({
                id: s.id,
                points: s.points ? s.points.length : 0
            })));
            
            room.redoStack.push(lastStrokes);
            
            for (const stroke of lastStrokes) {
                const index = room.strokes.findIndex(s => s.id === stroke.id);
                if (index !== -1) {
                    room.strokes.splice(index, 1);
                }
            }
            
            console.log(`After undo - Strokes: ${room.strokes.length}, Undo: ${room.undoStack.length}, Redo: ${room.redoStack.length}`);
            
            io.to(undoRoomId).emit('undo', { strokes: lastStrokes });
        } else {
            console.log('No actions to undo');
        }
    });
    
    socket.on('redo', (redoRoomId) => {
        const room = getOrCreateRoom(redoRoomId);
        console.log('↷ Redo requested for room:', redoRoomId);
        console.log(`Before redo - Strokes: ${room.strokes.length}, Undo: ${room.undoStack.length}, Redo: ${room.redoStack.length}`);
        
        if (room.redoStack.length > 0) {
            const redoneStrokes = room.redoStack.pop();
            
            console.log('Redoing strokes:', redoneStrokes.map(s => ({
                id: s.id,
                points: s.points ? s.points.length : 0,
                color: s.color,
                width: s.width,
                tool: s.tool
            })));
            
            // Verify stroke data integrity
            const validStrokes = redoneStrokes.filter(s => {
                if (!s.points || s.points.length === 0) {
                    console.error('❌ Invalid stroke in redo stack:', s.id, '- has no points!');
                    return false;
                }
                return true;
            });
            
            if (validStrokes.length === 0) {
                console.error('❌ No valid strokes to redo!');
                console.log('Redo stack contents:', JSON.stringify(redoneStrokes, null, 2));
                return;
            }
            
            room.undoStack.push(validStrokes);
            room.strokes.push(...validStrokes);
            
            console.log(`After redo - Strokes: ${room.strokes.length}, Undo: ${room.undoStack.length}, Redo: ${room.redoStack.length}`);
            console.log('✅ Emitting redo event to room:', redoRoomId);
            
            io.to(redoRoomId).emit('redo', { strokes: validStrokes });
        } else {
            console.log('❌ No actions to redo - redo stack is empty');
        }
    });
    
    socket.on('clear_canvas', (clearRoomId) => {
        const room = getOrCreateRoom(clearRoomId);
        console.log('🗑️ Clear canvas requested for room:', clearRoomId);
        console.log(`Before clear - Strokes: ${room.strokes.length}, Undo: ${room.undoStack.length}, Redo: ${room.redoStack.length}`);
        
        if (room.strokes.length > 0) {
            room.undoStack.push([...room.strokes]);
            room.redoStack = [];
        }
        room.strokes = [];
        
        console.log(`After clear - Strokes: ${room.strokes.length}, Undo: ${room.undoStack.length}, Redo: ${room.redoStack.length}`);
        
        io.to(clearRoomId).emit('canvas_cleared', { clearedBy: userId });
    });
    
    socket.on('join_room', (newRoomId) => {
        console.log(`🔄 User ${userId} switching from ${currentRoomId} to ${newRoomId}`);
        
        // Leave old room
        const oldRoom = getOrCreateRoom(currentRoomId);
        socket.leave(currentRoomId);
        oldRoom.users.delete(userId);
        socket.to(currentRoomId).emit('user_left', userId);
        
        // Join new room
        currentRoomId = newRoomId;
        const newRoom = getOrCreateRoom(newRoomId);
        socket.join(newRoomId);
        
        newRoom.users.set(userId, {
            id: userId,
            name: `User${userId.substr(-4)}`,
            color: userColor
        });
        
        socket.emit('room_state', getRoomState(newRoomId));
        socket.to(newRoomId).emit('user_joined', {
            id: userId,
            name: `User${userId.substr(-4)}`,
            color: userColor
        });
    });
    
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        const room = getOrCreateRoom(currentRoomId);
        room.users.delete(userId);
        socket.to(currentRoomId).emit('user_left', userId);
        
        if (room.users.size === 0) {
            console.log(`🗑️ Deleting empty room: ${currentRoomId}`);
            rooms.delete(currentRoomId);
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🎨 Collaborative Canvas server running on port ${PORT}`);
    console.log(`👉 Open http://localhost:${PORT} to view the application`);
});