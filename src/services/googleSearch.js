import dotenv from "dotenv";
dotenv.config();

const CUSTOM_SEARCH_API_KEY = process.env.CUSTOM_SEARCH_API_KEY;
const CUSTOM_SEARCH_CX = process.env.CUSTOM_SEARCH_CX;

/**
 * Search Google Custom Search API
 */
async function searchGoogle(query, maxResults = 50) {
    const results = [];
    const limit = Math.min(maxResults, 50);
    const PAGE_SIZE = 10;

    for (let start = 1; start <= limit; start += PAGE_SIZE) {
        const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
        endpoint.searchParams.set("key", CUSTOM_SEARCH_API_KEY);
        endpoint.searchParams.set("cx", CUSTOM_SEARCH_CX);
        endpoint.searchParams.set("q", query);
        endpoint.searchParams.set("num", "10");
        endpoint.searchParams.set("start", start.toString());

        try {
            console.log(`🔎 Google Search: "${query}" (Page: ${start})`);
            const response = await fetch(endpoint.toString());

            if (!response.ok) {
                console.error("Google API Error:", response.status);
                break;
            }

            const data = await response.json();
            if (!data.items || data.items.length === 0) break;

            results.push(...data.items.map(item => {
                let thumb = "https://placehold.co/100x80?text=News";
                if (item.pagemap?.cse_image?.length > 0) {
                    thumb = item.pagemap.cse_image[0].src;
                } else if (item.pagemap?.metatags?.length > 0 && item.pagemap.metatags[0]["og:image"]) {
                    thumb = item.pagemap.metatags[0]["og:image"];
                }

                return {
                    judul: item.title,
                    sumber: item.displayLink,
                    url: item.link,
                    snippet: item.snippet,
                    gambar: thumb
                };
            }));
        } catch (err) {
            console.error("Search Fail:", err.message);
            break;
        }
    }
    return results;
}

export { searchGoogle };
