var pcCfg = {iceServers: [{urls: 'stun:stun.services.mozilla.com'}, {urls: 'stun:stun.l.google.com:19302'}]};

var ws = new WebSocket(location.href.replace('http','ws'));

var peers = new Map();// id -> {video, peerConn} map of participants 

// navigator.getUserMedia({ audio: true, video: true },stream=>localVideo.src = URL.createObjectURL(stream));


var localVideo = app.appendChild(h('video', {autoplay:'', muted:''}));

var startButton = app.appendChild(h('button', 'Join'))

var videos = app.appendChild(h('div'));

navigator.getUserMedia({audio: true, video: true}, stream=>localVideo.src=URL.createObjectURL(stream), console.log)


startButton.onclick=e=>{// send offer to all peers in the room
	for (let [u, {pc}] of peers){
		pc.createOffer(offer=>{
			console.log('offer', offer);
			pc.setLocalDescription(offer, _=>ws.send(JSON.stringify({offer, from:peers.id, to:u})), console.log);
		}, console.log);
	}
	
}

ws.onmessage = ({data})=>{
	console.log('received', data)
	const {type, id, users, candidate, offer, answer, from, to} = JSON.parse(data);

	if (type=='join'){ // a change happened in participants of the room
		peers.id=id; // save id of this current browser/connection somewhere
		const others = new Set(users);
		others.delete(id);
		for (let u of others){
			if (!peers.get(u)) {
				const video = videos.appendChild(h('video', {autoplay:''}));
				const pc = new RTCPeerConnection(pcCfg);
				pc.onicecandidate = e => {
					console.log('ice', e, u, peers.id);
					e && e.candidate && ws.send(JSON.stringify({candidate: e.candidate, from:peers.id, to:u}))
				};
				pc.onaddstream = e=>{
					console.log('received stream', e);
					video.src = URL.createObjectURL(e.stream);
				}
				peers.set(u, {video, pc})
				navigator.getUserMedia({audio: true, video: true}, stream=>pc.addStream(stream), console.log)
			}
		}
		for (let [u, {pc, video}] of peers){
			if (!others.has(u)){
				// stop the video and peer connection for this one
				video.remove();
				if (pc.signalingState!=='closed') pc.close()
			}
		}


	}	else if (offer && peers.id==to && peers.get(from)) {
		// console.log('received offer', from);
		const {pc, video} = peers.get(from);
		pc.onaddstream = e=>{
			console.log('received stream', e);
			video.src = URL.createObjectURL(e.stream);
		}
		navigator.getUserMedia({audio: true, video: true}, stream=>pc.addStream(stream), console.log)

		// todo promisify
		pc.setRemoteDescription(new RTCSessionDescription(offer), function() {
			pc.createAnswer(function(answer) {
				pc.setLocalDescription(answer, function() {
					ws.send(JSON.stringify({answer, from:peers.id, to:from}))
				}, console.log);
			}, console.log);
		}, console.log);

	}	else if (answer && peers.id==to && peers.get(from)) {
		// console.log('received answer', from);
		const {pc, video} = peers.get(from);

		// todo promisify
		pc.setRemoteDescription(new RTCSessionDescription(answer), console.log, console.log);


	} else if (candidate){
		// console.log('candidate', candidate, from, to);
		for (let [u, {pc}] of peers)
			if (pc.signalingState!=='closed')
				pc.addIceCandidate(new RTCIceCandidate(candidate))

	} 
	
}
// ws.onopen = e=>{console.log('open', e);}
ws.onclose = e=>{console.log('close', e)}
ws.onerror = e=>{console.log('err', e)} // todo restart with setInterval


function h(tag, p={}, ...children){ // 'hyperscript' util function, to make quickly DOM elements
	if (p instanceof Node||typeof p==='string'||Array.isArray(p)) return h(tag, undefined, p, ...children);
	const el=document.createElement(tag);
	for (let name in p){
		if (p[name]||p[name]==''){
			el.setAttribute(name.toLowerCase(), p[name])
			// or el.addEventListener(name.substring(2).toLowerCase(), p[name]); for name.startsWith('on')
		}
	}
	if (p.style) Object.assign(el.style, p.style);
	for (let c of [].concat(...children.map(c=>typeof c==='string'?document.createTextNode(c):c)))
		el.appendChild(c)
	return el;
}