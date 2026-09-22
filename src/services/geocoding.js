import dotenv from "dotenv";
dotenv.config();

const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;

/**
 * Geocoding pintar dengan multiple fallback strategies
 */
async function hierarchicalGeocode(text) {
    if (!text || text.length < 3 || text.toLowerCase().includes("tidak terdeteksi")) return null;

    const cleanInput = text.replace(/di |kawasan |wilayah |daerah |sekitar /gi, "");
    console.log(`📍 Geo Input: "${cleanInput}"`);

    const fetchLoc = async (query) => {
        if (!query || query.length < 3) return null;
        let q = query.toLowerCase().includes("indonesia") ? query : `${query}, Indonesia`;
        q = q.replace(/[^\w\s,\.-]/gi, '');
        const url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=1&normalizeaddress=1&countrycodes=id`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon),
                    display_name: data[0].display_name,
                    components: data[0].address || {}
                };
            }
        } catch (e) { }
        return null;
    };

    // 1. Coba Full Text
    let result = await fetchLoc(cleanInput);
    if (result) return result;

    // 2. Coba Cari POI
    const poiKeywords = ["Taman", "Gedung", "Jalan", "Jl", "Jl.", "Pasar", "Rumah Sakit", "RSUD", "Bandara", "Pelabuhan", "Masjid", "Gereja", "Sekolah", "SD", "SMP", "Kampus", "Hotel", "SPBU", "Terminal"];
    for (const keyword of poiKeywords) {
        const regex = new RegExp(`(${keyword}\\s+[\\w\\s\\d]+?)(?:,|\\smasuk|\\sdekat|\\ssebelah|$)`, "i");
        const match = cleanInput.match(regex);
        if (match) {
            result = await fetchLoc(match[1]);
            if (result) return result;
        }
    }

    // 3. Coba Cari Level Admin
    const adminLevels = ["Kecamatan", "Distrik", "Kelurahan", "Desa", "Kabupaten", "Kota", "Provinsi"];
    for (const level of adminLevels) {
        const regex = new RegExp(`${level}\\s+([A-Za-z0-9\\s\\-]+)`, "i");
        const match = cleanInput.match(regex);
        if (match) {
            result = await fetchLoc(match[0]);
            if (result) return result;
        }
    }

    // 4. Strategi Terakhir
    const parts = cleanInput.split(/,|\./);
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].trim();
        result = await fetchLoc(lastPart);
        if (result) return result;
    }
    return null;
}

/**
 * Build hierarchy from geocoding components
 */
function buildHierarchyFromComponents(components, fallbackText) {
    const h = { raw: components || {}, fallback: fallbackText };
    if (!components) return h;
    h.provinsi = components.state || components.province || components.region;
    h.kab_kota = components.city || components.county || components.town;
    h.kecamatan = components.suburb || components.district;
    return h;
}

export { hierarchicalGeocode, buildHierarchyFromComponents };
