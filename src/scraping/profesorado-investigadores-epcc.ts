import puppeteer, {Page} from "puppeteer";
import fs from "node:fs";
import {v4 as uuidv4} from "uuid";
import {ArticleSchema} from "./article.schema";
import {cleanContent, wait} from "./common";

const scrapProfesores = async (page: Page, url: string): Promise<ArticleSchema> => {
    try {
        await page.goto(url, {waitUntil: "networkidle2"});

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

        const facultades = await page.$eval('ul.list.list-icons', ul => {
            let out = '';

            // 1. Facultades = li directos del ul principal
            const facultadesItems = ul.querySelectorAll(':scope > li');

            facultadesItems.forEach(facultad => {
                const nombreFacultad = facultad.querySelector(':scope > a')?.textContent.trim() || 'Sin nombre';

                out += `Facultad: ${nombreFacultad}\n`;

                // 2. Grados = ul hijo directo > li
                const gradosItems = facultad.querySelectorAll(':scope > ul > li');

                gradosItems.forEach(grado => {
                    const nombreGrado = grado.querySelector(':scope > a')?.textContent.trim() || 'Sin nombre';
                    out += `  Grado: ${nombreGrado}\n`;

                    // 3. Asignaturas = ul hijo directo > li > a
                    const asignaturas = grado.querySelectorAll(':scope > ul > li > a');

                    asignaturas.forEach(asig => {
                        out += `    - ${asig.textContent.trim()}\n`;
                    });
                });

                out += '\n';
            });

            return out.trim();
        });

        return {
            uuid: uuidv4(),
            title: `${nombre}`,
            url,
            content: `Rol: ${rol}, Sitio habitual: ${sitioHabitual},Departamento: title:${enlacesInteresTexto[0]}, url:${enlacesInteresUrl[0]}, Sitio donde trabaja: title:${enlacesInteresTexto[1]}, url:${enlacesInteresUrl[1]}, correo: ${enlacesInteresTexto[2]}, telefono: ${telefono} , tutorias: ${tutoriasLimpias}, informacion sobre facultades, grados y asignaturas en las que imparte: ${facultades}`,
            metadata: {
                category: `${rol}`,
                tags: [`${rol}`,"Asignaturas", "Facultades", "Grados"],
                date: (new Date()).toLocaleDateString()
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