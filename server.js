const express = require("express");
const app = express();
const cors = require('cors');
const server = require("http").Server(app);
const { v4: uuidv4 } = require("uuid");

const io = require("socket.io")(server);
app.use(cors({
	origin: '*'
}));

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
	res.redirect(`/${uuidv4()}`);
});

app.get("/:room", (req, res) => {
	res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
	socket.on("join-room", (roomId, userId, userName) => {
		socket.join(roomId);
		io.to(roomId).emit("user-connected", userId);
		socket.on('disconnect', () => {
	      	io.to(roomId).emit('user-disconnected', userId);
	    })
		socket.on("message", (message) => {
			io.to(roomId).emit("createMessage", message, userName);
		});
	});
});

server.listen(3000);