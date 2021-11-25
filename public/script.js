const socket = io.connect('/');
const videoGrid = document.getElementById("video-grid");
const myVideo = document.createElement("video");
myVideo.muted = true;

//initiate peers list, agenda list and meeting clock
var peers = {};
var agendaCache = "";
var timer = 0;
var timerInterval;

//get username and id
const myUsername = prompt("Enter your name");
var myId;

//define a new peer for p2p connections
var myPeer = new Peer(undefined, {
	host: 'mochapeer.herokuapp.com',
	secure: true,
	config: {
		'iceServers': [
			{url: 'stun:mochaturn.xyz'},
			{url: 'turn:mochaturn.xyz', username: 'mocha', credential: 'mochavideo'}
		]
	}
});

//convert timer to hh:mm:ss format
//int --> string (hh:mm:ss)
function toHHMMSS (time) {
    var sec_num = parseInt(time, 10);
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}

//request to broadcast video to the room after camera is ready
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

//when someone calls me, respond with my video stream
myPeer.on("call", (call) => {
	call.answer(myVideoStream);
	const video = document.createElement("video");
	
	call.on("stream", (userVideoStream) => {
		addVideoStream(video, userVideoStream, peers[call.peer]);
	});
});

//reply with data when a sync request is received
socket.on('sync-data-req', (socketId) => {
	socket.emit('sync-data-res', socketId, timer, agendaCache);
});

const timerItem = document.getElementById("timer_container");
const agenda = document.querySelector(".aItems");

//when synced data is received
socket.on('data-init', (newTimer, newAgendaCache) => {
	clearInterval(timerInterval);
	timer = newTimer;
	agendaCache = newAgendaCache;
	agenda.innerHTML = agendaCache;
	timerInterval = setInterval(setTimer, 1000);
});

//start the clock
function setTimer () {
	timerItem.innerHTML = toHHMMSS(timer);
	timer++;
}

//receive a new peers list when a new user has joined
socket.on('new-peer-list', (peerList) => {
	peers = {...peers, ...peerList};
});

//fixes a bug where a frozen image of the users video would still remain even after they had left
socket.on('user-disconnected', (userId) => {
	document.getElementById(userId).parentElement.outerHTML = "";
});

//as soon as my peer (not necessarily camera) is ready, request to join the room
myPeer.on("open", (id) => {
	myId = id;
	socket.emit("join-room", ROOM_ID);
	timerInterval = setInterval(setTimer, 1000);
});

//function to add someone to my peers list
function addPeerToList(userId, userName) {
	peers[userId] = userName;
	socket.emit('updated-peer-list', peers);
}

//connect to a new user given their user id and video stream from the call
function connectToNewUser(userId, stream) {
	const call = myPeer.call(userId, stream);
	const video = document.createElement("video");
	video.setAttribute('id', userId);

	//respond to their stream
	call.on("stream", (userVideoStream) => {
		addVideoStream(video, userVideoStream, peers[userId]);
	});
}

//add the video stream to the DOM
function addVideoStream(video, stream, name) {
	video.srcObject = stream;
	video.addEventListener("loadedmetadata", () => {
		video.play();
	});

	//generate nametags
	const container = document.createElement('div');
	const nametag = document.createElement('span');
	nametag.innerHTML = name;
	container.append(nametag);
	container.append(video);

	videoGrid.append(container);

	//clean up some randomly placed nodes
	videoGrid.childNodes.forEach((currentValue) => {
		if (currentValue.childElementCount < 2) {
			currentValue.outerHTML = "";
		}
	});
}

//inform the room of departure when tab is closed
window.addEventListener('beforeunload', (e) => {
	socket.emit('call-ended', myId);
});

const endCall = document.getElementById("endCall");

//triggers a departure which will inform the room (as defined above)
endCall.addEventListener('click', (e) => {
	window.location.replace('call-ended');
})

const showChat = document.querySelector("#showChat");
const chatContainer = document.querySelector(".chat_container");
const showAgenda = document.querySelector("#showAgenda");
const agendaContainer = document.querySelector(".agenda_container");

//toggle between chat and agenda window
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

const text = document.querySelector("#chat_message");
const send = document.getElementById("send");
const messages = document.querySelector(".messages");
const messageContainer = document.querySelector(".main_chat_window");

//event listeners for the message send box (click and enter)
send.addEventListener("click", (e) => {
	if (text.value.length !== 0) {
		sendMessage();
	}
});

text.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && text.value.length !== 0) {
		sendMessage();
	}
});

//send a message to the room. clear the message box after sending
function sendMessage() {
	socket.emit("message", ROOM_ID, text.value, myUsername);
	text.value = "";
	messageContainer.scrollTop = messageContainer.scrollHeight;
}

const inviteButton = document.querySelector("#inviteButton");
const muteButton = document.querySelector("#muteButton");
const stopVideo = document.querySelector("#stopVideo");

//mute mic and video
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

//show a prompt with a link for users to join the room
inviteButton.addEventListener("click", (e) => {
	prompt("Use this link to join the room", window.location.href);
});

//when the server informs us of a new message, add it to the chat window
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

const item = document.querySelector("#agenda_message");
const add = document.getElementById("add");
const aContainer = document.querySelector(".main_agenda_window");

//event listener for adding a new agenda item (enter is not added as it causes problems)
add.addEventListener("click", (e) => {
	if (item.value.length !== 0) {
		addAgendaItem();
	}
});

const modal = document.getElementById("editModal");
const content = document.getElementById("editModalContent");
const closeModal = document.getElementById("closeEditModal");
const cancelEdits = document.getElementById("cancelEditsButton");
const saveEdits = document.getElementById("saveEditsButton");
var currentAgendaId;

//event handlers for the different functions in the edit agenda modal.
saveEdits.onclick = () => {
	socket.emit('modify-agenda', ROOM_ID, currentAgendaId, content.value);
	modal.style.display = "none";
}

cancelEdits.onclick = () => {
	modal.style.display = "none";
}

closeModal.onclick = () => {
	modal.style.display = "none";
}

window.onclick = function(event) {
	if (event.target == modal) {
		modal.style.display = "none";
	}
}

//edits an agenda with a given uuid and updates its raw and formated contents
function agendaEdit(agendaItem, agendaRaw, uuid) {
	const agendaIQ = document.getElementById(uuid);
	if (agendaIQ != null) {
		agendaIQ.children[1].firstChild.innerHTML = agendaItem;
		agendaIQ.setAttribute("raw", agendaRaw);
	}
}

//brings up the editing modal
function agendaEditModal(uuid) {
	const agendaIQ = document.getElementById(uuid);
	currentAgendaId = uuid;
	content.value = JSON.parse(agendaIQ.getAttribute("raw"));
	modal.style.display = "block";
}

//delete an agenda element with the given uuid
function agendaDelete(uuid, needConfirm) {
	const agendaIQ = document.getElementById(uuid);
	if (needConfirm) {
		if (!confirm("Are you sure you want to delete this item?")) return;
	}
	if (agendaIQ != null) {
		agendaIQ.outerHTML = "";
		socket.emit('delete-agenda', uuid);
	}
}

//mark an agenda with the given uuid as complete and move it to the bottom of the list
function agendaComplete(uuid) {
	const agendaIQ = document.getElementById(uuid);
	agendaIQ.children[1].children[1].children[2].outerHTML = "";
	agendaIQ.children[1].setAttribute("style", "background-color: #60C260;");
	agendaIQ.setAttribute("style", "order: " + timer + ";");
	agendaCache = agenda.innerHTML;
	socket.emit('complete-agenda', uuid);
}

//informing the rest of the room when I take action for an agenda item
socket.on("finish-agenda", (agendaId) => {
	agendaComplete(agendaId);
});

socket.on('remove-agenda', (agendaId) => {
	agendaDelete(agendaId, false);
});

socket.on("edit-agenda", (agendaItem, agendaRaw, uuid) => {
	agendaEdit(agendaItem, agendaRaw, uuid);
});

socket.on("add-agenda", (agendaItem, agendaRaw, userName, uuid) => {
	agenda.innerHTML +=
	`<div class="agenda" id="${uuid}" raw='${agendaRaw}'>
		<b><span> ${
			userName === myUsername ? "me" : userName
		}</span></b>
		<span><span>${agendaItem}</span>
			<div class="agenda_options">
				<div id="agendaEditButton" onclick="agendaEditModal('${uuid}');" class="agenda_button">
					<i class="fa fa-pencil-alt"></i>
				</div>
				<div id="agendaDeleteButton" onclick="agendaDelete('${uuid}', true);" class="agenda_button">
					<i class="fa fa-trash-alt"></i>
				</div>
				<div id="agendaCompleteButton" onclick="agendaComplete('${uuid}');" class="agenda_button">
					<i class="fa fa-check"></i>
				</div>
			</div>
		</span>
	</div>`;

	agendaCache = agenda.innerHTML;
});

//add an item to the agenda and tell the rest of the room too :)
function addAgendaItem() {
	socket.emit("new-agenda", ROOM_ID, item.value, myUsername);
	item.value = "";
	aContainer.scrollTop = aContainer.scrollHeight;
}