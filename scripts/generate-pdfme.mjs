import { readFile, writeFile } from 'node:fs/promises';
import { generate } from '@pdfme/generator';
import { image, text } from '@pdfme/schemas';

const [, , templatePath, inputsPath, outputPath] = process.argv;

if (!templatePath || !inputsPath || !outputPath) {
    throw new Error('Usage: node generate-pdfme.mjs <template.json> <inputs.json> <output.pdf>');
}

const template = JSON.parse(await readFile(templatePath, 'utf8'));
const inputs = JSON.parse(await readFile(inputsPath, 'utf8'));
const pdf = await generate({ template, inputs: [inputs], plugins: { image, text } });

await writeFile(outputPath, pdf);
