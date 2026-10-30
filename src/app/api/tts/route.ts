import crypto from 'crypto'
import https from 'https'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/*
 * Серверная озвучка через нейросетевые голоса Microsoft Edge (Edge TTS).
 * Работает одинаково на ПК (в любом браузере и в Planner.exe) и на телефоне (включая Android APK),
 * возвращая готовый поток audio/mpeg.
 */

const BASE_HOST = 'speech.platform.bing.com'
const BASE_PATH = '/consumer/speech/synthesize/readaloud/edge/v1'
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const CHROMIUM_MAJOR_VERSION = '143'
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`
const WIN_EPOCH = 11644473600

const ALLOWED_EDGE_VOICES = new Set([
	'ru-RU-SvetlanaNeural',
	'ru-RU-DmitryNeural',
	'ru-RU-DariyaNeural',
	'en-US-AvaMultilingualNeural',
	'en-US-AndrewMultilingualNeural',
	'en-US-EmmaMultilingualNeural',
	'en-US-BrianMultilingualNeural',
	'en-US-AriaNeural',
	'en-US-GuyNeural',
	'en-GB-SoniaNeural',
	'en-GB-RyanNeural'
])

let clockSkewSeconds = 0

/* ---------- Генерация токена Sec-MS-GEC v2 (CS64 + Salted SHA-256) ---------- */

const SHA256_INITIAL = [
	0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
	0x1f83d9ab, 0x5be0cd19
].map(x => x >>> 0)

const SHA256_STATE = [
	0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab,
	0xfeb0a7e4, 0x03effbd2
].map(x => x >>> 0)

const SHA256_SCHEDULE = [
	0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491,
	0xc0dd25a0, 0xf9e70ab6, 0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33,
	0xd258b060, 0x72766564
].map(x => x >>> 0)

const SHA256_ROUND_CONSTANTS = [
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
	0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
	0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
	0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
	0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
	0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
	0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
	0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
	0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
].map(x => x >>> 0)

const SHA256_ADJUSTMENT = 0xc9dc06a7 >>> 0
const SHA256_BLOCK_CONSTANTS = [
	...SHA256_ROUND_CONSTANTS.slice(0, 14),
	SHA256_ADJUSTMENT,
	...SHA256_ROUND_CONSTANTS.slice(15)
]
const SHA256_SIGMA0_ADJUSTMENT = 0x059c0b80 >>> 0
const SHA256_SIGMA1_ADJUSTMENT = 0x000b92c0 >>> 0

const CS64_COEFFICIENTS: [number, number][] = [
	[0xe82e91b1, 0xb32700d0],
	[0x44de24c6, 0x88dff51d],
	[0x3beb65bc, 0x29514038],
	[0xc89c5933, 0xb328cbdf],
	[0x8d1ec211, 0xd405b4d5],
	[0x314ef5d5, 0x26e55f3c],
	[0xe92491b1, 0x607801c6],
	[0xf0a5b9d5, 0x82b2c1fb],
	[0x06064cf3, 0xfa51a3da],
	[0xda79fa60, 0x207cc464],
	[0xbed20560, 0x3c3c74f3],
	[0x89f9c9f8, 0xd2d14b61],
	[0x35fa38c6, 0xbb04a2c1],
	[0xcb49e3c6, 0xc5626167]
]
const CS64_FACTOR = 0x82893933 >>> 0
const CS64_ADJUSTMENT0 = 0xf2f90b1a >>> 0
const CS64_ADJUSTMENT1 = 0x0b1a0000 >>> 0

const mul32 = (a: number, b: number) => Math.imul(a, b) >>> 0
const rol16 = (v: number) => (((v >>> 0) << 16) | ((v >>> 0) >>> 16)) >>> 0
const rotr = (v: number, n: number) =>
	(((v >>> 0) >>> n) | ((v >>> 0) << (32 - n))) >>> 0
const sigma0 = (v: number) => (rotr(v, 7) ^ rotr(v, 18) ^ ((v >>> 0) >>> 3)) >>> 0
const sigma1 = (v: number) =>
	(rotr(v, 17) ^ rotr(v, 19) ^ ((v >>> 0) >>> 10)) >>> 0

function sha256Rounds(state: number[], words: number[], firstRound = 0) {
	let [a, b, c, d, e, f, g, h] = state
	const constants =
		firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS
	for (let i = firstRound; i < 64; i++) {
		const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
		const ch = (g ^ (e & (f ^ g))) >>> 0
		const t1 = (h + s1 + ch + constants[i] + words[i]) >>> 0
		const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
		const maj = ((a & b) | (c & (a | b))) >>> 0
		const t2 = (s0 + maj) >>> 0
		h = g
		g = f
		f = e
		e = (d + t1) >>> 0
		d = c
		c = b
		b = a
		a = (t1 + t2) >>> 0
	}
	return [a, b, c, d, e, f, g, h]
}

function expandSchedule(words: number[], firstWord = 16) {
	for (let i = firstWord; i < 64; i++) {
		words.push(
			(sigma1(words[i - 2]) +
				words[i - 7] +
				sigma0(words[i - 15]) +
				words[i - 16]) >>>
				0
		)
	}
}

function sha256Init(data7: Buffer) {
	const words = new Array<number>(14).fill(0)
	words.push(((data7[0] << 16) | (data7[1] << 8) | data7[2]) >>> 0)
	words.push(data7.readUInt32BE(3))
	for (let i = 16; i < 30; i++) {
		let val = SHA256_SCHEDULE[i - 16]
		if (i - 2 >= 14)
			val =
				(val +
					(i === 16
						? sigma1(words[i - 2]) ^ SHA256_SIGMA1_ADJUSTMENT
						: sigma1(words[i - 2]))) >>>
				0
		if (i - 7 >= 14) val = (val + words[i - 7]) >>> 0
		if (i - 15 >= 14)
			val =
				(val +
					(i === 29
						? sigma0(words[i - 15]) ^ SHA256_SIGMA0_ADJUSTMENT
						: sigma0(words[i - 15]))) >>>
				0
		words.push(val >>> 0)
	}
	words.push(
		(sigma1(words[28]) +
			words[23] +
			sigma0(words[15]) +
			words[14] +
			SHA256_ADJUSTMENT -
			SHA256_ROUND_CONSTANTS[14]) >>>
			0
	)
	expandSchedule(words, 31)
	const working = sha256Rounds(SHA256_STATE, words, 14)
	return SHA256_INITIAL.map((x, idx) => (x + working[idx]) >>> 0)
}

function sha256Digest(data: Buffer) {
	const length = 57 + data.length
	const padZeroes = (((55 - length) % 64) + 64) % 64
	const tail = data.subarray(7)
	const padded = Buffer.alloc(tail.length + 1 + padZeroes + 8)
	tail.copy(padded, 0)
	padded[tail.length] = 0x80
	padded.writeBigUInt64BE(BigInt(length) * BigInt(8), padded.length - 8)
	let state = sha256Init(data.subarray(0, 7))
	for (let off = 0; off < padded.length; off += 64) {
		const words: number[] = []
		for (let j = 0; j < 64; j += 4) words.push(padded.readUInt32BE(off + j))
		expandSchedule(words)
		const working = sha256Rounds(state, words)
		state = state.map((x, idx) => (x + working[idx]) >>> 0)
	}
	const out = Buffer.alloc(32)
	state.forEach((x, idx) => out.writeUInt32BE(x, idx * 4))
	return out
}

function wordsLe4Even(buf: Buffer) {
	const pad = (4 - (buf.length % 4)) % 4
	const padded = pad ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf
	const words: number[] = []
	for (let i = 0; i < padded.length; i += 4) words.push(padded.readUInt32LE(i))
	if (words.length % 2 === 1) words.push(0)
	return words
}

function cs64Digest(data: Buffer, digest: Buffer) {
	const keyA = (digest.readUInt32LE(0) | 1) >>> 0
	const keyB = (digest.readUInt32LE(4) | 1) >>> 0
	const factors = [mul32(keyA, CS64_FACTOR), mul32(keyB, CS64_FACTOR)]
	const terms = CS64_COEFFICIENTS.map(([c], idx) =>
		mul32(c, factors[idx % 2])
	)
	const offsets = CS64_COEFFICIENTS.map(([, o]) => o >>> 0)
	const inputWords = wordsLe4Even(Buffer.concat([Buffer.from([0]), data]))
	inputWords.forEach((word, idx) => {
		let term = mul32(word, idx % 2 === 0 ? keyA : keyB)
		let offset = mul32(rol16(word), idx % 2 === 0 ? 0xef0569fb : 0xc31713db)
		if (idx === 0) {
			term = (term + mul32(CS64_ADJUSTMENT0, factors[0])) >>> 0
			offset = (offset + CS64_ADJUSTMENT1) >>> 0
		}
		terms.push(term)
		offsets.push(offset)
	})
	let swapAcc = 0
	let swapLast = 0
	let state = 0
	let acc = 0
	for (let i = 0; i < terms.length; i += 2) {
		const x = terms[i]
		const y = terms[i + 1]
		let t = rol16((offsets[i] + x) >>> 0)
		let q = mul32(t, 0x76f50f34)
		swapAcc = (swapAcc + ((mul32(rol16(q), 0xc3efea97) + q) >>> 0)) >>> 0
		t = rol16((offsets[i + 1] + y) >>> 0)
		q = mul32(t, 0x1881ce3c)
		swapLast = (mul32(rol16(q), 0x35bd1ec9) + q) >>> 0
		swapAcc = (swapAcc + swapLast) >>> 0

		state = (mul32(state, keyA) + x) >>> 0
		state = mul32(rol16(state), 0xcf98b111)
		state = mul32(rol16(state), 0x87085b9f)
		state = mul32(rol16(state), 0x12ceb96d)
		state = mul32(rol16(state), 0x257e1d83)
		acc = (acc + state) >>> 0
		t = (mul32(state, keyB) + y) >>> 0
		t = mul32(rol16(t), 0xa27416f5)
		t = mul32(rol16(t), 0xd38396ff)
		state = mul32(rol16(mul32(rol16(t), 0x7c932b89)), 0xbfa49f69)
		acc = (acc + state) >>> 0
	}
	const out = Buffer.alloc(8)
	out.writeUInt32LE((swapLast ^ state) >>> 0, 0)
	out.writeUInt32LE((swapAcc ^ acc) >>> 0, 4)
	return out.toString('hex').toUpperCase()
}

function generateSecMsGec() {
	const nowSec = Date.now() / 1000 + clockSkewSeconds
	let ticks = Math.floor(nowSec) + WIN_EPOCH
	ticks -= ticks % 300
	const str = Buffer.from(
		`${ticks}0000000${TRUSTED_CLIENT_TOKEN}`,
		'ascii'
	)
	const digest = sha256Digest(str)
	const cs64 = cs64Digest(str, digest)
	return `${cs64}-${digest.toString('hex').toUpperCase()}`
}

/* ---------- WebSocket-клиент RFC 6455 для Edge TTS ---------- */

function escapeXml(text: string) {
	return text
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

function sendWsFrame(socket: import('stream').Duplex, opcode: number, payload: Buffer) {
	const mask = crypto.randomBytes(4)
	let header: Buffer
	if (payload.length < 126) {
		header = Buffer.alloc(6)
		header[0] = 0x80 | opcode
		header[1] = 0x80 | payload.length
		mask.copy(header, 2)
	} else if (payload.length < 65536) {
		header = Buffer.alloc(8)
		header[0] = 0x80 | opcode
		header[1] = 0x80 | 126
		header.writeUInt16BE(payload.length, 2)
		mask.copy(header, 4)
	} else {
		header = Buffer.alloc(14)
		header[0] = 0x80 | opcode
		header[1] = 0x80 | 127
		header.writeBigUInt64BE(BigInt(payload.length), 2)
		mask.copy(header, 10)
	}
	const masked = Buffer.alloc(payload.length)
	for (let i = 0; i < payload.length; i++) {
		masked[i] = payload[i] ^ mask[i & 3]
	}
	socket.write(Buffer.concat([header, masked]))
}

function synthesizeOnce(
	text: string,
	voice: string,
	rateStr: string,
	pitchStr: string
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const connId = crypto.randomUUID().replace(/-/g, '')
		const gec = generateSecMsGec()
		const path = `${BASE_PATH}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connId}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`
		const muid = crypto.randomBytes(16).toString('hex').toUpperCase()

		const req = https.request({
			hostname: BASE_HOST,
			port: 443,
			path,
			method: 'GET',
			headers: {
				Connection: 'Upgrade',
				Upgrade: 'websocket',
				'Sec-WebSocket-Version': '13',
				'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
				Pragma: 'no-cache',
				'Cache-Control': 'no-cache',
				Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
				'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
				'Accept-Encoding': 'gzip, deflate, br, zstd',
				'Accept-Language': 'en-US,en;q=0.9',
				Cookie: `muid=${muid};`
			}
		})

		const timeout = setTimeout(() => {
			req.destroy()
			reject(new Error('Edge TTS timeout'))
		}, 15000)

		req.on('response', res => {
			clearTimeout(timeout)
			const dateHeader = res.headers.date
			if (res.statusCode === 403 && dateHeader) {
				const serverSec = new Date(dateHeader).getTime() / 1000
				if (Number.isFinite(serverSec)) {
					clockSkewSeconds = serverSec - Date.now() / 1000
				}
			}
			res.destroy()
			reject(new Error(`Edge TTS HTTP ${res.statusCode}`))
		})

		req.on('error', err => {
			clearTimeout(timeout)
			reject(err)
		})

		req.on('upgrade', (_res, socket, head) => {
			const audioChunks: Buffer[] = []
			let recvBuffer = head && head.length ? Buffer.from(head) : Buffer.alloc(0)
			let finished = false

			const finish = (err?: Error) => {
				if (finished) return
				finished = true
				clearTimeout(timeout)
				socket.destroy()
				if (err) reject(err)
				else if (!audioChunks.length) reject(new Error('Empty audio from Edge TTS'))
				else resolve(Buffer.concat(audioChunks))
			}

			const ts = new Date().toUTCString()
			const configMsg =
				`X-Timestamp:${ts}\r\n` +
				`Content-Type:application/json; charset=utf-8\r\n` +
				`Path:speech.config\r\n\r\n` +
				`{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"true","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`

			const reqId = crypto.randomUUID().replace(/-/g, '')
			const ssml =
				`<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
				`<voice name='${voice}'>` +
				`<prosody pitch='${pitchStr}' rate='${rateStr}' volume='+0%'>` +
				`${escapeXml(text)}` +
				`</prosody></voice></speak>`

			const ssmlMsg =
				`X-RequestId:${reqId}\r\n` +
				`Content-Type:application/ssml+xml\r\n` +
				`X-Timestamp:${ts}Z\r\n` +
				`Path:ssml\r\n\r\n` +
				ssml

			sendWsFrame(socket, 0x1, Buffer.from(configMsg, 'utf8'))
			sendWsFrame(socket, 0x1, Buffer.from(ssmlMsg, 'utf8'))

			let fragOpcode = 0
			let fragChunks: Buffer[] = []

			const handleMessage = (opcode: number, data: Buffer) => {
				if (opcode === 0x1) {
					const str = data.toString('utf8')
					if (str.includes('Path:turn.end')) {
						finish()
					}
				} else if (opcode === 0x2) {
					if (data.length < 2) return
					const headerLen = data.readUInt16BE(0)
					if (data.length < 2 + headerLen) return
					const headersText = data.subarray(2, 2 + headerLen).toString('utf8')
					if (headersText.includes('Path:audio')) {
						const audioBody = data.subarray(2 + headerLen)
						if (audioBody.length > 0) audioChunks.push(Buffer.from(audioBody))
					}
				} else if (opcode === 0x8) {
					finish()
				} else if (opcode === 0x9) {
					sendWsFrame(socket, 0xa, data)
				}
			}

			const parseFrames = () => {
				while (recvBuffer.length >= 2) {
					const b0 = recvBuffer[0]
					const b1 = recvBuffer[1]
					const fin = (b0 & 0x80) !== 0
					const opcode = b0 & 0x0f
					const masked = (b1 & 0x80) !== 0
					let payloadLen = b1 & 0x7f
					let offset = 2

					if (payloadLen === 126) {
						if (recvBuffer.length < 4) return
						payloadLen = recvBuffer.readUInt16BE(2)
						offset = 4
					} else if (payloadLen === 127) {
						if (recvBuffer.length < 10) return
						payloadLen = Number(recvBuffer.readBigUInt64BE(2))
						offset = 10
					}

					const maskLen = masked ? 4 : 0
					if (recvBuffer.length < offset + maskLen + payloadLen) return

					let payload = recvBuffer.subarray(offset + maskLen, offset + maskLen + payloadLen)
					if (masked) {
						const mask = recvBuffer.subarray(offset, offset + 4)
						const unmasked = Buffer.alloc(payload.length)
						for (let i = 0; i < payload.length; i++) unmasked[i] = payload[i] ^ mask[i & 3]
						payload = unmasked
					}

					recvBuffer = recvBuffer.subarray(offset + maskLen + payloadLen)

					if (opcode >= 0x8) {
						handleMessage(opcode, payload)
					} else if (opcode === 0x0) {
						fragChunks.push(Buffer.from(payload))
						if (fin) {
							handleMessage(fragOpcode, Buffer.concat(fragChunks))
							fragChunks = []
							fragOpcode = 0
						}
					} else if (!fin) {
						fragOpcode = opcode
						fragChunks = [Buffer.from(payload)]
					} else {
						handleMessage(opcode, payload)
					}
				}
			}

			socket.on('data', (chunk: Buffer) => {
				recvBuffer = Buffer.concat([recvBuffer, chunk])
				parseFrames()
			})
			socket.on('end', () => finish())
			socket.on('error', err => finish(err))

			if (recvBuffer.length > 0) parseFrames()
		})

		req.end()
	})
}

async function synthesizeEdgeTts(
	text: string,
	voice: string,
	rateStr: string,
	pitchStr: string
) {
	try {
		return await synthesizeOnce(text, voice, rateStr, pitchStr)
	} catch {
		return await synthesizeOnce(text, voice, rateStr, pitchStr)
	}
}

function handleRequest(
	text: string,
	voiceParam: string | null,
	rateParam: string | null,
	pitchParam: string | null
) {
	const cleaned = text.trim().slice(0, 1500)
	if (!cleaned) {
		return NextResponse.json({ error: 'Empty text' }, { status: 400 })
	}

	const isEn =
		(cleaned.match(/[a-z]/gi) || []).length >
		(cleaned.match(/[а-яё]/gi) || []).length
	const defaultVoice = isEn
		? 'en-US-AvaMultilingualNeural'
		: 'ru-RU-SvetlanaNeural'
	const voice =
		voiceParam && ALLOWED_EDGE_VOICES.has(voiceParam)
			? voiceParam
			: defaultVoice

	const rateNum = Math.max(0.5, Math.min(2.5, Number(rateParam) || 1))
	const pitchNum = Math.max(0.5, Math.min(1.5, Number(pitchParam) || 1))
	const ratePct = Math.round((rateNum - 1) * 100)
	const pitchHz = Math.round((pitchNum - 1) * 50)
	const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`
	const pitchStr = `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`

	return synthesizeEdgeTts(cleaned, voice, rateStr, pitchStr)
		.then(
			audio =>
				new NextResponse(new Uint8Array(audio), {
					status: 200,
					headers: {
						'Content-Type': 'audio/mpeg',
						'Content-Length': String(audio.length),
						'Cache-Control': 'public, max-age=86400'
					}
				})
		)
		.catch(err =>
			NextResponse.json(
				{ error: err instanceof Error ? err.message : 'TTS failed' },
				{ status: 502 }
			)
		)
}

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url)
	return handleRequest(
		searchParams.get('text') || '',
		searchParams.get('voice'),
		searchParams.get('rate'),
		searchParams.get('pitch')
	)
}

export async function POST(request: NextRequest) {
	const body = await request.json().catch(() => ({}))
	return handleRequest(
		String(body.text || ''),
		body.voice ?? null,
		body.rate !== undefined ? String(body.rate) : null,
		body.pitch !== undefined ? String(body.pitch) : null
	)
}
