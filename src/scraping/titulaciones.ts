import puppeteer, {Page} from "puppeteer";
import {cleanContent, wait} from "./common";
import fs from "node:fs";
import {ArticleSchema} from "./article.schema";
import {v4 as uuidv4} from 'uuid';
import {PDFParse} from "pdf-parse";

const scrapTitleOrMaster = async (page: Page, url: string) => {
	while (true) {
		try {
			await page.goto(url, {waitUntil: 'networkidle2'});
			break;
		} catch (error) {
			console.log('Error al acceder a ' + url);
			await wait(10000);
		}
	}

	while (await page.$('div.coming-soon')) {
		console.log('Rate limit excedido');
		await wait(10000);
		await page.reload({waitUntil: 'networkidle2'});
	}

	await page.evaluate(() => {
		const btn: HTMLButtonElement | null = document.querySelector('button.uca_ck_bt_accept');
		if (btn) btn.click();
	})

	const name = await page.$eval('h1.py-2', el => el.textContent);
	const info = await page.$eval('div.p-relative.z-index-2', el => {
		const durationAndModality = el.querySelectorAll('p.card-text');

		const creditsTable = el.querySelector('tbody');
		const creditItems = creditsTable?.querySelectorAll('tr');
		const credits: any = {};
		creditItems!.forEach(creditItem => {
			const type = creditItem.querySelector('th')!.textContent;
			credits[type] = creditItem.querySelector('td')!.textContent;
		});

		const center = el.querySelector('div a')!.textContent;

		return {
			duration: durationAndModality[0].textContent.trim(),
			modality: durationAndModality[1].textContent.trim(),
			credits,
			center
		}
	});

	await page.locator('::-p-text(Asignaturas y planes docentes)').click();
	const courses: any = await page.$eval('div#tab-subjects', el => {
		const courses = el.querySelectorAll('h3');
		const subjectsPerCourse = el.querySelectorAll('tbody');
		const result: any = [];
		courses.forEach((course, index) => {
			const subjects = subjectsPerCourse[index].querySelectorAll('tr');
			const subjectInfo: any = [];
			subjects.forEach(subject => {
				const info = subject.querySelectorAll('td');
				subjectInfo.push({
					name: subject.querySelector('a')?.textContent.replace(/[\n\t]+/g, ' ').trim(),
					url: subject.querySelector('a')?.href,
					id: subject.querySelector('a')?.href.split('subjectid=')[1],
					type: info[1].textContent,
					credits: info[2].textContent,
					semester: info[3].textContent.replace(/[\n\t]+/g, ' ').trim()
				})
			})
			result.push({
				name: course.textContent,
				subjects: subjectInfo
			});
		})
		return result;
	})

	await page.locator('::-p-text(Salidas profesionales)').click();
	const jobs = await page.$eval('div.toggle-content', el => el.textContent);

	return {
		name: cleanContent(name),
		info,
		courses,
		jobs: cleanContent(jobs)
	}
}

const createArticle = (data: any) => {
	return {
		uuid: uuidv4(),
		title: data.name,
		url: data.link,
		metadata: {
			category: data.category,
			tags: [data.info.center],
			date: (new Date()).toLocaleDateString()
		},
		content: `
			NOMBRE DE LA TITULACIÓN: ${cleanContent(data.name)}
			DURACIÓN: ${cleanContent(data.info.duration)}
			MODALIDAD: ${cleanContent(data.info.modality)}
			CENTRO EN EL QUE SE IMPARTE: ${cleanContent(data.info.center)}
			-------------------------
			SALIDAS DE LA TITULACIÓN: ${data.jobs}
			-------------------------
			PLANIFICACIÓN:
			
			${data.courses.map((item: any) => `
			
				${item.name}
				ASIGNATURAS:
				${item.subjects.map((subject: any) => `
					- ${subject.name}
					  ID: ${subject.id}
					  TIPO: ${subject.type}
					  SEMESTRE: ${subject.semester}
					  CRÉDITOS: ${subject.credits}
				`)}
				-------------------------
			`)}
			`,
	}
}

const scrapSubject = async (page: Page, url: string) => {
	if (!url || url === '') return '';
	while (true) {
		try {
			await page.goto(url, {waitUntil: 'networkidle2'});
			break;
		} catch (error) {
			console.log('Error al acceder a ' + url);
			await wait(10000);
		}
	}

	while (await page.$('div.coming-soon')) {
		console.log('Rate limit excedido');
		await wait(10000);
		await page.reload({waitUntil: 'networkidle2'});
	}

	let ficha12A: string;
	try {
		ficha12A = await page.$eval('li.text-capitalize a', el => el.href);
	} catch {
		return '';
	}
	while (true) {
		try {
			const pdfParse = new PDFParse({ url: ficha12A });
			const result = await pdfParse.getText();
			return result.text;
		} catch (error) {
			console.log('Rate limit excedido');
			await wait(10000);
		}
	}

}

const init = async () => {
	const browser = await puppeteer.launch({headless: false});
	const page = await browser.newPage();
	await page.setViewport({width: 1366, height: 768});

	await page.goto('https://www.unex.es/estudiar-en-la-uex/estudios/', {waitUntil: 'networkidle2'});
	await page.locator('::-p-text(Grados)').click();

	const titleLinks = await page.$$eval('li.grados div div div a', els => {
		return els.map(el => el.href);
	});

	const masterLinks = await page.$$eval('li.masteres div div div a', els => {
		return els.map(el => el.href);
	});

	const titles: ArticleSchema[] = [];
	const titleNames: ArticleSchema = {
		uuid: uuidv4(),
		title: 'Todos los títulos de grado',
		url: 'https://www.unex.es/estudiar-en-la-uex/estudios/',
		content: '',
		metadata: {
			category: 'Titulaciones de grado',
			tags: [],
			date: (new Date()).toLocaleDateString()
		}
	}

	const masters: ArticleSchema[] = [];
	const masterNames: ArticleSchema = {
		uuid: uuidv4(),
		title: 'Todos los másteres',
		url: 'https://www.unex.es/estudiar-en-la-uex/estudios/',
		content: '',
		metadata: {
			category: 'Titulaciones de máster',
			tags: [],
			date: (new Date()).toLocaleDateString()
		}
	}

	const subjectInfo: { url: string, name: string, id: string }[] = [];

	for (const link of titleLinks.filter(t => t.includes('unex'))) {
		const title = await scrapTitleOrMaster(page, link);
		titles.push(createArticle({...title, url: link, category: 'Titulaciones de grado'}));

		title.courses.forEach((course: any) => {
			course.subjects.forEach((subject: any) => {
				if (!subjectInfo.some(s => s.id === subject.id)) {
					subjectInfo.push({ url: subject.url, name: subject.name, id: subject.id });
				}
			})
		})
		titleNames.content += `NOMBRE: ${title.name} URL: ${link}\n`;
	}
	titles.push(titleNames);

	for (const link of masterLinks.filter(t => t.includes('unex'))) {
		const master = await scrapTitleOrMaster(page, link);
		masters.push(createArticle({...master, url: link, category: 'Titulaciones de máster'}));

		master.courses.forEach((course: any) => {
			course.subjects.forEach((subject: any) => {
				if (!subjectInfo.some(s => s.id === subject.id)) {
					subjectInfo.push({ url: subject.url, name: subject.name, id: subject.id });
				}
			})
		})
		masterNames.content += `NOMBRE: ${master.name} URL: ${link}\n`;
	}
	masters.push(masterNames);

	const subjects: ArticleSchema[] = [];
	for (const subject of subjectInfo) {
		const text = await scrapSubject(page, subject.url);
		subjects.push({
			uuid: uuidv4(),
			title: `${subject.name} - ID ${subject.id}`,
			url: subject.url,
			content: text,
			metadata: {
				category: 'Asignaturas',
				tags: [],
				date: (new Date()).toLocaleDateString()
			}
		})
	}

	fs.writeFileSync('src/scraping/results/titulaciones-grado.json', JSON.stringify(titles));
	fs.writeFileSync('src/scraping/results/titulaciones-master.json', JSON.stringify(masters));
	fs.writeFileSync('src/scraping/results/titulaciones-asignaturas.json', JSON.stringify(subjects));
	//fs.writeFileSync('src/scraping/titulaciones-subject-ids.json', JSON.stringify(subjectUrls));

	await browser.close();
}

init();