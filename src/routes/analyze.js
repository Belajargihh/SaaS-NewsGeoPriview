import express from "express";
import { analysisChain, modelSiap } from "../config/gemini.js";
import { hierarchicalGeocode, buildHierarchyFromComponents } from "../services/geocoding.js";
import { searchGoogle } from "../services/googleSearch.js";
import { extractContentAndImages } from "../services/scraper.js";
import { generateNewsPDF } from "../services/pdfService.js";

const router = express.Router();

// --- Highlight Cache ---
let highlightCache = null;
let lastHighlightTime = 0;
const CACHE_DURATION = 15 * 60 * 1000;

// --- A. Endpoint Utama (Search) ---
router.post("/analyze", async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query kosong" });

    try {
        const promptInput = `${query}\n\nIdentifikasi lokasi dan ringkas singkat (1 paragraf).`;
        const [analisis, artikel] = await Promise.all([
            modelSiap ? analysisChain.invoke({ input: promptInput }).catch(() => ({})) : {},
            searchGoogle(query, 10)
        ]);

        let geo = null;
        if (analisis.lokasi_kejadian) {
            geo = await hierarchicalGeocode(analisis.lokasi_kejadian);
        }

        res.json({
            lokasi_kejadian: analisis.lokasi_kejadian || "Tidak terdeteksi",
            ringkasan_interaktif: analisis.ringkasan_interaktif || "Ringkasan belum tersedia",
            status_validitas: analisis.status_validitas || "Perlu Verifikasi",
            skor_kepercayaan: analisis.skor_kepercayaan || 50,
            koordinat: geo,
            lokasi_hirarki: buildHierarchyFromComponents(geo?.components, analisis.lokasi_kejadian),
            artikel_terkait: artikel,
            gambar_pendukung: []
        });

    } catch (err) {
        console.error("API Error:", err);
        res.status(500).json({ error: "Gagal memproses permintaan" });
    }
});

// --- B. Endpoint Detail (Detail + Peta + VALIDASI HOAKS + LONG FORM) ---
router.post("/analyze-url", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL kosong" });

    try {
        console.log(`📖 Menganalisis (Long Form): ${url}`);

        const { text, images, title } = await extractContentAndImages(url);

        let inputUntukAI = "";
        if (text && text.length > 100) {
            inputUntukAI = `ISI BERITA: ${text}\nURL: ${url}`;
        } else {
            inputUntukAI = `Konten berita tidak dapat diakses (diblokir). 
            Tolong analisis berdasarkan URL ini saja: ${url}
            Cobalah tebak lokasi dan buat narasi mendalam tentang topik yang ada di URL tersebut.`;
        }

        const teksAnalisis = `${inputUntukAI}. 
        Tugas: 
        1. Identifikasi lokasi spesifik.
        2. TULIS ARTIKEL/RINGKASAN YANG PANJANG DAN MENDALAM (Minimal 3-4 Paragraf). Jelaskan kronologi, penyebab, dan dampak secara rinci.
        3. Cek validitas (hoaks/valid).`;

        let analisis = {};
        if (modelSiap && analysisChain) {
            try {
                analisis = await analysisChain.invoke({ input: teksAnalisis });
            } catch (aiErr) {
                console.warn("AI invoke failed:", aiErr.message);
            }
        }

        let geo = null;
        if (analisis.lokasi_kejadian) {
            geo = await hierarchicalGeocode(analisis.lokasi_kejadian);
        }

        res.json({
            judul_berita: title || "Detail Berita",
            lokasi_kejadian: analisis.lokasi_kejadian || "Lokasi belum terdeteksi",
            ringkasan_interaktif: analisis.ringkasan_interaktif || (text ? text.slice(0, 500) : "Ringkasan berita belum tersedia."),
            status_validitas: analisis.status_validitas || "Perlu Verifikasi",
            skor_kepercayaan: analisis.skor_kepercayaan || 50,
            analisis_hoaks: analisis.analisis_hoaks || "Analisis fakta otomatis.",
            koordinat: geo,
            gambar_pendukung: images
        });

    } catch (err) {
        console.error("Detail Error:", err.message);
        res.json({
            judul_berita: "Gagal Memuat",
            lokasi_kejadian: "Tidak terdeteksi",
            ringkasan_interaktif: "Maaf, terjadi kesalahan teknis saat menganalisis berita.",
            status_validitas: "Perlu Verifikasi",
            skor_kepercayaan: 0,
            analisis_hoaks: "Gagal menganalisis.",
            koordinat: null,
            gambar_pendukung: []
        });
    }
});

// --- C. Endpoint Highlights (CACHE) ---
router.get("/highlights", async (req, res) => {
    const now = Date.now();
    if (highlightCache && (now - lastHighlightTime < CACHE_DURATION)) {
        return res.json(highlightCache);
    }
    try {
        console.log("🔄 Fetching Highlights...");
        const artikel = await searchGoogle("Berita Terkini Indonesia", 20);
        const responseData = { status: "ok", highlights: artikel };
        if (artikel.length > 0) {
            highlightCache = responseData;
            lastHighlightTime = now;
        }
        res.json(responseData);
    } catch (e) {
        if (highlightCache) return res.json(highlightCache);
        res.status(500).json({ error: "Gagal load highlight" });
    }
});

// --- D. Extract Images ---
router.post("/extract-images", async (req, res) => {
    const { images } = await extractContentAndImages(req.body.url);
    res.json({ images });
});

// --- E. Generate PDF ---
router.post("/generate-pdf", (req, res) => {
    const { judul, lokasi, ringkasan, url } = req.body;
    if (!judul) return res.status(400).send("Data tidak lengkap");

    const filename = `Report-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    generateNewsPDF({ judul, lokasi, ringkasan, url }, res);
});

export default router;
