import puppeteer, {Page} from "puppeteer";
import fs from "node:fs";
import {v4 as uuidv4} from "uuid";
import {ArticleSchema} from "../../../../Documents/UNIVERSIDAD/CURSO 4/PBD/PBD-RAG-UExChatbot-develop/src/scraping/article.schema";
import {wait} from "../../../../Documents/UNIVERSIDAD/CURSO 4/PBD/PBD-RAG-UExChatbot-develop/src/scraping/common";

const scrapDepartamentos = async (page: Page, url: string): Promise<ArticleSchema> => {
    await page.goto(url, { waitUntil: "networkidle2" });

    await page.locator('::-p-text(Docencia)').click();

    const title = await page.$eval('#department-title', el => {
        return el.textContent
    })

    const grados = await page.$$eval('#accordion-body-grados ul li a', els => {
        return els.map(el => ({
            title: el.textContent.trim(),
            url: el.href
        }))
    })

    const masters = await page.$$eval('#accordion-body-master ul li a', els => {
        return els.map(el => ({
            title: el.textContent.trim(),
            url: el.href
        }))
    })

    const centros = await page.$$eval('#accordion-body-centers ul li a', els => {
        return els.map(el => ({
            title: el.textContent.trim(),
            url: el.href
        }))
    })

    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    const date = day + month + year;

    return {
        uuid: uuidv4(),
        title: `Departamento de ${title}`,
        url,
        content: `Grados:{${grados.map(grado => `Grado: ${grado.title}, URL: ${grado.url}` )}},
         Masters:{${masters.map(master => `Master: ${master.title}, URL: ${master.url}`)}}, 
         Centros:{${centros.map(centro => `Centro: ${centro.title}, URL: ${centro.url}`)}}`,
        metadata: {
            category: 'Departamentos',
            tags: [""],
            date: date
        }
    }

}

const init = async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({width: 1366, height: 768});

    await page.goto('https://www.unex.es/conoce-la-uex/departamentos/', {waitUntil: 'networkidle2'});

    // Aceptar las cookies
    await page.locator('::-p-text(Aceptar)').click();

    const departmentLinks: string[] = [];
    const links: string[]= await page.$$eval("div.uex-accesibility-card-title a", els => {
        return els.map(el =>  el.href );
    });
    links.forEach(l => departmentLinks.push(l))


    const output: ArticleSchema[] = [];
    for (const link of departmentLinks) {
        const data = await scrapDepartamentos(page, link);
        output.push(data);
        await wait(10000);
    }

    fs.writeFileSync('src/scraping/results/departamentos.json', JSON.stringify(output));

    await browser.close();
    return null
}

init();