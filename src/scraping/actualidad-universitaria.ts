import puppeteer, {Page} from "puppeteer";
import * as fs from "node:fs";
import { v4 as uuidv4 } from 'uuid';
import {ArticleSchema} from "./article.schema";
import {cleanContent, wait} from "./common";

const scrapArticle = async (page: Page, url: string): Promise<ArticleSchema> => {
    await page.goto(url, { waitUntil: "networkidle2" });
    const content = await page.$eval("div.single_content", el => {
        return el.textContent;
    })
    const urlSplitted = url.split('/');
    const tags = await page.$$eval("div.meta_data span a", els => {
        return els.map(e => e.textContent);
    });

    return {
        uuid: uuidv4(),
        title: await page.title(),
        url,
        content: cleanContent(content),
        metadata: {
            category: 'Actualidad universitaria',
            tags,
            date: `${urlSplitted[5]}/${urlSplitted[4]}/${urlSplitted[3]}`
        }
    }

}

const init = async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    await page.goto('https://comunicacion.unex.es/noticias/', { waitUntil: "networkidle2" });

    // Aceptar las cookies
    await page.locator('::-p-text(Aceptar)').click();

    // Obtener artículos (páginas 1-5)
    const articleLinks: string[] = [];
    for (let i = 2; i <= 5; i++) {
        const links: string[] = await page.$$eval("h2.uex-accesibility-card-title a", els => {
            return els.map(e => e.href);
        });
        links.forEach(l => articleLinks.push(l));
        await page.goto(`https://comunicacion.unex.es/noticias/page/${i}`, { waitUntil: "networkidle2" });
    }

    const output: ArticleSchema[] = [];
    // Obtener información de cada artículo
    for (const link of articleLinks) {
        const data = await scrapArticle(page, link);
        output.push(data);
        await wait(500);
    }

    //const data = await scrapArticle(page, articleLinks[0]);
    fs.writeFileSync('src/scraping/results/actualidad-universitaria.json', JSON.stringify(output));

    const screenshot = await page.screenshot();
    fs.writeFileSync('prueba.jpg', screenshot);
    await browser.close();
}

init();