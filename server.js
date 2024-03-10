const express = require('express');
const app = express();
const cors = require('cors');
const server = require('http').Server(app);
const { v4: uuidv4 } = require('uuid');

const marked = require('marked');
const xss = require('xss');

const io = require('socket.io')(server);
app.use(
	cors({
		origin: '*'
	})
);

app.set('view engine', 'ejs');
app.use(express.static('public'));

//url routes
app.get('/', (req, res) => {
	res.render('home');
});

app.get('/call-ended', (req, res) => {
	res.render('call-ended');
});

app.get('/new-room', (req, res) => {
	res.redirect(`/${uuidv4()}`);
});

app.get('/:room', (req, res) => {
	res.render('room', { roomId: req.params.room });
});

//socket functions for talking to rooms
io.on('connection', (socket) => {
	socket.on('join-room', (roomId) => {
		socket.join(roomId);
		socket.broadcast.emit('sync-data-req', socket.id);
	});
	socket.on('call-ended', (userId) => {
		socket.broadcast.emit('user-disconnected', userId);
	});
	socket.on('sync-data-res', (socketId, timer, agendaCache) => {
		io.to(socketId).emit('data-init', timer, agendaCache);
	});
	socket.on('message', (roomId, message, userName) => {
		io.to(roomId).emit('create-message', message, userName);
	});
	socket.on('new-agenda', (roomId, agendaItem, userName) => {
		io.to(roomId).emit('add-agenda', xss(marked.parse(agendaItem)), JSON.stringify(agendaItem), userName, uuidv4());
	});
	socket.on('modify-agenda', (roomId, agendaId, agendaItem) => {
		io.to(roomId).emit('edit-agenda', xss(marked.parse(agendaItem)), JSON.stringify(agendaItem), agendaId);
	});
	socket.on('delete-agenda', (agendaId) => {
		socket.broadcast.emit('remove-agenda', agendaId);
	});
	socket.on('complete-agenda', (agendaId) => {
		socket.broadcast.emit('finish-agenda', agendaId);
	});
	socket.on('connection-request', (userId, userName) => {
		socket.broadcast.emit('new-user-connected', userId, userName);
	});
	socket.on('updated-peer-list', (peerList) => {
		socket.broadcast.emit('new-peer-list', peerList);
	});
});

//bind to port 3000
server.listen(3000);
