import puppeteer, {Page} from "puppeteer";
import fs from "node:fs";
import {v4 as uuidv4} from "uuid";
import {ArticleSchema} from "../../../../Documents/UNIVERSIDAD/CURSO 4/PBD/PBD-RAG-UExChatbot-develop/src/scraping/article.schema";
import {cleanContent, wait} from "../../../../Documents/UNIVERSIDAD/CURSO 4/PBD/PBD-RAG-UExChatbot-develop/src/scraping/common";

const scrapProfesores = async (page: Page, url: string): Promise<ArticleSchema> => {
    try {
        await page.goto(url, {waitUntil: "networkidle2"});

        const now = new Date();
        const day = String(now.getDate()).padStart(2, "0");
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const year = now.getFullYear();
        const date = day + month + year;

        const nombre = await page.$eval("#person-title", el => {
            return el.textContent
        })

        //Profesor o personal cientifico
        const rol = await page.$$eval('strong.text-dark', els => {
            return els[0].textContent
        })

        const sitioHabitual = cleanContent(await page.$eval('div.d-flex', el => {
            return el.textContent
        }))

        //Array con las urls necesarias
        //El primer valor es siempre el departamento
        //El segundo es siempre el sitio donde trabaja(Diria q todos son en la epcc)
        //Tercer valor es el correo de la persona
        //El resto de valores si existen son los enlaces los grupos de investigación, Scopues, Dialnet, etc...
        const enlacesInteresTexto = await page.$$eval('p.lh-sm a', els => {
            return els.map(el => el.textContent.trim())
        })
        const enlacesInteresUrl = await page.$$eval('p.lh-sm a', els => {
            return els.map(el => el.href)
        })

        const telefono = cleanContent(await page.$$eval('p.lh-sm.ps-1', els => {
            return els[2]?.textContent?.trim() || "No existe teléfono";
        }))

        const tutoriasSucias = await page.$$eval('table.table.m-0', els => {
            return els.length ? els.map(el => el.textContent.trim()) : [];
        });

        const tutoriasLimpias: string[] = []
        for (const tutoria of tutoriasSucias) {
            tutoriasLimpias.push(cleanContent(tutoria))
        }

        return {
            uuid: uuidv4(),
            title: `${nombre}`,
            url,
            content: `Rol: ${rol}, Sitio habitual: ${sitioHabitual},Departamento: title:${enlacesInteresTexto[0]}, url:${enlacesInteresUrl[0]}, Sitio donde trabaja: title:${enlacesInteresTexto[1]}, url:${enlacesInteresUrl[1]}, correo: ${enlacesInteresTexto[2]}, telefono: ${telefono} , tutorias: ${tutoriasLimpias}`,
            metadata: {
                category: `${rol}`,
                tags: [`${rol}`,],
                date: date
            }
        }
    }catch {
        return {
            uuid: "null",
            title: "",
            url,
            content: "",
            metadata: {
                category: "",
                tags: [],
                date: ""
            }
        }
    }
}

const init = async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setViewport({width: 1366, height: 768});

    await page.goto('https://epcc.unex.es/centro/pdi/', {waitUntil: 'networkidle2'});

    // Aceptar las cookies
    await page.locator('::-p-text(Aceptar)').click();

    const articleLinks: string[] = [];
    const links: string[] = await page.$$eval("#mix-wrapper li a", els => {
        return els.map(e => e.href);
    });
    links.forEach(l => articleLinks.push(l));

    const output: ArticleSchema[] = [];
    for (const link of articleLinks) {
        const data = await scrapProfesores(page, link);
        if(data.uuid !== "null") {
            console.log(data)
            output.push(data);
            await wait(1000);
        }
    }

    fs.writeFileSync('src/scraping/results/profesoradoEPCC.json', JSON.stringify(output));

    await browser.close();
    return null
}

init();