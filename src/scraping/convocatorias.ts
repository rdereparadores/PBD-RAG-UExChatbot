import puppeteer, {Page} from "puppeteer";
import {ArticleSchema} from "./article.schema";
import {v4 as uuidv4} from "uuid";
import fs from "node:fs";

const scrapConvocatorias = async (page: Page): Promise<ArticleSchema[]> => {
    const convoactoriasGenerales = await page.$$eval("div.single_content ul li a", els => {
        return els.map( (el,index) => {
            if(index <= 3) {
                const title = "Convocatoria de enero/mayo " + el.textContent.trim();
                const url = el.href;

                return {
                    title,
                    url,
                    content: `Documento donde vienen las fechas de éxamenes para el grado de ${el.textContent.trim()}`,
                    metadata: {
                        caegory: "Convocatorias de éxamenes de Grado",
                        tags: ["Grado", el.textContent.trim()],
                    }
                };
            }else{
                const title = el.textContent.trim();
                const url = el.href;

                return {
                    title,
                    url,
                    content: `Documento donde vienen las fechas de éxamenes para todos los másteres}`,
                    metadata: {
                        caegory: "Convocatorias de éxamenes de Master",
                        tags: ["Master", el.textContent.trim()],
                    }
                };
            }
        });
    });

    const convocatoriasGeneralesConUUID = convoactoriasGenerales.map(item => ({
        uuid: uuidv4(),
        ...item,
        metadata: {
            category: 'Convocatorias de exámenes',
            tags: item.metadata.tags,
            date: (new Date()).toLocaleDateString()
        }
    }));

    const convocatorias: ArticleSchema[] = []
    convocatoriasGeneralesConUUID.forEach(l => convocatorias.push(l));

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