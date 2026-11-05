/** @type {import('next').NextConfig} */
const nextConfig = {
	// Запасной путь к базе для сетей, где прямой адрес Supabase не отвечает (lib/supabase/connection.ts)
	async rewrites() {
		const supabase =
			process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rlnqozoalmzboqypgbcq.supabase.co'
		return [{ source: '/sb/:path*', destination: `${supabase}/:path*` }]
	}
};

export default nextConfig;
