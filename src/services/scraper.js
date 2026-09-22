import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Extract content, images, and title from a URL
 */
async function extractContentAndImages(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 5000
        });

        const $ = cheerio.load(data);

        // Extract full title (try multiple sources)
        let title = $('meta[property="og:title"]').attr('content')
            || $('meta[name="title"]').attr('content')
            || $('title').text()
            || $('h1').first().text()
            || "";
        title = title.trim();

        // Extract images
        const images = [];
        $("img").each((i, el) => {
            let src = $(el).attr("src");
            if (src && !src.includes("icon") && !src.includes("logo") && src.length > 20) {
                if (src.startsWith("//")) src = "https:" + src;
                images.push(src);
            }
        });

        // Extract text content
        $("script, style, nav, footer, header, iframe, .ads, .advertisement").remove();
        let text = $("article").text() || $(".content").text() || $("body").text();
        text = text.replace(/\s+/g, " ").slice(0, 3000);

        return { text, images: [...new Set(images)].slice(0, 5), title };

    } catch (e) {
        console.warn(`⚠️ Scraping diblokir/gagal (${url}): ${e.message}`);
        return { text: "", images: [], title: "" };
    }
}

export { extractContentAndImages };

