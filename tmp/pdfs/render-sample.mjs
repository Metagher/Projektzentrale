import { mkdir, writeFile } from 'node:fs/promises';
import { pdf } from 'pdf-to-img';

await mkdir('tmp/pdfs/rendered', { recursive: true });
const document = await pdf('output/pdf/zeitbericht-muster-2026-KW35.pdf', { scale: 1.5 });
let pageNumber = 0;
for await (const image of document) {
  pageNumber += 1;
  await writeFile(`tmp/pdfs/rendered/report-page-${pageNumber}.png`, image);
}
console.log(`Rendered ${pageNumber} pages.`);
