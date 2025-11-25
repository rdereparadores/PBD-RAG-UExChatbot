import puppeteer, {Page} from "puppeteer";
import fs, {linkSync} from "node:fs";
import {ArticleSchema} from "../../../../Documents/UNIVERSIDAD/CURSO 4/PBD/PBD-RAG-UExChatbot-develop/src/scraping/article.schema";
import {v4 as uuidv4} from "uuid";
import {cleanContent, wait} from "../../../../Documents/UNIVERSIDAD/CURSO 4/PBD/PBD-RAG-UExChatbot-develop/src/scraping/common";

const scrapGoverment = async (page: Page, url: string): Promise<ArticleSchema> => {
    await page.goto(url, { waitUntil: "networkidle2" });
    // Aceptar las cookies
    try {
        await page.locator('::-p-text(Aceptar)').click();
    } catch {
    }

    const element = await page.$('div.single_content');
    let content = null;

    if (element) {
        content = await page.evaluate(el => el.textContent, element);
        const title = await page.$eval('#page-h1', el => {
            return el.textContent
        })

        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();

        const date = day + month + year;

        return {
            uuid: uuidv4(),
            title: title,
            url,
            content: cleanContent(content),
            metadata: {
                category: 'Gobierno de la universidad',
                tags: [title],
                date: date
            }
        }
    }
    return {
        uuid: "null",
        title: "",
        url,
        content: "",
        metadata: {
            category: 'Gobierno de la universidad',
            tags: [""],
            date: ""
        }
    }
}

const init = async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({width: 1366, height: 768});

    await page.goto('https://www.unex.es/organizacion/gobierno/', {waitUntil: 'networkidle2'});

    // Aceptar las cookies
    await page.locator('::-p-text(Aceptar)').click();

    const articleLinks: string[] = [];
    const links: string[] = await page.$$eval("div.card-body h2 a", els => {
        return els.map(e => e.href);
    });
    links.forEach(l => articleLinks.push(l));

    //console.log(articleLinks)

    const output: ArticleSchema[] = [];
    for (const link of articleLinks) {
        const data = await scrapGoverment(page, link);
        if(data.uuid !== "null") {
            console.log(data)
            output.push(data);
            await wait(500);
        }
    }

    //console.log(output)

    fs.writeFileSync('src/scraping/results/gobierno-uex.json', JSON.stringify(output));
    await browser.close();
}

init();