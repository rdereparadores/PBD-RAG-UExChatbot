import puppeteer, {Page} from "puppeteer";
import fs from "node:fs";
import {ArticleSchema} from "./article.schema";
import {v4 as uuidv4} from "uuid";
import {cleanContent, wait} from "./common";

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

        return {
            uuid: uuidv4(),
            title: title,
            url,
            content: cleanContent(content),
            metadata: {
                category: 'Gobierno de la universidad',
                tags: [title],
                date: (new Date()).toLocaleDateString()
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
            //console.log(data)
            output.push(data);
            await wait(500);
        }
    }

    //console.log(output)

    fs.writeFileSync('src/scraping/results/gobierno-uex.json', JSON.stringify(output));
    await browser.close();
}

init();