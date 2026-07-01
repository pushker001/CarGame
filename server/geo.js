// IP Geolocation using ip-api.com free tier
// Returns { country, countryCode, flag }

const CACHE = new Map(); // ip → geo data
const FLAG_BASE = 0x1F1E6 - 65; // A = 0x1F1E6

export async function geolocate(ip) {
  // Sanitize local IPs
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')) {
    return { country: 'Localhost', countryCode: 'XX', flag: '🌍' };
  }

  if (CACHE.has(ip)) return CACHE.get(ip);

  try {
    const res  = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode`);
    const data = await res.json();
    const result = {
      country:     data.country     || 'Unknown',
      countryCode: data.countryCode || 'XX',
      flag:        countryFlag(data.countryCode || ''),
    };
    CACHE.set(ip, result);
    return result;
  } catch {
    return { country: 'Unknown', countryCode: 'XX', flag: '🌍' };
  }
}

function countryFlag(code) {
  if (!code || code.length !== 2) return '🌍';
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    FLAG_BASE + upper.charCodeAt(0),
    FLAG_BASE + upper.charCodeAt(1)
  );
}
