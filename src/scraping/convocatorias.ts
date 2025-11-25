import puppeteer, {Page} from "puppeteer";
import {ArticleSchema} from "../../../../Documents/UNIVERSIDAD/CURSO 4/PBD/PBD-RAG-UExChatbot-develop/src/scraping/article.schema";
import {v4 as uuidv4} from "uuid";
import fs from "node:fs";

const scrapConvocatorias = async (page: Page): Promise<ArticleSchema[]> => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();

    const date = day + month + year;

    const convoactoriasGenerales = await page.$$eval("div.single_content ul li a", els => {
        return els.map( el => {
            const title = el.textContent.trim();
            const url = el.href;

            return {
                title,
                url,
                content: `${title} el pdf es el siguiente: ${url}`,
                metadata: {
                    tags: [],
                }
            };
        });
    });

    const convocatoriasGeneralesConUUID = convoactoriasGenerales.map(item => ({
        uuid: uuidv4(),
        ...item,
        metadata: {
            category: 'Convocatorias de exámenes',
            tags: item.metadata.tags,
            date: date
        }
    }));

    const convocatoriasPorGrado = await page.$$eval("div.single_content ol li a", els => {
        return els.map( (item,index) => {
            const title = item.textContent.trim();
            const url = item.href;

            let content: string
            let tag:string
            if(index <= 3){
                content= `Convocatoria de Enero-Mayo del ${title}, el pdf es: ${url}`
                tag = `Convocatoria Enero-Mayo`
            }else{
                content = `Convocatoria de Mayo-Junio/Junio-Julio del ${title}, el pdf es: ${url}`
                tag = `Convocatoria Mayo-Junio/Junio-Julio`
            }

            return {
                title,
                url,
                content: content,
                metadata:{
                    tags:[tag]
                }
            };
        });
    });

    const convocatoriasPorGradoConUUID = convocatoriasPorGrado.map(item => ({
        uuid: uuidv4(),
        ...item,
        metadata: {
            category: 'Convocatorias de exámenes',
            tags: item.metadata.tags,
            date: date
        }
    }));

    const convocatorias: ArticleSchema[] = []
    convocatoriasGeneralesConUUID.forEach(l => convocatorias.push(l));
    convocatoriasPorGradoConUUID.forEach(l => convocatorias.push(l));

    return convocatorias
}

const init = async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({width: 1366, height: 768});

    await page.goto('https://epcc.unex.es/informacion-academica/examenes/', {waitUntil: 'networkidle2'});

    // Aceptar las cookies
    await page.locator('::-p-text(Aceptar)').click();

    const convocatoriasResultado = await scrapConvocatorias(page)

    fs.writeFileSync('src/scraping/results/convocatorias-examenes.json', JSON.stringify(convocatoriasResultado));

    await browser.close();
    return null
}

init();