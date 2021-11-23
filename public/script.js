const socket = io.connect('/');
const videoGrid = document.getElementById("video-grid");
const showChat = document.querySelector("#showChat");
const backBtn = document.querySelector(".header__back");
const myVideo = document.createElement("video");
myVideo.muted = true;

var peers = {};

backBtn.addEventListener("click", () => {
	document.querySelector(".main__left").style.display = "flex";
	document.querySelector(".main__left").style.flex = "1";
	document.querySelector(".main__right").style.display = "none";
	document.querySelector(".header__back").style.display = "none";
});

showChat.addEventListener("click", () => {
	document.querySelector(".main__right").style.display = "flex";
	document.querySelector(".main__right").style.flex = "1";
	document.querySelector(".main__left").style.display = "none";
	document.querySelector(".header__back").style.display = "block";
});

const user = prompt("Enter your name");
var myId;

var myPeer = new Peer(undefined, {
	host: 'mochapeer.herokuapp.com',
	secure: true
});

var myVideoStream;
navigator.mediaDevices.getUserMedia({
	audio: true,
	video: true,
}).then((stream) => {
	myVideoStream = stream;
	addVideoStream(myVideo, stream);

	socket.on('new-user-connected', (userId) => {
		if (userId != myId) {
			connectToNewUser(userId, stream);
		}
	});

	socket.emit('connection-request', ROOM_ID, myId);
});

myPeer.on("call", (call) => {
	call.answer(myVideoStream);
	const video = document.createElement("video");
	
	call.on("stream", (userVideoStream) => {
		addVideoStream(video, userVideoStream);
	});
});

socket.on('user-disconnected', (userId) => {
	document.getElementById(userId).outerHTML = "";
	if (peers[userId]) peers[userId].close();
});

myPeer.on("open", (id) => {
	myId = id;
	socket.emit("join-room", ROOM_ID);
});

function connectToNewUser(userId, stream) {
	const call = myPeer.call(userId, stream);
	const video = document.createElement("video");
	video.setAttribute('id', userId);

	call.on("stream", (userVideoStream) => {
		addVideoStream(video, userVideoStream);
	});
	// call.on('close', () => {
	//     document.getElementById(userId).outerHTML = "";
	// });

	peers[userId] = call;
}

function addVideoStream(video, stream) {
	video.srcObject = stream;
	video.addEventListener("loadedmetadata", () => {
		video.play();
	});
	videoGrid.append(video);
}

window.addEventListener('beforeunload'), (e) => {
	e.preventDefault();
	socket.emit('call-ended', ROOM_ID, myId);
}

let text = document.querySelector("#chat_message");
let send = document.getElementById("send");
let messages = document.querySelector(".messages");

send.addEventListener("click", (e) => {
	if (text.value.length !== 0) {
		socket.emit("message", ROOM_ID, text.value, user);
		text.value = "";
	}
});

text.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && text.value.length !== 0) {
		socket.emit("message", ROOM_ID, text.value, user);
		text.value = "";
	}
});

const inviteButton = document.querySelector("#inviteButton");
const muteButton = document.querySelector("#muteButton");
const stopVideo = document.querySelector("#stopVideo");

muteButton.addEventListener("click", () => {
	const enabled = myVideoStream.getAudioTracks()[0].enabled;
	if (enabled) {
		myVideoStream.getAudioTracks()[0].enabled = false;
		html = `<i class="fas fa-microphone-slash"></i>`;
		muteButton.classList.toggle("background__red");
		muteButton.innerHTML = html;
	} else {
		myVideoStream.getAudioTracks()[0].enabled = true;
		html = `<i class="fas fa-microphone"></i>`;
		muteButton.classList.toggle("background__red");
		muteButton.innerHTML = html;
	}
});

stopVideo.addEventListener("click", () => {
	const enabled = myVideoStream.getVideoTracks()[0].enabled;
	if (enabled) {
		myVideoStream.getVideoTracks()[0].enabled = false;
		html = `<i class="fas fa-video-slash"></i>`;
		stopVideo.classList.toggle("background__red");
		stopVideo.innerHTML = html;
	} else {
		myVideoStream.getVideoTracks()[0].enabled = true;
		html = `<i class="fas fa-video"></i>`;
		stopVideo.classList.toggle("background__red");
		stopVideo.innerHTML = html;
	}
});

inviteButton.addEventListener("click", (e) => {
	prompt(
		"Copy this link and send it to people you want to meet with",
		window.location.href
		);
});

socket.on("createMessage", (message, userName) => {
	messages.innerHTML +=
	`<div class="message">
		<b><i class="far fa-user-circle"></i> <span> ${
			userName === user ? "me" : userName
		}</span> </b>
		<span>${message}</span>
	</div>`;
});
