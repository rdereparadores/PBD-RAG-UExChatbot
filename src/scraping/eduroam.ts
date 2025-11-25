import puppeteer from "puppeteer";
import { v4 as uuidv4 } from 'uuid';
import {ArticleSchema} from "./article.schema";
import fs from "node:fs";

const init = async () => {
	const browser = await puppeteer.launch({ headless: false });
	const page = await browser.newPage();
	await page.setViewport({ width: 1366, height: 768 });

	await page.goto('https://siue.unex.es/catalogo-servicios-tic/comunicaciones/wi-fi-eduroam/', { waitUntil: 'networkidle2' });

	// Aceptar las cookies
	await page.locator('::-p-text(Aceptar)').click();

	const info = await page.$eval('div.toggle.toggle-primary', el => el.textContent);

	const article: ArticleSchema = {
		uuid: uuidv4(),
		title: 'Conectarse a eduroam',
		url: 'https://siue.unex.es/catalogo-servicios-tic/comunicaciones/wi-fi-eduroam/',
		content: info,
		metadata: {
			category: 'eduroam',
			tags: [ 'eduroam' ],
			date: (new Date()).toLocaleDateString()
		}
	}

	fs.writeFileSync('src/scraping/results/eduroam.json', JSON.stringify([article]));

	await browser.close();
}

init();