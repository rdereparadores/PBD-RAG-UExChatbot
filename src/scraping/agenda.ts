import puppeteer, {Browser, Page} from "puppeteer";
import fs from "node:fs";
import {cleanContent, wait} from "./common";
import {v4 as uuidv4} from 'uuid';
import {ArticleSchema} from "./article.schema";

const scrapUpcomingEvents = async (page: Page): Promise<ArticleSchema[]> => {
    const content = await page.$$eval('div.o_card__footer', els => {
        return els.map(el => {
            const title: any = el.querySelector('p.main a');
            const otherData = el.querySelectorAll('p.other_data');
            const date = otherData[1].textContent.split('-')[0].trim();

            return {
                title: title.textContent,
                url: title!.href,
                content: `${title.textContent} tendrá lugar en ${otherData[0].textContent}`,
                metadata: {
                    category: 'Agenda - Próximos eventos',
                    tags: [],
                    date
                }
            }
        })
    });

    return content.map(i => ({
        uuid: uuidv4(),
        ...i
    }));
};

const scrapOngoingEvents = async (page: Page) => {
    const content = await page.$$eval('div.o-card__detail a', els => {
        return els.map(el => {
            const title = el.querySelector('h1');
            const other = el.querySelectorAll('p');

            return {
                title: title!.textContent,
                url: el.href,
                metadata: {
                    date: other[0].textContent
                }
            }
        });
    })

    const output: ArticleSchema[] = [];
    for (const item of content) {
        await page.goto(item.url, { waitUntil: 'networkidle2' });
        const content = await page.$eval('div#description-container', el => {
            return el.textContent;
        });
        const tags = await page.$$eval('dl.tags dd', els => {
            return els.map(el => el.textContent);
        });

        output.push({
            uuid: uuidv4(),
            title: item.title,
            url: item.url,
            content: cleanContent(content),
            metadata: {
                category: 'Agenda - Eventos actuales',
                tags,
                date: item.metadata.date
            }
        })
    }
    return output;
}

const init = async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({width: 1366, height: 768});

    await page.goto('https://eventos.unex.es/', {waitUntil: 'networkidle2'});
    const upcomingEvents = await scrapUpcomingEvents(page);
    const ongoingEvents = await scrapOngoingEvents(page);

    const allEvents = [...upcomingEvents, ...ongoingEvents];
    fs.writeFileSync('src/scraping/results/agenda.json', JSON.stringify(allEvents));

    const screenshot = await page.screenshot();
    fs.writeFileSync('prueba.jpg', screenshot);
    await browser.close();
}

init();