const socket = io.connect('/');
const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
myVideo.muted = true;

var peers = {};

const myUsername = prompt("Enter your name");
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
	addVideoStream(myVideo, stream, myUsername);

	addPeerToList(myId, myUsername);

	socket.on('new-user-connected', (userId, userName) => {
		addPeerToList(userId, userName);

		if (userId != myId) {
			connectToNewUser(userId, stream);
		}
	});

	socket.emit('connection-request', myId, myUsername);
});

myPeer.on("call", (call) => {
	call.answer(myVideoStream);
	const video = document.createElement("video");
	
	call.on("stream", (userVideoStream) => {
		addVideoStream(video, userVideoStream, peers[call.peer]);
	});
});

socket.on('new-peer-list', (peerList) => {
	peers = {...peers, ...peerList};
});

socket.on('user-disconnected', (userId) => {
	document.getElementById(userId).parentElement.outerHTML = "";
});

myPeer.on("open", (id) => {
	myId = id;
	socket.emit("join-room", ROOM_ID);
});

function addPeerToList(userId, userName) {
	peers[userId] = userName;
	socket.emit('updated-peer-list', peers);
}

function connectToNewUser(userId, stream) {
	const call = myPeer.call(userId, stream);
	const video = document.createElement("video");
	video.setAttribute('id', userId);

	call.on("stream", (userVideoStream) => {
		addVideoStream(video, userVideoStream, peers[userId]);
	});
}

function addVideoStream(video, stream, name) {
	video.srcObject = stream;
	video.addEventListener("loadedmetadata", () => {
		video.play();
	});

	const container = document.createElement('div');
	const nametag = document.createElement('span');
	nametag.innerHTML = name;
	container.append(nametag);
	container.append(video);

	videoGrid.append(container);

	//clean up some randomly placed nodes
	videoGrid.childNodes.forEach((currentValue) => {
		if (currentValue.childNodes.length < 2) {
			currentValue.childNodes.outerHTML = "";
		}
	});

}

window.addEventListener('beforeunload', (e) => {
	e.preventDefault();
	socket.emit('call-ended', myId);
});

let showChat = document.querySelector("#showChat");
let chatContainer = document.querySelector(".chat_container");
let showAgenda = document.querySelector("#showAgenda");
let agendaContainer = document.querySelector(".agenda_container");


showChat.addEventListener('click', (e) => {
	if (!showChat.classList.contains('active')) {
		showChat.classList.toggle('active');
		showAgenda.classList.toggle('active');
		chatContainer.classList.toggle('hidden');
		agendaContainer.classList.toggle('hidden')
	}
})

showAgenda.addEventListener('click', (e) => {
	if (!showAgenda.classList.contains('active')) {
		showAgenda.classList.toggle('active');
		showChat.classList.toggle('active');
		agendaContainer.classList.toggle('hidden');
		chatContainer.classList.toggle('hidden');
	}
})

let text = document.querySelector("#chat_message");
let send = document.getElementById("send");
let messages = document.querySelector(".messages");

send.addEventListener("click", (e) => {
	if (text.value.length !== 0) {
		socket.emit("message", ROOM_ID, text.value, myUsername);
		text.value = "";
	}
});

text.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && text.value.length !== 0) {
		socket.emit("message", ROOM_ID, text.value, myUsername);
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
		muteButton.classList.toggle("active");
		muteButton.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
	} else {
		myVideoStream.getAudioTracks()[0].enabled = true;
		muteButton.classList.toggle("active");
		muteButton.innerHTML = `<i class="fas fa-microphone"></i>`;
	}
});

stopVideo.addEventListener("click", () => {
	const enabled = myVideoStream.getVideoTracks()[0].enabled;
	if (enabled) {
		myVideoStream.getVideoTracks()[0].enabled = false;
		stopVideo.classList.toggle("active");
		stopVideo.innerHTML = `<i class="fas fa-video-slash"></i>`;
	} else {
		myVideoStream.getVideoTracks()[0].enabled = true;
		stopVideo.classList.toggle("active");
		stopVideo.innerHTML = `<i class="fas fa-video"></i>`;
	}
});

inviteButton.addEventListener("click", (e) => {
	prompt("Use this link to join the room", window.location.href);
});

socket.on("create-message", (message, userName) => {
	let appendClass;
	if (userName === myUsername) {
		appendClass = "message_me";
	}

	messages.innerHTML +=
	`<div class="message ${appendClass}">
		<b><span> ${
			userName === myUsername ? "me" : userName
		}</span></b>
		<span>${message}</span>
	</div>`;
});
