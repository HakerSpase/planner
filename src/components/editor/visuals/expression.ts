/*
 * Безопасный разбор математических выражений для графиков — без eval.
 * Понимает школьную запись: 2x, 3sin(x), x^2, √x, π, tg/ctg, arcsin, lg/ln, |x| через abs().
 */

export type TypeScope = Record<string, number>
export type TypeCompiled = (scope: TypeScope) => number

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
	sin: Math.sin,
	cos: Math.cos,
	tan: Math.tan,
	tg: Math.tan,
	cot: x => 1 / Math.tan(x),
	ctg: x => 1 / Math.tan(x),
	sec: x => 1 / Math.cos(x),
	csc: x => 1 / Math.sin(x),
	arcsin: Math.asin,
	arccos: Math.acos,
	arctan: Math.atan,
	arctg: Math.atan,
	arcctg: x => Math.PI / 2 - Math.atan(x),
	sinh: Math.sinh,
	cosh: Math.cosh,
	tanh: Math.tanh,
	sh: Math.sinh,
	ch: Math.cosh,
	th: Math.tanh,
	sqrt: Math.sqrt,
	cbrt: Math.cbrt,
	abs: Math.abs,
	ln: Math.log,
	lg: Math.log10,
	log: (a, b) => (b === undefined ? Math.log10(a) : Math.log(b) / Math.log(a)),
	exp: Math.exp,
	floor: Math.floor,
	ceil: Math.ceil,
	round: Math.round,
	sign: Math.sign,
	sgn: Math.sign,
	min: Math.min,
	max: Math.max
}

const CONSTANTS: TypeScope = { pi: Math.PI, π: Math.PI, e: Math.E, τ: Math.PI * 2 }

type Token =
	| { type: 'num'; value: number }
	| { type: 'id'; value: string }
	| { type: 'op'; value: string }

const LETTER = /[a-zA-Zα-ωΑ-Ωπ_]/

/** Разбить «склеенные» буквы: ax → a·x, но sin, pi, alpha — целиком */
function splitIdentifier(word: string, known: Set<string>): string[] {
	if (known.has(word) || FUNCTIONS[word] || word in CONSTANTS) return [word]
	const parts: string[] = []
	let rest = word
	while (rest) {
		let length = rest.length
		while (length > 1 && !(known.has(rest.slice(0, length)) || FUNCTIONS[rest.slice(0, length)] || rest.slice(0, length) in CONSTANTS))
			length--
		parts.push(rest.slice(0, length))
		rest = rest.slice(length)
	}
	return parts
}

function tokenize(source: string, known: Set<string>): Token[] {
	const text = source
		.replace(/·|×|⋅/g, '*')
		.replace(/÷|:/g, '/')
		.replace(/−|–/g, '-')
		.replace(/√/g, 'sqrt')
		.replace(/²/g, '^2')
		.replace(/³/g, '^3')
		.replace(/\*\*/g, '^')
	const tokens: Token[] = []
	let i = 0
	while (i < text.length) {
		const char = text[i]
		if (/\s/.test(char)) {
			i++
			continue
		}
		const number = /^(\d+([.,]\d+)?|[.,]\d+)/.exec(text.slice(i))
		if (number) {
			tokens.push({ type: 'num', value: Number(number[0].replace(',', '.')) })
			i += number[0].length
			continue
		}
		if (LETTER.test(char)) {
			let end = i
			while (end < text.length && (LETTER.test(text[end]) || /\d/.test(text[end]))) end++
			const word = text.slice(i, end)
			// x2 или a1 — имя с цифрой; иначе разбиваем на известные куски
			splitIdentifier(word, known).forEach(value => tokens.push({ type: 'id', value }))
			i = end
			continue
		}
		if ('+-*/^(),|'.includes(char)) {
			tokens.push({ type: 'op', value: char })
			i++
			continue
		}
		throw new Error(`Непонятный символ «${char}»`)
	}
	return tokens
}

/* Рекурсивный спуск: сумма → произведение → унарный минус → степень → вызов/атом */
export function compile(source: string, variables: string[] = ['x']): TypeCompiled {
	const known = new Set(variables)
	const tokens = tokenize(source, known)
	let pos = 0

	const peek = () => tokens[pos]
	const isOp = (value: string) => peek()?.type === 'op' && peek()!.value === value
	const expectOp = (value: string) => {
		if (!isOp(value)) throw new Error(`Ожидалось «${value}»`)
		pos++
	}

	// Может ли следующий токен начать множитель (для неявного умножения: 2x, 3(x+1), x sin x)
	const startsFactor = () => {
		const token = peek()
		if (!token) return false
		if (token.type === 'num' || token.type === 'id') return true
		return token.value === '(' || (token.value === '|' && !absDepth)
	}
	let absDepth = 0

	function parseSum(): TypeCompiled {
		let left = parseProduct()
		while (isOp('+') || isOp('-')) {
			const op = (tokens[pos++] as { value: string }).value
			const right = parseProduct()
			const a = left
			left = op === '+' ? scope => a(scope) + right(scope) : scope => a(scope) - right(scope)
		}
		return left
	}

	function parseProduct(): TypeCompiled {
		let left = parseUnary()
		for (;;) {
			if (isOp('*') || isOp('/')) {
				const op = (tokens[pos++] as { value: string }).value
				const right = parseUnary()
				const a = left
				left = op === '*' ? scope => a(scope) * right(scope) : scope => a(scope) / right(scope)
			} else if (startsFactor()) {
				const right = parsePower()
				const a = left
				left = scope => a(scope) * right(scope)
			} else return left
		}
	}

	function parseUnary(): TypeCompiled {
		if (isOp('-')) {
			pos++
			const inner = parseUnary()
			return scope => -inner(scope)
		}
		if (isOp('+')) {
			pos++
			return parseUnary()
		}
		return parsePower()
	}

	function parsePower(): TypeCompiled {
		const base = parseCall()
		if (isOp('^')) {
			pos++
			const exponent = parseUnary()
			return scope => Math.pow(base(scope), exponent(scope))
		}
		return base
	}

	// Аргумент без скобок: sin 2x → sin(2x), но sin x cos x → sin(x)·cos(x)
	function parseTightArgument(): TypeCompiled {
		let result = parsePower()
		for (;;) {
			const token = peek()
			if (!token || token.type === 'op' || (token.type === 'id' && FUNCTIONS[token.value])) return result
			const next = parsePower()
			const a = result
			result = scope => a(scope) * next(scope)
		}
	}

	function parseCall(): TypeCompiled {
		const token = peek()
		if (!token) throw new Error('Выражение оборвалось')
		pos++
		if (token.type === 'num') return () => token.value
		if (token.type === 'op') {
			if (token.value === '(') {
				const inner = parseSum()
				expectOp(')')
				return inner
			}
			if (token.value === '|') {
				absDepth++
				const inner = parseSum()
				absDepth--
				expectOp('|')
				return scope => Math.abs(inner(scope))
			}
			throw new Error(`Лишний знак «${token.value}»`)
		}
		const name = token.value
		const fn = FUNCTIONS[name]
		if (fn) {
			// sin(x), sin x, sin^2 x
			let power: TypeCompiled | null = null
			if (isOp('^')) {
				pos++
				power = parseCall()
			}
			let args: TypeCompiled[]
			if (isOp('(')) {
				pos++
				args = [parseSum()]
				while (isOp(',')) {
					pos++
					args.push(parseSum())
				}
				expectOp(')')
			} else args = [parseTightArgument()]
			const call: TypeCompiled = scope => fn(...args.map(arg => arg(scope)))
			return power ? scope => Math.pow(call(scope), power!(scope)) : call
		}
		if (name in CONSTANTS) {
			const value = CONSTANTS[name]
			return () => value
		}
		if (known.has(name)) return scope => scope[name]
		throw new Error(`Неизвестное имя «${name}»`)
	}

	const result = parseSum()
	if (pos < tokens.length) throw new Error('Не получилось разобрать выражение')
	return result
}

/** Число из записи вроде «-2π», «π/2», «3.5» */
export function evaluateConstant(source: string) {
	return compile(source, [])({})
}

/** Подпись для числа, кратного π/12 (π/2, 2π/3…), иначе — десятичная */
export function formatPi(value: number) {
	const steps = Math.round((value / Math.PI) * 12)
	if (Math.abs(value - (steps * Math.PI) / 12) > 1e-9) return formatNumber(value)
	if (steps === 0) return '0'
	const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
	const divisor = gcd(Math.abs(steps), 12)
	const numerator = steps / divisor
	const denominator = 12 / divisor
	const top = numerator === 1 ? 'π' : numerator === -1 ? '−π' : `${String(numerator).replace('-', '−')}π`
	return denominator === 1 ? top : `${top}/${denominator}`
}

export function formatNumber(value: number) {
	if (!Number.isFinite(value)) return '—'
	const rounded = Math.round(value * 1000) / 1000
	return String(rounded).replace('-', '−').replace('.', ',')
}
