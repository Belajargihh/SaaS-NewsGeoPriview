import dotenv from "dotenv";
dotenv.config();

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Schema untuk analisis berita
const AnalisisSchema = z.object({
    lokasi_kejadian: z.string().describe("Lokasi spesifik kejadian (Jalan, Gedung, Kelurahan, Kecamatan, Kota, Provinsi)."),
    ringkasan_interaktif: z.string().describe("Artikel berita lengkap (Minimal 3 paragraf/300 kata). Harus mencakup kronologi, penyebab, dampak, dan kutipan jika ada."),
    status_validitas: z.enum(["Terpercaya", "Perlu Verifikasi", "Indikasi Hoaks"]).describe("Klasifikasi validitas berita."),
    skor_kepercayaan: z.number().min(0).max(100).describe("Skor kepercayaan 0-100 berdasarkan gaya bahasa, sumber, dan logika."),
    analisis_hoaks: z.string().describe("Penjelasan singkat mengapa berita ini valid atau terindikasi hoaks.")
});

let analysisChain = null;
let modelSiap = false;

try {
    const llm = new ChatGoogleGenerativeAI({
        model: "gemini-1.5-flash",
        apiKey: GOOGLE_API_KEY,
        temperature: 0.2,
    });

    const parser = StructuredOutputParser.fromZodSchema(AnalisisSchema);
    const formatInstructions = parser.getFormatInstructions();
    const safeFormatInstructions = formatInstructions.replaceAll("{", "{{").replaceAll("}", "}}");

    const prompt = ChatPromptTemplate.fromMessages([
        {
            role: "system",
            content: `Kamu adalah Jurnalis Senior Investigasi dan Analis Geospasial.
Tugas Utama:
1. **Identifikasi Lokasi** secara presisi.
2. **Tulis Ulang Berita secara Lengkap (Deep Dive)**:
   - JANGAN membuat ringkasan pendek 4-5 baris. Itu DILARANG.
   - Buatlah narasi yang **panjang, mendalam, dan terstruktur** (Minimal 250-300 kata).
   - Gunakan struktur berikut:
     * **Paragraf 1 (Lead)**: Inti peristiwa (5W+1H) yang memikat.
     * **Paragraf 2 (Kronologi)**: Urutan kejadian dari awal hingga akhir secara detail.
     * **Paragraf 3 (Dampak & Konteks)**: Korban jiwa, kerugian materi, respons aparat, atau kaitan dengan peristiwa lain.
3. **Analisis Validitas (Anti-Hoaks)**:
   - Cek fakta, sumber, dan logika tulisan.

Instruksi Output JSON:
${safeFormatInstructions}`
        },
        { role: "user", content: "{input}" },
    ]);

    analysisChain = prompt.pipe(llm).pipe(parser);
    modelSiap = true;
    console.log("✅ Model Gemini (1.5 Flash) Siap - Mode Jurnalis Senior.");
} catch (err) {
    console.error("❌ Gagal init Gemini:", err);
}

export { analysisChain, modelSiap };
